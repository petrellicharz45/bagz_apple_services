<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc } from "firebase/firestore";
  import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
  import {
    PUBLIC_CLOUDINARY_CLOUD_NAME,
    PUBLIC_CLOUDINARY_UPLOAD_PRESET
  } from "$env/static/public";
  import { db, storage } from "$lib/firebase";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import { showSuccessToast } from "$lib/stores/toast";

  /**
   * Home page slider banners — Firestore settings/banners.items.
   * The shop shows active banners in this order; when none are active it falls
   * back to its built-in slides.
   */
  type Banner = {
    id: string;
    imageUrl: string;
    mobileImageUrl?: string;
    caption?: string;
    link?: string;
    active?: boolean;
  };

  const DESKTOP_MAX = 1920;
  const MOBILE_MAX = 1080;
  const QUALITY = 0.85;
  const useCloudinary = Boolean(
    PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() && PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim()
  );

  let banners: Banner[] = [];
  let loading = true;
  let saving = false;
  let uploading = false;
  let errorMsg = "";

  // New banner form
  let desktopFiles: FileList | null = null;
  let mobileFiles: FileList | null = null;
  let caption = "";
  let link = "";
  let desktopPreview = "";
  let mobilePreview = "";
  let formEl: HTMLFormElement;

  $: desktopPreview = previewOf(desktopFiles, desktopPreview);
  $: mobilePreview = previewOf(mobileFiles, mobilePreview);

  function previewOf(files: FileList | null, previous: string): string {
    if (previous) URL.revokeObjectURL(previous);
    return files && files[0] ? URL.createObjectURL(files[0]) : "";
  }

  if (!db) throw new Error("Firebase is not configured");
  const firestore = db;
  const bannersDoc = doc(firestore, "settings", "banners");

  onMount(loadBanners);

  async function loadBanners() {
    try {
      const snapshot = await getDoc(bannersDoc);
      const items = snapshot.exists() ? snapshot.data().items : [];
      banners = (Array.isArray(items) ? items : []).map((b: Banner) => ({
        ...b,
        active: b.active !== false
      }));
    } catch (e: any) {
      errorMsg = "Error loading banners: " + e.message;
    } finally {
      loading = false;
    }
  }

  async function persist(next: Banner[], message = "") {
    saving = true;
    errorMsg = "";
    try {
      await setDoc(bannersDoc, { items: next }, { merge: true });
      banners = next;
      if (message) showSuccessToast(message);
    } catch (e: any) {
      errorMsg = "Could not save banners: " + e.message;
    } finally {
      saving = false;
    }
  }

  /** Resize + JPEG-compress, painting a white background so transparent PNGs don't turn black. */
  async function compress(file: File, maxWidth: number): Promise<Blob> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Could not read image"));
        i.src = url;
      });
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not compress image"))), "image/jpeg", QUALITY)
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function uploadImage(file: File, id: string, maxWidth: number): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Image is larger than 20 MB.");
    const blob = await compress(file, maxWidth);
    if (useCloudinary) {
      return uploadProductImage(blob, id, "banners", `${id}.jpg`);
    }
    if (!storage) throw new Error("No image storage configured (set Cloudinary keys in admin .env).");
    const fileRef = ref(storage, `banners/${id}.jpg`);
    await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
    return getDownloadURL(fileRef);
  }

  function cleanLink(value: string): string {
    const v = value.trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v;
    throw new Error("Link must start with https:// or / (for a page on the shop).");
  }

  async function handleAddBanner() {
    errorMsg = "";
    if (!desktopFiles || desktopFiles.length === 0) {
      errorMsg = "Choose the banner image.";
      return;
    }
    uploading = true;
    try {
      const id = crypto.randomUUID();
      const safeLink = cleanLink(link);
      const imageUrl = await uploadImage(desktopFiles[0], id, DESKTOP_MAX);
      const mobileImageUrl =
        mobileFiles && mobileFiles[0] ? await uploadImage(mobileFiles[0], `${id}-mobile`, MOBILE_MAX) : "";
      const banner: Banner = { id, imageUrl, caption: caption.trim(), link: safeLink, active: true };
      if (mobileImageUrl) banner.mobileImageUrl = mobileImageUrl;
      await persist([...banners, banner], "Banner added — it now shows on the shop home page.");
      caption = "";
      link = "";
      desktopFiles = null;
      mobileFiles = null;
      formEl?.reset();
    } catch (e: any) {
      errorMsg = "Failed to add banner: " + e.message;
    } finally {
      uploading = false;
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next, "Order saved.");
  }

  function toggleActive(index: number) {
    const next = banners.map((b, i) => (i === index ? { ...b, active: !b.active } : b));
    void persist(next, next[index].active ? "Banner is visible on the shop." : "Banner hidden from the shop.");
  }

  function updateField(index: number, field: "caption" | "link", value: string) {
    try {
      const v = field === "link" ? cleanLink(value) : value.trim();
      const next = banners.map((b, i) => (i === index ? { ...b, [field]: v } : b));
      void persist(next, "Banner updated.");
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  async function deleteStoredImage(url?: string) {
    // Only Firebase Storage files can be deleted from the browser; Cloudinary uploads stay in the media library.
    if (!url || !storage || !url.includes("firebasestorage")) return;
    try {
      await deleteObject(ref(storage, url));
    } catch (err) {
      console.warn("Could not delete banner image from storage", err);
    }
  }

  async function handleDeleteBanner(index: number) {
    if (!confirm("Delete this banner from the home page slider?")) return;
    const banner = banners[index];
    await persist(banners.filter((_, i) => i !== index), "Banner deleted.");
    await deleteStoredImage(banner.imageUrl);
    await deleteStoredImage(banner.mobileImageUrl);
  }
</script>

<div class="header">
  <h1><i class="fa fa-picture-o" aria-hidden="true"></i> Home page banners</h1>
  <a href="/" class="back-link"><i class="fa fa-arrow-left" aria-hidden="true"></i> Back to Dashboard</a>
</div>

<p class="intro">
  Upload ready-made banner images (with the text already designed in) for the slider at the top of the
  shop home page. Banners show in the order below. When no banner is visible, the shop shows its built-in slides.
</p>

{#if loading}
  <p>Loading…</p>
{:else}
  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}

  <div class="form-container">
    <h3>Add a banner</h3>
    <form bind:this={formEl} on:submit|preventDefault={handleAddBanner}>
      <label>
        Banner image (desktop) <span class="req">required</span>
        <input type="file" bind:files={desktopFiles} accept="image/*" required />
        <small>Wide image, about <strong>1920 × 560 px</strong> (ratio ≈ 3.4 : 1). Large files are compressed automatically.</small>
      </label>
      {#if desktopPreview}
        <img class="preview wide" src={desktopPreview} alt="Desktop banner preview" />
      {/if}

      <label>
        Phone image <span class="opt">optional</span>
        <input type="file" bind:files={mobileFiles} accept="image/*" />
        <small>Taller version for phones, about <strong>1080 × 720 px</strong> (3 : 2). Without it, phones show the desktop image.</small>
      </label>
      {#if mobilePreview}
        <img class="preview tall" src={mobilePreview} alt="Phone banner preview" />
      {/if}

      <label>
        Link when tapped <span class="opt">optional</span>
        <input type="text" bind:value={link} placeholder="https://wa.me/256754558186 or /help/seller" />
      </label>

      <label>
        Description for screen readers / SEO <span class="opt">optional</span>
        <input type="text" bind:value={caption} placeholder="e.g. Galaxy Z Fold8 — now available at Bagz" />
      </label>

      <button type="submit" class="primary" disabled={uploading || saving}>
        <i class="fa fa-upload" aria-hidden="true"></i>
        {uploading ? "Uploading…" : "Add banner"}
      </button>
      {#if !useCloudinary}
        <small class="warn">
          Cloudinary keys are not set in admin .env, so images go to Firebase Storage (requires the Blaze plan).
        </small>
      {/if}
    </form>
  </div>

  <h3>Current banners ({banners.length})</h3>
  {#if banners.length === 0}
    <p class="muted">No banners yet — the shop is showing its built-in slides.</p>
  {:else}
    <div class="banner-list">
      {#each banners as banner, index (banner.id)}
        <div class="banner-row" class:hidden-banner={!banner.active}>
          <div class="thumbs">
            <img class="thumb wide" src={banner.imageUrl} alt={banner.caption || "Banner"} />
            {#if banner.mobileImageUrl}
              <img class="thumb tall" src={banner.mobileImageUrl} alt="Phone version" title="Phone version" />
            {/if}
          </div>
          <div class="fields">
            <label>
              Link
              <input
                type="text"
                value={banner.link || ""}
                placeholder="No link"
                on:change={(e) => updateField(index, "link", e.currentTarget.value)}
              />
            </label>
            <label>
              Description
              <input
                type="text"
                value={banner.caption || ""}
                placeholder="Optional"
                on:change={(e) => updateField(index, "caption", e.currentTarget.value)}
              />
            </label>
            <div class="status">
              {#if banner.active}
                <span class="badge on"><i class="fa fa-eye" aria-hidden="true"></i> Visible</span>
              {:else}
                <span class="badge off"><i class="fa fa-eye-slash" aria-hidden="true"></i> Hidden</span>
              {/if}
              {#if !banner.mobileImageUrl}<span class="badge muted">No phone image</span>{/if}
            </div>
          </div>
          <div class="actions">
            <button type="button" title="Move up" aria-label="Move up" disabled={index === 0 || saving} on:click={() => move(index, -1)}>
              <i class="fa fa-arrow-up" aria-hidden="true"></i>
            </button>
            <button type="button" title="Move down" aria-label="Move down" disabled={index === banners.length - 1 || saving} on:click={() => move(index, 1)}>
              <i class="fa fa-arrow-down" aria-hidden="true"></i>
            </button>
            <button type="button" title={banner.active ? "Hide" : "Show"} aria-label={banner.active ? "Hide banner" : "Show banner"} disabled={saving} on:click={() => toggleActive(index)}>
              <i class="fa {banner.active ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
            </button>
            <button type="button" class="danger" title="Delete" aria-label="Delete banner" disabled={saving} on:click={() => handleDeleteBanner(index)}>
              <i class="fa fa-trash-o" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .header h1 {
    margin: 0;
    font-size: 22px;
  }
  .back-link {
    color: #1673c4;
    text-decoration: none;
  }
  .intro {
    color: #4b5563;
    max-width: 760px;
  }
  .alert {
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .error {
    background: #fef2f2;
    color: #b91c1c;
  }
  .form-container {
    background: #fff;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    margin-bottom: 28px;
  }
  .form-container h3 {
    margin-top: 0;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 640px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .req,
  .opt {
    font-weight: 400;
    font-size: 12px;
    color: #6b7280;
  }
  .req {
    color: #1673c4;
  }
  small {
    font-weight: 400;
    color: #6b7280;
    font-size: 12px;
  }
  small.warn {
    color: #b45309;
  }
  input[type="text"],
  input[type="file"] {
    padding: 9px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font: inherit;
    font-weight: 400;
  }
  .preview {
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    object-fit: cover;
  }
  .preview.wide {
    width: 100%;
    aspect-ratio: 3.4 / 1;
  }
  .preview.tall {
    width: 240px;
    aspect-ratio: 3 / 2;
  }
  .primary {
    align-self: flex-start;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    background: #1673c4;
    color: #fff;
    border: 0;
    border-radius: 8px;
    padding: 10px 18px;
    font-weight: 700;
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .muted {
    color: #6b7280;
  }
  .banner-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .banner-row {
    display: grid;
    grid-template-columns: minmax(220px, 1.4fr) 1fr auto;
    gap: 16px;
    align-items: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
  }
  .banner-row.hidden-banner {
    opacity: 0.55;
  }
  .thumbs {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }
  .thumb {
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid #e5e7eb;
    background: #f3f4f6;
  }
  .thumb.wide {
    flex: 1;
    min-width: 0;
    aspect-ratio: 3.4 / 1;
  }
  .thumb.tall {
    width: 72px;
    aspect-ratio: 3 / 2;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .fields label {
    font-size: 12px;
    color: #4b5563;
  }
  .status {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f3f4f6;
    color: #4b5563;
  }
  .badge.on {
    background: #e0f1fa;
    color: #135fa3;
  }
  .badge.off {
    background: #fef3c7;
    color: #92400e;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .actions button {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #13344f;
    cursor: pointer;
  }
  .actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .actions button.danger {
    color: #b91c1c;
    border-color: #fecaca;
  }
  @media (max-width: 800px) {
    .banner-row {
      grid-template-columns: 1fr;
    }
  }
</style>
