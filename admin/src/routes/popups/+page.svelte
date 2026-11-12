<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, runTransaction } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { showSuccessToast } from "$lib/stores/toast";
  import { uploadPromoImage, useCloudinary } from "$lib/images/promoUpload";

  /**
   * Promotional pop-ups — Firestore settings/popups.items.
   * The shop shows the first active pop-up whose date window includes "now" and that the
   * visitor has not closed recently (see `reshow`).
   */
  type Popup = {
    id: string;
    imageUrl: string;
    title?: string;
    link?: string;
    active?: boolean;
    startAt?: number | null;
    endAt?: number | null;
    /** After the visitor closes it: show again next visit ("session"), after N days, or never ("never"). */
    reshow?: "session" | "1d" | "7d" | "never";
    delaySeconds?: number;
  };

  const RESHOW_LABELS: Record<NonNullable<Popup["reshow"]>, string> = {
    session: "Next visit",
    "1d": "After 1 day",
    "7d": "After 7 days",
    never: "Never again"
  };

  if (!db) throw new Error("Firebase is not configured");
  const firestore = db;
  const popupsDoc = doc(firestore, "settings", "popups");

  let popups: Popup[] = [];
  let loading = true;
  let saving = false;
  let uploading = false;
  let errorMsg = "";

  let formOpen = false;
  let editingId: string | null = null;
  let files: FileList | null = null;
  let title = "";
  let link = "";
  let active = true;
  let startDate = "";
  let endDate = "";
  let reshow: NonNullable<Popup["reshow"]> = "1d";
  let delaySeconds = 3;
  let preview = "";
  let formEl: HTMLFormElement;

  $: editing = editingId ? popups.find((p) => p.id === editingId) || null : null;
  $: {
    if (preview) URL.revokeObjectURL(preview);
    preview = files && files[0] ? URL.createObjectURL(files[0]) : "";
  }

  onMount(async () => {
    try {
      const snap = await getDoc(popupsDoc);
      const items = snap.exists() ? snap.data().items : [];
      popups = (Array.isArray(items) ? items : []).map((p: Popup) => ({ ...p, active: p.active !== false }));
    } catch (e: any) {
      errorMsg = "Error loading pop-ups: " + e.message;
    } finally {
      loading = false;
    }
  });

  /** Apply `update` to the latest list in a transaction (safe with several admins / tabs). */
  async function persist(update: (items: Popup[]) => Popup[], message: string) {
    saving = true;
    errorMsg = "";
    try {
      const next = await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(popupsDoc);
        const items = snap.exists() && Array.isArray(snap.data().items) ? (snap.data().items as Popup[]) : [];
        const updated = update(items);
        tx.set(popupsDoc, { items: updated });
        return updated;
      });
      popups = next.map((p) => ({ ...p, active: p.active !== false }));
      showSuccessToast(message);
    } catch (e: any) {
      errorMsg = "Could not save: " + e.message;
      throw e;
    } finally {
      saving = false;
    }
  }

  const toDateInput = (ms?: number | null) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const fromDateInput = (v: string) => (v ? new Date(v).getTime() : null);

  function resetForm() {
    files = null;
    title = "";
    link = "";
    active = true;
    startDate = "";
    endDate = "";
    reshow = "1d";
    delaySeconds = 3;
    formEl?.reset();
  }

  function openAdd() {
    editingId = null;
    resetForm();
    errorMsg = "";
    formOpen = true;
  }

  function openEdit(p: Popup) {
    resetForm();
    errorMsg = "";
    editingId = p.id;
    title = p.title || "";
    link = p.link || "";
    active = p.active !== false;
    startDate = toDateInput(p.startAt);
    endDate = toDateInput(p.endAt);
    reshow = p.reshow || "1d";
    delaySeconds = typeof p.delaySeconds === "number" ? p.delaySeconds : 3;
    formOpen = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    formOpen = false;
    editingId = null;
    resetForm();
  }

  function cleanLink(value: string): string {
    const v = value.trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v;
    throw new Error("Link must start with https:// or / (for a page on the shop).");
  }

  async function handleSubmit() {
    errorMsg = "";
    const current = editing;
    const hasFile = Boolean(files && files.length > 0);
    if (!current && !hasFile) {
      errorMsg = "Choose the pop-up image.";
      return;
    }
    const startAt = fromDateInput(startDate);
    const endAt = fromDateInput(endDate);
    if (startAt && endAt && endAt <= startAt) {
      errorMsg = "The end date must be after the start date.";
      return;
    }
    uploading = true;
    try {
      const safeLink = cleanLink(link);
      const id = current?.id || crypto.randomUUID();
      const imageUrl = hasFile
        ? await uploadPromoImage(files![0], `${id}-${Date.now().toString(36)}`, "popups", 900)
        : current!.imageUrl;
      const popup: Popup = {
        id,
        imageUrl,
        title: title.trim(),
        link: safeLink,
        active,
        startAt,
        endAt,
        reshow,
        delaySeconds: Math.max(0, Math.min(60, Number(delaySeconds) || 0))
      };
      await persist(
        (items) => (current ? items.map((p) => (p.id === id ? popup : p)) : [...items, popup]),
        current ? "Pop-up updated." : "Pop-up added."
      );
      closeForm();
    } catch (e: any) {
      errorMsg = (current ? "Failed to update pop-up: " : "Failed to add pop-up: ") + e.message;
    } finally {
      uploading = false;
    }
  }

  function moveById(items: Popup[], id: string, delta: number): Popup[] {
    const i = items.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }

  function move(p: Popup, delta: number) {
    persist((items) => moveById(items, p.id, delta), "Order saved.").catch(() => {});
  }

  function toggle(p: Popup) {
    const show = !p.active;
    persist(
      (items) => items.map((x) => (x.id === p.id ? { ...x, active: show } : x)),
      show ? "Pop-up turned on." : "Pop-up turned off."
    ).catch(() => {});
  }

  function remove(p: Popup) {
    if (!confirm(`Delete the pop-up "${p.title || "Untitled"}"?`)) return;
    if (editingId === p.id) closeForm();
    persist((items) => items.filter((x) => x.id !== p.id), "Pop-up deleted.").catch(() => {});
  }

  function status(p: Popup): { label: string; tone: string } {
    const now = Date.now();
    if (!p.active) return { label: "Off", tone: "off" };
    if (p.startAt && now < p.startAt) return { label: "Scheduled", tone: "sched" };
    if (p.endAt && now >= p.endAt) return { label: "Ended", tone: "off" };
    return { label: "Live", tone: "on" };
  }

  const fmt = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" }) : "";
</script>

<div class="header">
  <div>
    <h1><i class="fa fa-window-restore" aria-hidden="true"></i> Pop-ups</h1>
    <p class="intro">
      Promotional pop-ups that slide in at the bottom-left of the shop, with a close button. Only the first
      <strong>live</strong> pop-up in this list is shown, so put the one you want on top.
    </p>
  </div>
  {#if !formOpen}
    <button type="button" class="primary" on:click={openAdd}>
      <i class="fa fa-plus" aria-hidden="true"></i> Add pop-up
    </button>
  {/if}
</div>

{#if errorMsg}
  <div class="alert error">{errorMsg}</div>
{/if}

{#if formOpen}
  <div class="form-container">
    <h3>{editing ? "Edit pop-up" : "Add a pop-up"}</h3>
    <form bind:this={formEl} on:submit|preventDefault={handleSubmit}>
      {#if editing}
        <div class="current">
          <span>Current image</span>
          <img class="preview" src={editing.imageUrl} alt="Current pop-up" />
        </div>
      {/if}
      <label>
        <span>{editing ? "Replace image" : "Pop-up image"} <span class={editing ? "opt" : "req"}>{editing ? "optional" : "required"}</span></span>
        <input type="file" bind:files accept="image/*" required={!editing} />
        <small>A designed square or portrait image works best, about <strong>800 × 800 px</strong> or <strong>800 × 1000 px</strong>.</small>
      </label>
      {#if preview}
        <img class="preview" src={preview} alt="New pop-up preview" />
      {/if}
      <label>
        <span>Title <span class="opt">optional — for your reference and screen readers</span></span>
        <input type="text" bind:value={title} placeholder="e.g. Black Friday — up to 30% off" />
      </label>
      <label>
        <span>Link when tapped <span class="opt">optional</span></span>
        <input type="text" bind:value={link} placeholder="https://wa.me/256754558186 or /help/seller" />
      </label>
      <div class="row">
        <label>
          <span>Start <span class="opt">optional</span></span>
          <input type="datetime-local" bind:value={startDate} />
        </label>
        <label>
          <span>End <span class="opt">optional</span></span>
          <input type="datetime-local" bind:value={endDate} />
        </label>
      </div>
      <div class="row">
        <label>
          <span>After a visitor closes it, show again</span>
          <select bind:value={reshow}>
            {#each Object.entries(RESHOW_LABELS) as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Appear after (seconds)</span>
          <input type="number" min="0" max="60" bind:value={delaySeconds} />
        </label>
      </div>
      <label class="check">
        <input type="checkbox" bind:checked={active} /> Turned on
      </label>
      <div class="form-actions">
        <button type="submit" class="primary" disabled={uploading || saving}>
          <i class="fa {editing ? 'fa-check' : 'fa-upload'}" aria-hidden="true"></i>
          {uploading ? "Saving…" : editing ? "Save changes" : "Add pop-up"}
        </button>
        <button type="button" class="ghost" on:click={closeForm} disabled={uploading}>Cancel</button>
      </div>
      {#if !useCloudinary}
        <small class="warn">Cloudinary keys are not set in admin .env, so images go to Firebase Storage (requires the Blaze plan).</small>
      {/if}
    </form>
  </div>
{/if}

<h3>Your pop-ups ({popups.length})</h3>
{#if loading}
  <p class="muted">Loading…</p>
{:else if popups.length === 0}
  <p class="muted">No pop-ups yet. Click <strong>Add pop-up</strong> to create one.</p>
{:else}
  <div class="list">
    {#each popups as p, index (p.id)}
      {@const st = status(p)}
      <div class="row-card" class:dim={st.tone === "off"} class:being-edited={p.id === editingId}>
        <span class="pos">{index + 1}</span>
        <img class="thumb" src={p.imageUrl} alt={p.title || "Pop-up"} />
        <div class="info">
          <strong>{p.title || "Untitled pop-up"}</strong>
          <span class="meta"><i class="fa fa-link" aria-hidden="true"></i> {p.link || "No link"}</span>
          <span class="meta">
            <i class="fa fa-calendar" aria-hidden="true"></i>
            {#if p.startAt || p.endAt}{p.startAt ? fmt(p.startAt) : "Now"} → {p.endAt ? fmt(p.endAt) : "no end"}{:else}Always{/if}
            · <i class="fa fa-repeat" aria-hidden="true"></i> {RESHOW_LABELS[p.reshow || "1d"]}
          </span>
          <span class="badge {st.tone}">{st.label}</span>
        </div>
        <div class="actions">
          <button type="button" title="Move up" aria-label="Move up" disabled={index === 0 || saving} on:click={() => move(p, -1)}><i class="fa fa-arrow-up"></i></button>
          <button type="button" title="Move down" aria-label="Move down" disabled={index === popups.length - 1 || saving} on:click={() => move(p, 1)}><i class="fa fa-arrow-down"></i></button>
          <button type="button" title={p.active ? "Turn off" : "Turn on"} aria-label={p.active ? "Turn off" : "Turn on"} disabled={saving} on:click={() => toggle(p)}><i class="fa {p.active ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
          <button type="button" title="Edit" aria-label="Edit" disabled={saving || uploading} on:click={() => openEdit(p)}><i class="fa fa-pencil"></i></button>
          <button type="button" class="danger" title="Delete" aria-label="Delete" disabled={saving} on:click={() => remove(p)}><i class="fa fa-trash-o"></i></button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .intro { color: #4b5563; max-width: 760px; margin: 0; }
  .alert.error { background: #fef2f2; color: #b91c1c; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
  .form-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 24px; }
  .form-container h3 { margin-top: 0; }
  form { display: flex; flex-direction: column; gap: 14px; max-width: 640px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14px; }
  label.check { flex-direction: row; align-items: center; gap: 8px; font-weight: 500; }
  .req, .opt { font-weight: 400; font-size: 12px; color: #6b7280; }
  .req { color: #1673c4; }
  small { font-weight: 400; color: #6b7280; font-size: 12px; }
  small.warn { color: #b45309; }
  input[type="text"], input[type="file"], input[type="number"], input[type="datetime-local"], select {
    padding: 9px 10px; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; font-weight: 400;
  }
  .current { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #4b5563; }
  .preview { width: 220px; border-radius: 10px; border: 1px solid #e5e7eb; }
  .primary { display: inline-flex; gap: 8px; align-items: center; background: #1673c4; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
  .primary:disabled { opacity: 0.6; cursor: default; }
  .ghost { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 16px; cursor: pointer; }
  .form-actions { display: flex; gap: 8px; align-items: center; }
  .muted { color: #6b7280; }
  .list { display: flex; flex-direction: column; gap: 12px; }
  .row-card { display: grid; grid-template-columns: auto 96px 1fr auto; gap: 16px; align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
  .row-card.dim { opacity: 0.6; }
  .row-card.being-edited { border-color: #2ba8e0; box-shadow: 0 0 0 2px rgba(43, 168, 224, 0.25); }
  .pos { font-weight: 800; color: #94a3b8; width: 18px; text-align: center; }
  .thumb { width: 96px; height: 96px; object-fit: cover; border-radius: 10px; border: 1px solid #e5e7eb; }
  .info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .info strong { color: #13344f; }
  .meta { font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { align-self: flex-start; font-size: 12px; padding: 2px 8px; border-radius: 999px; }
  .badge.on { background: #dcfce7; color: #166534; }
  .badge.sched { background: #e0f1fa; color: #135fa3; }
  .badge.off { background: #f3f4f6; color: #4b5563; }
  .actions { display: flex; gap: 6px; }
  .actions button { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; color: #13344f; cursor: pointer; }
  .actions button:disabled { opacity: 0.4; cursor: default; }
  .actions button.danger { color: #b91c1c; border-color: #fecaca; }
  @media (max-width: 800px) {
    .row-card { grid-template-columns: 72px 1fr; }
    .pos { display: none; }
    .thumb { width: 72px; height: 72px; }
    .actions { grid-column: 1 / -1; }
    .row { grid-template-columns: 1fr; }
  }
</style>
