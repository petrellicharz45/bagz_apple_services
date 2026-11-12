<script lang="ts">
  import { buildProductSeo } from "$lib/seo/productSeo";

  export let name = "";
  export let category = "";
  export let description = "";
  export let price = 0;
  export let groups: string[] = [];
  export let productId = "";

  export let seoTitle = "";
  export let seoDescription = "";
  export let seoKeywords = "";
  export let slug = "";

  let seoTouched = false;

  function autoFill() {
    const built = buildProductSeo({
      name,
      category,
      description,
      price: Number(price) || 0,
      groups,
      productId
    });
    seoTitle = built.seoTitle;
    seoDescription = built.seoDescription;
    seoKeywords = built.seoKeywords;
    slug = built.slug;
    seoTouched = false;
  }

  $: if (name && category && !seoTouched && !seoTitle) {
    autoFill();
  }

  function markTouched() {
    seoTouched = true;
  }
</script>

<fieldset class="seo-box">
  <legend>SEO (Google &amp; search engines)</legend>
  <p class="hint">
    Filled automatically from name, category, and description. Edit if you want — saved with each product.
  </p>
  <button type="button" class="regen" on:click={autoFill}>↻ Regenerate SEO</button>

  <label>
    SEO title <small>(~60 chars)</small>
    <input type="text" bind:value={seoTitle} maxlength="70" on:input={markTouched} />
    <small>{seoTitle.length} characters</small>
  </label>

  <label>
    Meta description <small>(~155 chars)</small>
    <textarea bind:value={seoDescription} rows="3" maxlength="200" on:input={markTouched} />
    <small>{seoDescription.length} characters</small>
  </label>

  <label>
    Meta keywords <small>(comma-separated)</small>
    <textarea bind:value={seoKeywords} rows="2" on:input={markTouched} />
  </label>

  <label>
    URL slug
    <input type="text" bind:value={slug} on:input={markTouched} />
    <small>Shop link: /p/{slug || "your-slug"}</small>
  </label>
</fieldset>

<style>
  .seo-box {
    grid-column: 1 / -1;
    border: 1px solid #9fd6f0;
    border-radius: 8px;
    padding: 14px 16px;
    background: #fffbeb;
  }
  .hint {
    margin: 0 0 10px;
    font-size: 13px;
    color: #78350f;
  }
  .regen {
    margin-bottom: 12px;
    border: 1px solid #135fa3;
    background: #fff;
    color: #13344f;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  label {
    display: block;
    margin-bottom: 12px;
    font-size: 14px;
  }
  input,
  textarea {
    display: block;
    width: 100%;
    margin-top: 4px;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font: inherit;
  }
  small {
    color: #6b7280;
    font-size: 12px;
  }
</style>
