<script>
  import ProductCard from "./ProductCard.svelte";
  import { thumbForSub } from "../lib/categoryMenu.js";
  export let title = "Shop";
  export let chips = [];
  export let activeChipId = "all";
  export let products = [];
  export let allProducts = [];
  export let categoryImages = {};
  export let browseMode = "recommended";
  export let group = null;
  export let onPickChip = () => {};
  export let onOpenProduct = () => {};
  export let onAddToCart = () => {};
  export let onBack = () => {};

  let scroller;

  function chipThumb(chip) {
    const sub = {
      label: chip.label,
      filterCategory: chip.filterCategory,
      query: chip.query,
      imageUrl: chip.imageUrl
    };
    return thumbForSub(sub, allProducts, categoryImages);
  }
</script>

<div class="browse">
  <header class="browse-head">
    <button type="button" class="back" on:click={onBack}><i class="fa fa-arrow-left" aria-hidden="true"></i> Back</button>
    <h1>{title}</h1>
  </header>

  {#if chips.length > 1}
    <div class="chip-row" bind:this={scroller} role="tablist" aria-label="Subcategories">
      {#each chips as chip (chip.id)}
        <button
          type="button"
          role="tab"
          aria-selected={activeChipId === chip.id}
          class:active={activeChipId === chip.id}
          on:click={() => onPickChip(chip)}
        >
          <span class="chip-thumb">
            <img src={chipThumb(chip)} alt="" loading="lazy" decoding="async" />
          </span>
          <span class="chip-label">{chip.label}</span>
        </button>
      {/each}
    </div>
  {/if}

  <p class="count" aria-live="polite">
    {products.length} {products.length === 1 ? "item" : "items"}
  </p>

  {#if products.length === 0}
    <p class="empty">No products in this section yet. Check back soon or try another category.</p>
  {:else}
    <div class="product-grid">
      {#each products as product, i (product.id)}
        <ProductCard {product} index={i} onOpen={onOpenProduct} onAddToCart={onAddToCart} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .browse {
    padding: 0 0 16px;
  }
  .browse-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .back {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.2;
  }
  .chip-row {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 4px 2px 12px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .chip-row::-webkit-scrollbar {
    display: none;
  }
  .chip-row button {
    flex-shrink: 0;
    width: 72px;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: center;
  }
  .chip-thumb {
    display: block;
    width: 64px;
    height: 64px;
    margin: 0 auto;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid transparent;
    background: #f3f4f6;
  }
  .chip-row button.active .chip-thumb {
    border-color: #1673c4;
    box-shadow: 0 0 0 1px #1673c4;
  }
  .chip-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .chip-label {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.2;
    color: #333;
    max-width: 72px;
    margin-left: auto;
    margin-right: auto;
  }
  .chip-row button.active .chip-label {
    font-weight: 700;
    color: #1b1512;
  }
  .count {
    margin: 0 0 10px;
    font-size: 13px;
    color: #666;
  }
  .empty {
    text-align: center;
    padding: 32px 16px;
    color: #666;
    font-size: 14px;
  }
  .product-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  @media (min-width: 520px) {
    .product-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 900px) {
    .product-grid {
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
  }
  @media (min-width: 1280px) {
    .product-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
</style>
