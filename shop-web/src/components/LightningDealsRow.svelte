<script>
  import { onDestroy } from "svelte";
  import { coverUrl, formatUgx, priceParts, stockPhotoForProduct } from "../lib/catalog.js";

  export let products = [];
  export let onOpen = () => {};
  export let onSeeAll = () => {};

  let endsAt = Date.now() + 4 * 60 * 60 * 1000 + 23 * 60 * 1000;
  let remaining = "";

  const tick = () => {
    const diff = Math.max(0, endsAt - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    remaining = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  tick();
  const id = setInterval(tick, 1000);
  onDestroy(() => clearInterval(id));

  $: deals = products.slice(0, 12);

  function dealImage(product) {
    const url = coverUrl(product);
    if (url && /^https?:\/\//i.test(url)) return url;
    return stockPhotoForProduct(product, 240);
  }

  function onImgError(e, product) {
    const fallback = stockPhotoForProduct(product, 240);
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
    }
  }
</script>

<section class="lightning" aria-label="Lightning deals">
  <div class="head">
    <div class="title">
      <span class="bolt" aria-hidden="true"><i class="fa fa-bolt"></i></span>
      <strong>Lightning deals</strong>
      <span class="ends">Ends in {remaining}</span>
    </div>
    <button type="button" class="more" on:click={onSeeAll}>See all</button>
  </div>
  <div class="scroller">
    {#each deals as product, i (product.id)}
      {@const prices = priceParts(product)}
      {@const img = dealImage(product)}
      <button type="button" class="deal" on:click={() => onOpen(product)}>
        <div class="pic">
          <img
            src={img}
            alt=""
            loading={i < 6 ? "eager" : "lazy"}
            decoding="async"
            on:error={(e) => onImgError(e, product)}
          />
          {#if prices.discount}
            <span class="off">{prices.discount}</span>
          {/if}
        </div>
        <span class="price">{formatUgx(prices.current)}</span>
        {#if prices.old}
          <span class="was">{formatUgx(prices.old)}</span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .lightning {
    background: linear-gradient(180deg, #eef7fc 0%, #fff 40%);
    border: 1px solid #cbe8f7;
    border-radius: 6px;
    padding: 10px 0 12px;
    margin: 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 8px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .bolt {
    font-size: 18px;
  }
  .title strong {
    font-size: var(--text-md);
    color: #121212;
  }
  .ends {
    font-size: var(--text-xs);
    color: var(--temu-orange);
    font-weight: 600;
    background: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #b9e0f5;
  }
  .more {
    border: none;
    background: transparent;
    color: #666;
    font-size: 13px;
    cursor: pointer;
  }
  .scroller {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 0 12px 4px;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }
  .deal {
    flex: 0 0 108px;
    border: none;
    background: #fff;
    border-radius: 6px;
    padding: 6px;
    cursor: pointer;
    text-align: left;
    border: 1px solid #f0f0f0;
    scroll-snap-align: start;
  }
  @media (max-width: 900px) {
    .deal {
      flex: 0 0 100px;
    }
  }
  .pic {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    background: #f6f6f6;
    min-height: 96px;
  }
  .pic img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
    min-height: 96px;
    background: #f3f4f6;
  }
  .off {
    position: absolute;
    left: 0;
    top: 0;
    background: var(--temu-orange);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 0 0 4px 0;
  }
  .price {
    display: block;
    margin-top: 6px;
    font-size: 14px;
    font-weight: 700;
    color: #121212;
  }
  .was {
    font-size: 11px;
    color: #999;
    text-decoration: line-through;
  }
</style>
