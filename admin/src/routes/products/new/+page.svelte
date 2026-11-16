<script lang="ts">
  import { to } from "$lib/paths";
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { doc, setDoc, getDoc } from "firebase/firestore";
  import { httpsCallable } from "firebase/functions";
  import { db, app } from "$lib/firebase";
  import { getAuth } from "firebase/auth";
  import { invalidateProductCatalog, loadProductCatalog } from "$lib/stores/catalog";
  import { showSuccessToast } from "$lib/stores/toast";
  import { formatCallableError, getAdminFunctions } from "$lib/functionsClient";
  import ColorPickerField from "$lib/components/ColorPickerField.svelte";
  import ColorGalleryThumbs from "$lib/components/ColorGalleryThumbs.svelte";
  import { colorIntLabel, normalizeColorImageIndices } from "$lib/colorDisplay";
  import { fileToCardJpeg, fileToGalleryJpeg } from "$lib/images/productImage";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import ProductSeoFields from "$lib/components/ProductSeoFields.svelte";
  import { resolveProductSeo } from "$lib/seo/productSeo";
  import { DELIVERY_OPTIONS, deliveryFieldsFromSelection } from "$lib/deliveryEstimate";
  import { SHOW_COLOR_TOOLS, cleanImageNames, moveToFront } from "$lib/products/photoNames";
  import { DEFAULT_GROUPS, categoryOptions, loadGroups } from "$lib/data/groups";

  let categories: string[] = ["Clothing", "Shoes", "Accessories", "Bags", "Jewelry"];

  onMount(async () => {
    GROUP_OPTIONS = await loadGroups();
    try {
      const docRef = doc(db, "settings", "categories");
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        categories = categoryOptions(Object.keys(snapshot.data()));
      }
    } catch (e: any) {
      console.error("Failed to load categories:", e);
    }
  });

  let form = {
    name: "",
    category: "",
    price: 0,
    offer: 0,
    saleStart: "",
    saleEnd: "",
    deliveryEstimate: "0",
    description: "",
    sizes: "",
    colors: "",
    stock: 0,
    stockPerSize: "",
    special: false,
    freeShipping: false
  };

  let GROUP_OPTIONS: string[] = [...DEFAULT_GROUPS];
  let selectedGroups: string[] = [];
  /** All gallery files for this product (user can add in several batches). */
  let productPhotos: File[] = [];
  /** Name typed for each photo, same order as productPhotos. */
  let photoNames: string[] = [];
  let previewUrls: string[] = [];
  let loading = false;
  let analyzing = false;
  let errorMsg = "";
  let seoTitle = "";
  let seoDescription = "";
  let seoKeywords = "";
  let slug = "";

  let variantStockMatrix: Record<string, number> = {};

  let parsedSizes: string[] = [];
  let parsedColors: number[] = [];
  let colorImageIndices: number[] = [];
  let colorLabels: string[] = [];

  $: {
    const s = form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(s => s) : [];
    parsedSizes = s;
    parsedColors = parseColors(form.colors) ?? [];
    if (parsedSizes.length === 0 || parsedColors.length === 0) {
      variantStockMatrix = {};
    }
  }

  function clearPreviews() {
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls = [];
  }

  function syncPhotoPreviews() {
    clearPreviews();
    previewUrls = productPhotos.map((f) => URL.createObjectURL(f));
  }

  function onAddPhotos(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const picked = input.files;
    if (!picked?.length) return;
    const added = Array.from(picked);
    productPhotos = [...productPhotos, ...added];
    photoNames = [...photoNames, ...added.map(() => "")];
    syncPhotoPreviews();
    input.value = "";
  }

  function removePhoto(index: number) {
    productPhotos = productPhotos.filter((_, i) => i !== index);
    photoNames = photoNames.filter((_, i) => i !== index);
    syncPhotoPreviews();
  }

  function setMainPhoto(index: number) {
    if (index <= 0 || index >= productPhotos.length) return;
    productPhotos = moveToFront(productPhotos, index);
    photoNames = moveToFront(photoNames, index);
    syncPhotoPreviews();
  }

  onDestroy(clearPreviews);

  async function analyzeProductPhp(imageBase64: string) {
    const url =
      (import.meta.env.VITE_ANALYZE_PRODUCT_URL as string | undefined)?.trim() ||
      to("/analyze-product.php");
    // The PHP endpoint spends OpenRouter credit, so it only serves signed-in admins.
    const idToken = app ? await getAuth(app).currentUser?.getIdToken() : "";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
      body: JSON.stringify({
        imageBase64,
        productName: form.name,
        category: form.category,
        categories
      })
    });
    const raw = await res.text();
    let data: { error?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        "AI endpoint returned HTML. On cPanel, add analyze-config.php (copy from analyze-config.sample.php) with your OpenRouter key."
      );
    }
    if (!res.ok) {
      throw new Error(data.error || "Could not analyze image");
    }
    return data;
  }

  async function analyzeProductLocal(imageBase64: string) {
    const res = await fetch(to("/api/analyze-product"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        productName: form.name,
        category: form.category,
        categories
      })
    });
    const raw = await res.text();
    let data: { error?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        "Local AI API returned HTML instead of JSON. Run `npm run dev` in admin (not the static cPanel build)."
      );
    }
    if (!res.ok) {
      throw new Error(data.error || "Could not analyze image");
    }
    return data;
  }

  function applyAnalyzeResult(data: {
    name?: string;
    category?: string;
    description?: string;
    colors?: string[];
  }) {
    if (data.name && !form.name.trim()) form.name = data.name;
    if (data.category && !form.category) form.category = data.category;
    if (data.description) form.description = data.description;
    if (SHOW_COLOR_TOOLS && data.colors && Array.isArray(data.colors) && data.colors.length) {
      form.colors = data.colors.join(", ");
    }
  }

  async function handleAIAutoFill() {
    if (!productPhotos.length) {
      errorMsg = "Please upload at least one product image first so the AI can analyze it.";
      return;
    }

    analyzing = true;
    errorMsg = "";

    try {
      const file = productPhotos[0];
      const compressed = await compressImage(file, 800, 0.7);
      let data: {
        name?: string;
        category?: string;
        description?: string;
        colors?: string[];
      };

      if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_AI === "true") {
        try {
          const functions = getAdminFunctions();
          const adminAnalyzeProduct = httpsCallable(functions, "adminAnalyzeProduct");
          const result = await adminAnalyzeProduct({
            imageBase64: compressed,
            productName: form.name,
            category: form.category,
            categories
          });
          data = result.data as typeof data;
        } catch (callableErr) {
          console.warn("Cloud function analyze failed, using local API", callableErr);
          data = await analyzeProductLocal(compressed);
        }
      } else if (import.meta.env.DEV) {
        data = await analyzeProductLocal(compressed);
      } else {
        data = await analyzeProductPhp(compressed);
      }

      applyAnalyzeResult(data);
    } catch (err: unknown) {
      errorMsg = "AI Auto-Fill Error: " + formatCallableError(err);
    } finally {
      analyzing = false;
    }
  }

  function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round(height * maxSize / width);
              width = maxSize;
            } else {
              width = Math.round(width * maxSize / height);
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function parseColors(colorsStr: string): number[] | null {
    if (!colorsStr) return null;
    return colorsStr.split(",").map(c => {
      const hex = c.trim().replace("#", "");
      const argb = hex.length === 6 ? "FF" + hex : hex;
      return parseInt(argb, 16) | 0;
    }).filter(n => !isNaN(n));
  }

  function intToHex(c: number): string {
    const hex = (c >>> 0).toString(16).padStart(8, "0").substring(2);
    return "#" + hex.toUpperCase();
  }

  let hasVariantStock = false;
  $: hasVariantStock = parsedColors.length > 0 && parsedSizes.length > 0 && Object.keys(variantStockMatrix).length > 0;

  function recalcStock() {
    if (hasVariantStock) {
      form.stock = Object.values(variantStockMatrix).reduce((a, b) => a + (b || 0), 0);
    } else if (parsedSizes.length > 0 && form.stockPerSize) {
      form.stock = form.stockPerSize.split(",").map(s => parseInt(s.trim()) || 0).reduce((a, b) => a + b, 0);
    }
  }

  function toggleVariantStock() {
    if (hasVariantStock) {
      variantStockMatrix = {};
    } else {
      for (let ci = 0; ci < parsedColors.length; ci++) {
        for (const size of parsedSizes) {
          const key = `${ci}-${size}`;
          if (!(key in variantStockMatrix)) {
            variantStockMatrix[key] = 0;
          }
        }
      }
    }
    setTimeout(recalcStock, 0);
  }

  async function handleSave() {
    loading = true;
    errorMsg = "";
    
    try {
      if (!productPhotos.length) {
        throw new Error("Please add at least one product photo.");
      }

      const id = crypto.randomUUID();

      const uploadedImageUrls: string[] = [];
      let cardImageUrl = "";
      for (let i = 0; i < productPhotos.length; i++) {
        const file = productPhotos[i];
        const galleryFile = await fileToGalleryJpeg(file);
        const imageId = crypto.randomUUID();
        const downloadUrl = await uploadProductImage(galleryFile, imageId);
        uploadedImageUrls.push(downloadUrl);
        if (i === 0) {
          const cardFile = await fileToCardJpeg(file);
          cardImageUrl = await uploadProductImage(cardFile, `${imageId}_card`);
        }
      }

      const sizes = form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(s => s) : null;
      const colors = parseColors(form.colors);

      let sizeStock: Record<string, number> = {};
      if (sizes && form.stockPerSize && (!colors || colors.length === 0)) {
        const stockValues = form.stockPerSize.split(",").map(s => parseInt(s.trim()) || 0);
        sizes.forEach((size, i) => {
          if (i < stockValues.length && stockValues[i] > 0) {
            sizeStock[size] = stockValues[i];
          }
        });
      }

      let variantStock: Record<string, number> | null = null;
      if (colors && colors.length > 0 && sizes && sizes.length > 0 && Object.keys(variantStockMatrix).length > 0) {
        variantStock = {};
        for (let ci = 0; ci < colors.length; ci++) {
          for (const size of sizes) {
            const key = `${ci}-${size}`;
            variantStock[key] = variantStockMatrix[key] ?? 0;
          }
        }
      }

      const seo = resolveProductSeo(
        {
          name: form.name,
          category: form.category,
          description: form.description,
          price: parseFloat(form.price.toString()),
          groups: selectedGroups,
          productId: id
        },
        { seoTitle, seoDescription, seoKeywords, slug }
      );

      const productData: any = {
        id,
        name: form.name,
        nameLowercase: form.name.toLowerCase(),
        category: form.category,
        price: parseFloat(form.price.toString()),
        offerPercentage: form.offer > 0 ? parseFloat(form.offer.toString()) : null,
        saleStartAt: form.offer > 0 && form.saleStart ? new Date(form.saleStart).getTime() : null,
        saleEndAt: form.offer > 0 && form.saleEnd ? new Date(form.saleEnd).getTime() : null,
        ...deliveryFieldsFromSelection(form.deliveryEstimate),
        groups: selectedGroups,
        createdAt: Date.now(),
        description: form.description.trim() ? form.description : null,
        sizes,
        colors,
        images: uploadedImageUrls,
        imageNames: cleanImageNames(photoNames, uploadedImageUrls.length),
        cardImage: cardImageUrl,
        stock: parseInt(form.stock.toString()) || 0,
        sizeStock,
        special: form.special,
        freeShipping: Boolean(form.freeShipping),
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        seoKeywords: seo.seoKeywords,
        slug: seo.slug
      };

      if (variantStock) {
        productData.variantStock = variantStock;
      }

      if (colors && colors.length > 0) {
        productData.colorImageIndices = normalizeColorImageIndices(
          colors.length,
          uploadedImageUrls.length,
          colorImageIndices
        );
        productData.colorLabels = colorLabels.slice(0, colors.length);
      }

      await setDoc(doc(db, "product", id), productData);

      invalidateProductCatalog();
      await loadProductCatalog(true);
      showSuccessToast("Product and photos saved successfully.");
      goto(to("/products"));
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<h1>Create Product</h1>

{#if errorMsg}
  <div style="color: red">{errorMsg}</div>
{/if}

<form on:submit|preventDefault={handleSave}>
  <div class="form-grid">
    <label>
      Name
      <input type="text" bind:value={form.name} required />
    </label>
    <label>
      Category
      <select bind:value={form.category} required>
        <option value="">Select Category</option>
        {#each categories as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
    </label>
    
    <label>
      Price (UGX)
      <input type="number" bind:value={form.price} required min="0" step="1" />
    </label>
    <label>
      Estimated delivery
      <select bind:value={form.deliveryEstimate} required>
        {#each DELIVERY_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <small style="color:#667085;display:block;margin-top:4px;">
        Shown on the product page and checkout for this item.
      </small>
    </label>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={form.freeShipping} />
      <span>Free shipping on this product (optional)</span>
      <small style="color:#667085;display:block;margin-top:4px;">
        Delivery fees for all other products are set under <strong>Delivery fees</strong> in the sidebar.
      </small>
    </label>
    <label>
      Offer (percentage, 0 for none)
      <input type="number" bind:value={form.offer} min="0" max="100" />
    </label>
    <label>
      Offer starts (optional)
      <input type="datetime-local" bind:value={form.saleStart} />
    </label>
    <label>
      Offer ends (optional)
      <input type="datetime-local" bind:value={form.saleEnd} />
      <small>Leave both empty for an unlimited offer until you remove the percentage. Set start+end for a timed sale. The shop shows Starts in… before the start.</small>
    </label>
    <fieldset class="full-width groups-box">
      <legend>Groups (tick all that apply — shows in shop filters like Men, Women, Recommended) · <a href={to("/groups")}>Manage groups</a></legend>
      <div class="groups-grid">
        {#each GROUP_OPTIONS as group}
          <label class="group-chip">
            <input type="checkbox" value={group} bind:group={selectedGroups} />
            <span>{group}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <div class="full-width file-input images-top">
      <span class="photos-label">Product photos (same item)</span>
      <label class="add-photos-btn">
        <input type="file" multiple accept="image/*" on:change={onAddPhotos} />
        Add photos
      </label>
      <small>
        Add as many as you need. You can tap <strong>Add photos</strong> again to attach more. The first
        image is the main shop image. Type a <strong>name for each photo</strong> (e.g. “Black Versace T
        shirt”, “Red Versace T shirt”) — customers can search by these names.
      </small>
      {#if previewUrls.length}
        <p class="photo-count">{previewUrls.length} photo{previewUrls.length === 1 ? "" : "s"} added</p>
        <div class="photo-previews" aria-label="Uploaded photo previews">
          {#each previewUrls as url, i}
            <div class="photo-slot">
              <figure class="preview-tile">
                <img src={url} alt="Product photo {i + 1}" />
                {#if i === 0}
                  <span class="preview-badge">Main</span>
                {:else}
                  <button type="button" class="preview-main-btn" on:click={() => setMainPhoto(i)}>Main</button>
                {/if}
                <button
                  type="button"
                  class="preview-remove"
                  aria-label="Remove photo {i + 1}"
                  on:click={() => removePhoto(i)}>×</button
                >
              </figure>
              <input
                type="text"
                class="photo-name-input"
                placeholder="Name for photo {i + 1}, e.g. Black Versace T shirt"
                aria-label="Name for photo {i + 1}"
                bind:value={photoNames[i]}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="full-width ai-banner">
      <p>Hate writing descriptions? Upload your images first, then let AI analyze the product!</p>
      <button type="button" class="ai-btn" on:click={handleAIAutoFill} disabled={analyzing}>
        <i class="fa fa-magic" aria-hidden="true"></i> {analyzing ? "Analyzing Image..." : "Auto-Fill Description with AI"}
      </button>
    </div>

    <label class="full-width">
      Product description
      <textarea bind:value={form.description} rows="4" placeholder="Materials, size, care, what's in the box…"></textarea>
      <small>Shown on the product page under Add to cart.</small>
    </label>

    {#if SHOW_COLOR_TOOLS}
      <div class="full-width colors-block">
        <span class="field-label">Colors</span>
        <ColorPickerField bind:value={form.colors} bind:labels={colorLabels} />
        <ColorGalleryThumbs
          colors={parsedColors}
          colorLabels={colorLabels}
          imageUrls={previewUrls}
          bind:indices={colorImageIndices}
        />
      </div>
    {/if}

    <label>
      Sizes (optional, comma-separated e.g. S,M,L)
      <input type="text" bind:value={form.sizes} />
    </label>
    <label>
      Total Stock (auto-calculated)
      <input type="number" bind:value={form.stock} min="0" step="1" required />
      <small>Auto-fills from Stock per Size or Variant Stock. You can also enter manually.</small>
    </label>

    {#if parsedSizes.length > 0 && (!parsedColors || parsedColors.length === 0)}
      <label class="full-width">
        Stock per Size (comma-separated e.g. 2,7,3 for S=2, M=7, L=3)
        <input type="text" bind:value={form.stockPerSize} placeholder="e.g. 2,7,3" on:input={recalcStock} />
      </label>
    {/if}

    {#if parsedColors.length > 0 && parsedSizes.length > 0}
      <div class="full-width variant-section">
        <div class="variant-header">
          <label class="checkbox-label">
            <input type="checkbox" checked={hasVariantStock} on:change={toggleVariantStock} />
            <span>Track stock per color × size variant</span>
          </label>
        </div>
        {#if hasVariantStock}
          <div class="matrix-wrapper">
            <table class="stock-matrix">
              <thead>
                <tr>
                  <th>Color</th>
                  {#each parsedSizes as size}
                    <th>{size}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each parsedColors as color, ci}
                  <tr>
                    <td class="color-cell">
                      <span class="color-swatch" style="background: {intToHex(color)}"></span>
                      {colorIntLabel(color, colorLabels[ci])}
                    </td>
                    {#each parsedSizes as size}
                      {@const key = `${ci}-${size}`}
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          class="stock-input"
                          value={variantStockMatrix[key] ?? 0}
                          on:input={(e) => { variantStockMatrix[key] = parseInt(e.target.value) || 0; recalcStock(); }}
                        />
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <small>These values track exact stock for each color×size combination. The "Total Stock" field above is used as a fallback only.</small>
        {:else}
          <small>Check the box above to set individual stock for each color×size combination. Otherwise, "Total Stock" is shared across all variants.</small>
        {/if}
      </div>
    {/if}

    <label class="checkbox-label full-width">
      <input type="checkbox" bind:checked={form.special} />
      <span>Feature in shop “Recommended”</span>
    </label>

    <div class="full-width">
      <ProductSeoFields
        name={form.name}
        category={form.category}
        description={form.description}
        price={form.price}
        groups={selectedGroups}
        bind:seoTitle
        bind:seoDescription
        bind:seoKeywords
        bind:slug
      />
    </div>
  </div>

  <button type="submit" disabled={loading}>
    {loading ? 'Uploading & Saving...' : 'Save Product'}
  </button>
</form>

<style>
  form {
    width: 100%;
    max-width: none;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 22px;
    background: #fff;
    border: 1px solid #e6edf5;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
    box-sizing: border-box;
  }
  .images-top {
    padding: 14px;
    border: 1px dashed #9fd6f0;
    border-radius: 10px;
    background: #fffbeb;
  }
  .photos-label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #344054;
  }
  .add-photos-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    background: #fff;
    border: 1px solid #9fd6f0;
    border-radius: 8px;
    font-weight: 600;
    color: #13344f;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .add-photos-btn input {
    display: none;
  }
  .photo-count {
    margin: 10px 0 6px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
  }
  .photo-previews {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }
  .photo-slot {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }
  .photo-name-input {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    padding: 12px 14px;
    font-size: 15px;
  }
  .preview-tile {
    position: relative;
    flex-shrink: 0;
    margin: 0;
    width: 120px;
    height: 120px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    background: #fff;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }
  .preview-tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .preview-badge {
    position: absolute;
    left: 4px;
    bottom: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(19, 95, 163, 0.92);
    color: #fff;
  }
  .preview-main-btn {
    position: absolute;
    left: 4px;
    bottom: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    border: none;
    background: rgba(15, 23, 42, 0.75);
    color: #fff;
    cursor: pointer;
  }
  .preview-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }
  .colors-block .field-label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #344054;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px 20px;
  }
  @media (max-width: 900px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
  .full-width {
    grid-column: 1 / -1;
  }
  label { 
    display: flex; 
    flex-direction: column; 
    font-weight: 500;
  }
  input, select, textarea {
    padding: 8px;
    margin-top: 4px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  .checkbox-label input {
    width: auto;
    margin: 0;
    padding: 0;
  }
  .groups-box {
    margin: 0;
    padding: 12px 14px 14px;
    border: 1px solid #d7e0ea;
    border-radius: 12px;
    background: #f8fafc;
  }
  .groups-box legend {
    padding: 0 6px;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
  }
  .groups-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .group-chip {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 8px 12px;
    border: 1px solid #d7e0ea;
    border-radius: 999px;
    background: #fff;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    cursor: pointer;
    user-select: none;
  }
  .group-chip:has(input:checked) {
    border-color: #1673c4;
    background: #eef7fc;
    color: #0c2236;
  }
  .group-chip input {
    width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
    flex: 0 0 auto;
    accent-color: #1673c4;
    cursor: pointer;
  }
  .group-chip span {
    line-height: 1.2;
  }
  button {
    padding: 12px;
    background: #1673c4;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
  }
  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  .ai-banner {
    background: #f3f0ff;
    padding: 15px;
    border-radius: 8px;
    border: 1px dashed #a29bfe;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ai-banner p {
    margin: 0;
    color: #6c5ce7;
    font-size: 14px;
    font-weight: 500;
  }
  .ai-btn {
    background: #6c5ce7;
    width: fit-content;
  }
  .ai-btn:hover:not(:disabled) {
    background: #5b4bc4;
  }
  .variant-section {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  }
  .variant-header {
    margin-bottom: 10px;
  }
  .matrix-wrapper {
    overflow-x: auto;
  }
  .stock-matrix {
    border-collapse: collapse;
    width: 100%;
  }
  .stock-matrix th,
  .stock-matrix td {
    border: 1px solid #ddd;
    padding: 6px 10px;
    text-align: center;
    font-size: 13px;
  }
  .stock-matrix th {
    background: #1673c4;
    color: white;
    font-weight: 500;
  }
  .color-cell {
    text-align: left !important;
    white-space: nowrap;
  }
  .color-swatch {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid #aaa;
    vertical-align: middle;
    margin-right: 6px;
  }
  .stock-input {
    width: 60px;
    padding: 4px;
    margin: 0;
    text-align: center;
  }
  small {
    color: #666;
    margin-top: 4px;
  }
</style>
