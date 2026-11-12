<script>
  import TemuIcon from "./TemuIcon.svelte";
  import {
    coverUrl,
    stockPhotoForProduct,
    formatUgx,
    priceParts,
    soldLabel,
    reviewCount,
    urgencyLabel,
    stockLabel,
    productStock
  } from "../lib/catalog.js";
  import { deliveryArrivalLine } from "../lib/delivery.js";

  export let product;
  export let index = 0;
  export let onOpen = () => {};
  export let onAddToCart = () => {};

  let imgError = false;

  $: prices = priceParts(product);
  $: shownPrice =
    prices?.salePending && prices.displayNow != null ? prices.displayNow : prices?.current;
  $: struckPrice =
    prices?.salePending && prices.displayOld != null ? prices.displayOld : prices?.old;
  $: primary = coverUrl(product);
  $: img =
    !imgError && primary ? primary : stockPhotoForProduct(product, 480);
  $: urgency = urgencyLabel(product, index);
  $: reviews = reviewCount(product);
  $: arrival = deliveryArrivalLine(product);
  $: stockText = stockLabel(product);
  $: outOfStock = productStock(product) <= 0;
</script>

<article class="card">
  <button type="button" class="img-wrap" on:click={() => onOpen(product)}>
    <img src={img} alt={product.name} loading="lazy" on:error={() => (imgError = true)} />
    {#if prices.discount}
      <span class="tag-off">{prices.discount}</span>
    {/if}
    {#if urgency}
      <span class="tag-urgent">{urgency}</span>
    {/if}
    <span class="ship-pill">Free shipping</span>
  </button>
  <div class="body">
    <button type="button" class="title" on:click={() => onOpen(product)}>{product.name}</button>
    <div class="price-row">
      <span class="price">{formatUgx(shownPrice)}</span>
      <span class="sold-inline">{soldLabel(product)}</span>
      <button
        type="button"
        class="cart-fab"
        aria-label="Add to cart"
        on:click|stopPropagation={() => onAddToCart(product)}
      >
        <TemuIcon name="cart" size={16} color="#121212" strokeWidth={2} />
      </button>
    </div>
    {#if struckPrice}
      <p class="was-line">{formatUgx(struckPrice)}</p>
    {/if}
    <div class="meta">
      {#if reviews > 0}
        <span class="stars">★★★★★</span>
        <span>{reviews}</span>
      {/if}
      <span class="stock-line" class:out={outOfStock}>{stockText}</span>
    </div>
    <p class="ship-text">{arrival}</p>
  </div>
</article>

<style>
  .card {
    background: #fff;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .img-wrap {
    position: relative;
    border: none;
    padding: 0;
    background: #f3f3f3;
    cursor: pointer;
    width: 100%;
    display: block;
  }
  .img-wrap img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
  }
  .tag-off {
    position: absolute;
    left: 0;
    top: 0;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 6px;
    border-radius: 0 0 4px 0;
  }
  .tag-urgent {
    position: absolute;
    left: 0;
    bottom: 28px;
    background: #fff3e8;
    color: var(--header-orange);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
  }
  .ship-pill {
    position: absolute;
    left: 4px;
    bottom: 4px;
    background: rgba(255, 255, 255, 0.95);
    color: var(--trust-green);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .body {
    padding: 6px 6px 8px;
    text-align: left;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  /* Temu-style card: one-line name, large bold price, outlined cart button. */
  .title {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    font-size: 14px;
    line-height: 1.35;
    color: #222;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
    font-weight: 400;
  }
  .price-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }
  .price {
    font-size: 18px;
    font-weight: 800;
    color: #121212;
    white-space: nowrap;
  }
  .sold-inline {
    font-size: 13px;
    color: #777;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cart-fab {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid #121212;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .was-line {
    margin: 2px 0 0;
    font-size: 13px;
    color: #999;
    text-decoration: line-through;
  }
  .meta {
    margin-top: 4px;
    font-size: 13px;
    color: #888;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .stars {
    color: #121212;
    font-size: 10px;
    letter-spacing: -1px;
  }
  .stock-line {
    color: var(--trust-green);
    font-weight: 600;
  }
  .stock-line.out {
    color: #13344f;
  }
  .ship-text {
    margin: 4px 0 0;
    font-size: 12px;
    color: #666;
  }
  @media (max-width: 900px) {
    .title {
      font-size: 12px;
    }
    .price {
      font-size: 15px;
    }
    .sold-inline {
      font-size: 11px;
    }
    .meta {
      font-size: 10px;
      gap: 4px;
    }
    .ship-text,
    .was-line {
      display: none;
    }
    .ship-pill {
      font-size: 9px;
      padding: 1px 4px;
    }
    .cart-fab {
      width: 28px;
      height: 28px;
    }
  }
</style>
