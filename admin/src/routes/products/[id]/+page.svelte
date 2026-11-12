<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { doc, getDoc, updateDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { invalidateProductCatalog, loadProductCatalog } from "$lib/stores/catalog";
  import { showSuccessToast } from "$lib/stores/toast";
  import ColorPickerField from "$lib/components/ColorPickerField.svelte";
  import ColorGalleryThumbs from "$lib/components/ColorGalleryThumbs.svelte";
  import { colorIntLabel, normalizeColorImageIndices } from "$lib/colorDisplay";
  import { blobToCardJpeg, blobToGalleryJpeg, fileToCardJpeg, fileToGalleryJpeg } from "$lib/images/productImage";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import { SHOW_COLOR_TOOLS, cleanImageNames, moveToFront } from "$lib/products/photoNames";
  import ProductSeoFields from "$lib/components/ProductSeoFields.svelte";
  import { resolveProductSeo } from "$lib/seo/productSeo";
  import { DELIVERY_OPTIONS, deliveryFieldsFromSelection } from "$lib/deliveryEstimate";
  import { DEFAULT_GROUPS, categoryOptions, loadGroups } from "$lib/data/groups";

  const productId = $page.params.id;

  let form = {
    name: "",
    category: "",
    price: 0,
    offer: 0,
    saleStart: "",
    saleEnd: "",
    deliveryEstimate: "5",
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
  let existingImages: string[] = [];
  /** Name typed for each gallery photo, same order as existingImages. */
  let imageNames: string[] = [];
  let cardImage = "";
  let loading = true;
  let saving = false;
  let addingPhotos = false;
  let fixingImages = false;
  let errorMsg = "";
  let uploadStatus = "";
  let seoTitle = "";
  let seoDescription = "";
  let seoKeywords = "";
  let slug = "";

  let categories: string[] = ["Clothing", "Shoes", "Accessories", "Bags", "Jewelry"];

  let variantStockMatrix: Record<string, number> = {};
  let parsedSizes: string[] = [];
  let parsedColors: number[] = [];
  let colorImageIndices: number[] = [];
  let colorLabels: string[] = [];
  let hasVariantStock = false;
  let variantStockEverEnabled = false;

  function recalcStock() {
    if (hasVariantStock) {
      form.stock = Object.values(variantStockMatrix).reduce((a, b) => a + (b || 0), 0);
    } else if (parsedSizes.length > 0 && form.stockPerSize) {
      form.stock = form.stockPerSize.split(",").map(s => parseInt(s.trim()) || 0).reduce((a, b) => a + b, 0);
    }
  }

  $: {
    const s = form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(s => s) : [];
    parsedSizes = s;
    parsedColors = parseColors(form.colors) ?? [];
  }

  onMount(async () => {
    try {
      const catDoc = await getDoc(doc(db, "settings", "categories"));
      const catKeys = catDoc.exists() ? Object.keys(catDoc.data()) : categories;
      const groupList = await loadGroups();

      const productDoc = await getDoc(doc(db, "product", productId));
      if (!productDoc.exists()) {
        errorMsg = "Product not found";
        loading = false;
        return;
      }

      const data = productDoc.data();
      form.name = data.name || "";
      form.category = data.category || "";
      categories = categoryOptions(catKeys, form.category);
      form.price = data.price || 0;
      form.offer = data.offerPercentage || 0;
      const pad = (n: number) => String(n).padStart(2, "0");
      const toLocal = (millis: number) => {
        const d = new Date(millis);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      if (data.saleStartAt) form.saleStart = toLocal(data.saleStartAt);
      if (data.saleEndAt) form.saleEnd = toLocal(data.saleEndAt);
      const toDateInput = (millis: number) => {
        const d = new Date(millis);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      if (data.deliveryEstimateDays) {
        form.deliveryEstimate = String(data.deliveryEstimateDays);
      } else {
        form.deliveryEstimate = "5";
      }
      selectedGroups = Array.isArray(data.groups) ? data.groups : [];
      // Keep groups this product already has, even if they were removed from the list.
      GROUP_OPTIONS = [...groupList, ...selectedGroups.filter((g) => !groupList.includes(g))];
      form.description = data.description || "";
      seoTitle = data.seoTitle || "";
      seoDescription = data.seoDescription || "";
      seoKeywords = data.seoKeywords || "";
      slug = data.slug || "";
      form.sizes = (data.sizes || []).join(", ");
      form.stock = data.stock || 0;
      form.special = data.special || false;
      form.freeShipping = Boolean(data.freeShipping);
      const stored = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
      cardImage = data.cardImage || "";
      existingImages =
        stored.length > 0 ? stored : cardImage ? [cardImage] : [];
      imageNames = cleanImageNames(data.imageNames, existingImages.length);

      const sizeStock = data.sizeStock || {};
      const sizes = data.sizes || [];
      if (sizes.length > 0 && Object.keys(sizeStock).length > 0) {
        form.stockPerSize = sizes.map((s: string) => sizeStock[s] || 0).join(",");
      }

      const colorInts = data.colors || [];
      if (colorInts.length > 0) {
        form.colors = colorInts.map((c: number) => {
          const hex = (c >>> 0).toString(16).padStart(8, "0").substring(2);
          return "#" + hex;
        }).join(", ");
      }

      if (data.variantStock && typeof data.variantStock === "object") {
        variantStockMatrix = { ...data.variantStock };
        hasVariantStock = true;
        variantStockEverEnabled = true;
      }

      parsedSizes = sizes;
      parsedColors = colorInts;
      colorImageIndices = Array.isArray(data.colorImageIndices)
        ? [...data.colorImageIndices]
        : [];
      colorLabels = Array.isArray(data.colorLabels) ? [...data.colorLabels] : [];
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  });

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

  function toggleVariantStock() {
    if (hasVariantStock) {
      hasVariantStock = false;
    } else {
      hasVariantStock = true;
      variantStockEverEnabled = true;
      for (let ci = 0; ci < parsedColors.length; ci++) {
        for (const size of parsedSizes) {
          const key = `${ci}-${size}`;
          if (!(key in variantStockMatrix)) {
            variantStockMatrix[key] = 0;
          }
        }
      }
    }
  }

  async function persistGallery() {
    const images = [...existingImages];
    const card = cardImage || images[0] || "";
    await updateDoc(doc(db, "product", productId), {
      images,
      imageNames: cleanImageNames(imageNames, images.length),
      cardImage: card || null
    });
    invalidateProductCatalog();
    await loadProductCatalog(true);
  }

  function showPhotoSuccess(message: string) {
    showSuccessToast(message);
  }

  async function onAddPhotos(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const picked = input.files;
    if (!picked?.length) return;
    const files = Array.from(picked);
    const needCard = !cardImage;
    addingPhotos = true;
    errorMsg = "";
    uploadStatus = `Preparing ${files.length} photo(s)…`;
    try {
      const galleryFiles = await Promise.all(files.map((file) => fileToGalleryJpeg(file)));
      uploadStatus = `Uploading ${files.length} photo(s)…`;
      const newUrls = await Promise.all(
        galleryFiles.map((galleryFile) => {
          const imageId = crypto.randomUUID();
          return uploadProductImage(galleryFile, imageId);
        })
      );
      existingImages = [...existingImages, ...newUrls];
      imageNames = [...cleanImageNames(imageNames, existingImages.length - newUrls.length), ...newUrls.map(() => "")];
      if (needCard && files[0]) {
        uploadStatus = "Saving shop thumbnail…";
        const cardFile = await fileToCardJpeg(files[0]);
        cardImage = await uploadProductImage(cardFile, `${crypto.randomUUID()}_card`);
      }
      uploadStatus = "Saving gallery…";
      await persistGallery();
      showPhotoSuccess(
        `Success — ${files.length} photo${files.length === 1 ? "" : "s"} uploaded and saved. Visible on the shop and app.`
      );
    } catch (err: any) {
      errorMsg = "Photo upload failed: " + (err.message || "Unknown error");
    } finally {
      addingPhotos = false;
      uploadStatus = "";
      input.value = "";
    }
  }

  async function setMainPhoto(index: number) {
    if (index <= 0 || index >= existingImages.length) return;
    const img = existingImages[index];
    existingImages = moveToFront(existingImages, index);
    imageNames = moveToFront(cleanImageNames(imageNames, existingImages.length), index);
    cardImage = img;
    try {
      await persistGallery();
      showPhotoSuccess("Success — main photo updated on the shop and app.");
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  async function handleSave() {
    saving = true;
    errorMsg = "";

    try {
      let uploadedImageUrls = [...existingImages];
      let nextCardImage = cardImage;

      if (!uploadedImageUrls.length && nextCardImage) {
        uploadedImageUrls = [nextCardImage];
      }
      if (!nextCardImage && uploadedImageUrls.length) {
        nextCardImage = uploadedImageUrls[0];
      }

      const sizes = form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(s => s) : null;
      const colors = parseColors(form.colors);

      let sizeStock: Record<string, number> = {};
      if (sizes && form.stockPerSize && (!colors || colors.length === 0)) {
        const stockValues = form.stockPerSize.split(",").map(s => parseInt(s.trim()) || 0);
        sizes.forEach((size, i) => {
          if (i < stockValues.length && stockValues[i] >= 0) {
            sizeStock[size] = stockValues[i];
          }
        });
      }

      const seo = resolveProductSeo(
        {
          name: form.name,
          category: form.category,
          description: form.description,
          price: parseFloat(form.price.toString()),
          groups: selectedGroups,
          productId
        },
        { seoTitle, seoDescription, seoKeywords, slug }
      );

      const updates: any = {
        name: form.name,
        nameLowercase: form.name.toLowerCase(),
        category: form.category,
        price: parseFloat(form.price.toString()),
        offerPercentage: form.offer > 0 ? parseFloat(form.offer.toString()) : null,
        saleStartAt: form.offer > 0 && form.saleStart ? new Date(form.saleStart).getTime() : null,
        saleEndAt: form.offer > 0 && form.saleEnd ? new Date(form.saleEnd).getTime() : null,
        ...deliveryFieldsFromSelection(form.deliveryEstimate),
        groups: selectedGroups,
        description: form.description.trim() ? form.description : null,
        sizes,
        colors,
        images: uploadedImageUrls,
        imageNames: cleanImageNames(imageNames, uploadedImageUrls.length),
        cardImage: nextCardImage,
        stock: parseInt(form.stock.toString()) || 0,
        sizeStock,
        special: form.special,
        freeShipping: Boolean(form.freeShipping),
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        seoKeywords: seo.seoKeywords,
        slug: seo.slug
      };

      if (colors && colors.length > 0) {
        updates.colorImageIndices = normalizeColorImageIndices(
          colors.length,
          uploadedImageUrls.length,
          colorImageIndices
        );
        updates.colorLabels = colorLabels.slice(0, colors.length);
      } else {
        updates.colorImageIndices = null;
        updates.colorLabels = null;
      }

      if (colors && colors.length > 0 && sizes && sizes.length > 0 && hasVariantStock) {
        const variantStock: Record<string, number> = {};
        for (let ci = 0; ci < colors.length; ci++) {
          for (const size of sizes) {
            const key = `${ci}-${size}`;
            variantStock[key] = variantStockMatrix[key] ?? 0;
          }
        }
        updates.variantStock = variantStock;
      } else if (variantStockEverEnabled && !hasVariantStock) {
        updates.variantStock = null;
      }

      await updateDoc(doc(db, "product", productId), updates);
      invalidateProductCatalog();
      await loadProductCatalog(true);
      goto("/products");
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      saving = false;
    }
  }

  async function removeImage(index: number) {
    const removed = existingImages[index];
    imageNames = cleanImageNames(imageNames, existingImages.length).filter((_, i) => i !== index);
    existingImages = existingImages.filter((_, i) => i !== index);
    if (cardImage === removed) {
      cardImage = existingImages[0] || "";
    }
    try {
      await persistGallery();
      showPhotoSuccess("Success — photo removed from the gallery.");
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  async function fetchImageBlob(url: string): Promise<Blob | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  async function reencodeImages() {
    fixingImages = true;
    errorMsg = "";
    try {
      const newUrls: string[] = [];
      let nextCard = "";
      for (let i = 0; i < existingImages.length; i++) {
        const url = existingImages[i];
        const original = await fetchImageBlob(url);
        if (!original) {
          newUrls.push(url);
          continue;
        }
        const gallery = await blobToGalleryJpeg(original);
        const imageId = crypto.randomUUID();
        const newUrl = await uploadProductImage(gallery, imageId);
        newUrls.push(newUrl);
        if (i === 0) {
          const card = await blobToCardJpeg(original);
          nextCard = await uploadProductImage(card, `${imageId}_card`);
        }
      }
      existingImages = newUrls;
      cardImage = nextCard || cardImage;
      await updateDoc(doc(db, "product", productId), {
        images: newUrls,
        cardImage
      });
      alert("Photos compressed for fast loading on phones.");
    } catch (e: any) {
      errorMsg = "Failed to compress: " + e.message;
    } finally {
      fixingImages = false;
    }
  }
</script>

<h1>Edit Product</h1>

{#if loading}
  <p>Loading product...</p>
{:else if errorMsg && !form.name}
  <div style="color: red">{errorMsg}</div>
{:else}
  {#if errorMsg}
    <div style="color: red; margin-bottom: 10px;">{errorMsg}</div>
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
        {#if form.category === "Recommended"}
          <small style="color:#b45309;display:block;margin-top:4px;">
            “Recommended” is now a group — pick a real category here and tick Recommended under Groups.
          </small>
        {/if}
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
      <label class="checkbox-label full-width">
        <input type="checkbox" bind:checked={form.freeShipping} />
        <span>Free shipping on this product (optional — shop shows it only when enabled)</span>
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
        <small>Leave dates empty for an unlimited offer. Set start and end for a timed sale.</small>
      </label>
      <fieldset class="full-width groups-box">
        <legend>Groups (tick all that apply — shows in shop filters like Men, Women, Recommended) · <a href="/groups">Manage groups</a></legend>
        <div class="groups-grid">
          {#each GROUP_OPTIONS as group}
            <label class="group-chip">
              <input type="checkbox" value={group} bind:group={selectedGroups} />
              <span>{group}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="full-width images-top">
        <span class="photos-label">Gallery photos (same product)</span>
        {#if existingImages.length}
          <p class="photo-count">{existingImages.length} in gallery</p>
          <div class="image-grid">
            {#each existingImages as url, i}
              <div class="photo-slot">
                <div class="image-thumb">
                  <img src={url} alt="Product photo {i + 1}" />
                  {#if i === 0}
                    <span class="main-badge">Main</span>
                  {:else}
                    <button type="button" class="thumb-main-btn" on:click={() => setMainPhoto(i)}>Main</button>
                  {/if}
                  <button
                    type="button"
                    class="remove-x"
                    aria-label="Remove photo"
                    on:click={() => removeImage(i)}>✕</button
                  >
                </div>
                <input
                  type="text"
                  class="photo-name-input"
                  placeholder="Name for photo {i + 1}, e.g. Black Versace T shirt"
                  aria-label="Name for photo {i + 1}"
                  bind:value={imageNames[i]}
                />
              </div>
            {/each}
          </div>
          <button type="button" class="btn-fix-images" on:click={reencodeImages} disabled={fixingImages}>
            {fixingImages ? "Compressing..." : "Compress photos for the shop app"}
          </button>
        {:else}
          <p class="photo-empty">No photos yet — add at least one below.</p>
        {/if}

        {#if addingPhotos && uploadStatus}
          <p class="upload-progress" role="status">{uploadStatus}</p>
        {/if}
        <label class="add-photos-btn">
          <input type="file" multiple accept="image/*" on:change={onAddPhotos} disabled={addingPhotos} />
          {addingPhotos ? "Please wait…" : "Add photos"}
        </label>
        <small>
          Tap <strong>Add photos</strong> as many times as you need. Each batch uploads right away. Type a
          <strong>name for each photo</strong> (e.g. “Black Versace T shirt”), then press
          <strong>Save Changes</strong> to save the names — customers can search by them.
        </small>
      </div>

      <label class="full-width">
        Product description
        <textarea bind:value={form.description} rows="4" placeholder="Materials, size, care, what's in the box…"></textarea>
        <small>Shown on the product page under Add to cart.</small>
      </label>

      <label>
        Sizes (comma-separated e.g. S,M,L)
        <input type="text" bind:value={form.sizes} />
      </label>
      <label>
        Total Stock (auto-calculated)
        <input type="number" bind:value={form.stock} min="0" step="1" required />
        <small>Auto-fills from Stock per Size or Variant Stock. You can also enter manually.</small>
      </label>
      {#if SHOW_COLOR_TOOLS}
        <div class="full-width">
          <span>Colors</span>
          <ColorPickerField bind:value={form.colors} bind:labels={colorLabels} />
          <ColorGalleryThumbs
            colors={parsedColors}
            colorLabels={colorLabels}
            imageUrls={existingImages}
            bind:indices={colorImageIndices}
          />
        </div>
      {/if}

      {#if parsedSizes.length > 0 && (!parsedColors || parsedColors.length === 0)}
        <label class="full-width">
          Stock per Size (comma-separated e.g. 2,7,3)
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
            <small>These values track exact stock for each color×size combination. Stock is decremented automatically when orders are confirmed.</small>
          {:else}
            <small>Check the box above to set individual stock for each color×size combination. Otherwise, "Total Stock" is shared across all variants.</small>
          {/if}
        </div>
      {/if}

      <label class="checkbox-label full-width">
        <input type="checkbox" bind:checked={form.special} />
        <span>Feature in shop “Recommended” (when any product is marked special)</span>
      </label>

      <div class="full-width">
        <ProductSeoFields
          name={form.name}
          category={form.category}
          description={form.description}
          price={form.price}
          groups={selectedGroups}
          productId={productId}
          bind:seoTitle
          bind:seoDescription
          bind:seoKeywords
          bind:slug
        />
      </div>
    </div>

    <div class="button-row">
      <button type="button" class="btn btn-cancel" on:click={() => goto("/products")}>Cancel</button>
      <button type="submit" class="btn btn-save" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  </form>
{/if}

<style>
  form {
    width: 100%;
    max-width: none;
    padding: 22px;
    background: #fff;
    border: 1px solid #e6edf5;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .images-top {
    padding: 14px;
    border: 1px dashed #fdba74;
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
    border: 1px solid #fdba74;
    border-radius: 8px;
    font-weight: 600;
    color: #c2410c;
    cursor: pointer;
    margin-top: 12px;
    margin-bottom: 8px;
  }
  .add-photos-btn input {
    display: none;
  }
  .photo-count {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
  }
  .photo-empty {
    margin: 0 0 8px;
    font-size: 13px;
    color: #64748b;
  }
  .upload-progress {
    margin: 10px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: #c2410c;
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
    border-color: #f97316;
    background: #fff7ed;
    color: #9a3412;
  }
  .group-chip input {
    width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
    flex: 0 0 auto;
    accent-color: #f97316;
    cursor: pointer;
  }
  .group-chip span {
    line-height: 1.2;
  }
  .button-row {
    display: flex;
    gap: 10px;
  }
  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    color: white;
  }
  .btn-save {
    background: #f97316;
  }
  .btn-cancel {
    background: #6c757d;
  }
  .btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  .btn-fix-images {
    margin-top: 10px;
    padding: 8px 16px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }
  .btn-fix-images:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .btn-fix-images:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }
  .image-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
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
  .image-thumb {
    position: relative;
    flex-shrink: 0;
    width: 120px;
    height: 120px;
    border-radius: 6px;
    overflow: hidden;
    border: 2px solid #dee2e6;
  }
  .main-badge {
    position: absolute;
    left: 4px;
    bottom: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(234, 88, 12, 0.92);
    color: #fff;
  }
  .thumb-main-btn {
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
  .image-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .remove-x {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    cursor: pointer;
    padding: 0;
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
    background: #f97316;
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
