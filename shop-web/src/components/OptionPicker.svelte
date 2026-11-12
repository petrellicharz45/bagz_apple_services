<script>
  import { onMount, onDestroy } from "svelte";
  import TemuIcon from "./TemuIcon.svelte";
  import { formatUgx } from "../lib/catalog.js";

  /**
   * Temu-style "select options" box opened from full-screen Add to cart when no size
   * was picked yet. Desktop: centred box. Mobile: panel sliding up from the bottom.
   */
  export let title = "";
  export let images = [];
  export let names = [];
  export let photoIndex = 0;
  export let sizes = [];
  /** Size the customer has actively chosen ("" = not chosen yet). */
  export let size = "";
  export let qty = 1;
  export let price = 0;
  export let wasPrice = 0;
  export let discount = "";
  export let freeShipping = false;
  export let onClose = () => {};
  export let onConfirm = () => {};

  let warn = false;
  $: needsSize = sizes.length > 0 && !size;
  $: count = images.length;

  function go(i) {
    if (count) photoIndex = (i + count) % count;
  }

  function confirm() {
    if (needsSize) {
      warn = true;
      return;
    }
    onConfirm();
  }

  function onKey(e) {
    if (e.key === "Escape") onClose();
  }
  onMount(() => window.addEventListener("keydown", onKey));
  onDestroy(() => window.removeEventListener("keydown", onKey));
</script>

<div class="backdrop" role="presentation" on:click|self={onClose}>
  <div class="box" role="dialog" aria-modal="true" aria-label="Select options">
    <!-- Mobile header bar -->
    <div class="sheet-head">
      <span>{discount ? "BIG SALE" : "Select options"}</span>
      <button type="button" class="head-close" aria-label="Close" on:click={onClose}>
        <TemuIcon name="x" size={18} color="#fff" strokeWidth={2.25} />
      </button>
    </div>
    <button type="button" class="box-close" aria-label="Close" on:click={onClose}>
      <TemuIcon name="x" size={26} color="#121212" strokeWidth={2} />
    </button>

    <!-- Desktop: photo carousel + thumbnails -->
    <div class="gallery">
      <div class="big">
        <img src={images[photoIndex]} alt={names[photoIndex] || title} />
        {#if count > 1}
          <button type="button" class="arrow prev" aria-label="Previous photo" on:click={() => go(photoIndex - 1)}>
            <TemuIcon name="chevronLeft" size={22} color="#121212" strokeWidth={2.25} />
          </button>
          <button type="button" class="arrow next" aria-label="Next photo" on:click={() => go(photoIndex + 1)}>
            <TemuIcon name="chevronRight" size={22} color="#121212" strokeWidth={2.25} />
          </button>
        {/if}
      </div>
      {#if count > 1}
        <div class="thumbs">
          {#each images as src, i}
            <button type="button" class:active={i === photoIndex} aria-label={names[i] || `Photo ${i + 1}`} on:click={() => go(i)}>
              <img {src} alt="" loading="lazy" decoding="async" />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="options">
      <!-- Mobile summary: photo, name, price -->
      <div class="summary">
        <img src={images[photoIndex]} alt="" />
        <div>
          <p class="sum-title">{names[photoIndex] || title}</p>
          <p class="sum-price">
            <strong>{formatUgx(price)}</strong>
            {#if wasPrice}<del>{formatUgx(wasPrice)}</del>{/if}
            {#if discount}<span class="off">{discount} OFF</span>{/if}
          </p>
        </div>
      </div>

      {#if count > 1}
        <div class="choices">
          {#each images as src, i}
            <button type="button" class="choice" class:active={i === photoIndex} on:click={() => go(i)}>
              <img {src} alt="" loading="lazy" decoding="async" />
              {#if names[i]}<span>{names[i]}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if sizes.length}
        <p class="size-label" class:warn={warn && needsSize}>
          Size:
          {#if warn && needsSize}
            <span>ⓘ Please select size!</span>
          {:else if size}
            <strong>{size}</strong>
          {/if}
        </p>
        <div class="sizes">
          {#each sizes as s}
            <button type="button" class:active={size === s} on:click={() => { size = s; warn = false; }}>{s}</button>
          {/each}
        </div>
      {/if}

      {#if freeShipping}
        <p class="benefits-title">Service/Benefits</p>
        <span class="benefit">FREE SHIPPING</span>
      {/if}

      <div class="qty">
        <span>Qty</span>
        <div class="stepper">
          <button type="button" aria-label="Less" on:click={() => (qty = Math.max(1, qty - 1))}>−</button>
          <span>{qty}</span>
          <button type="button" aria-label="More" on:click={() => (qty = Math.min(99, qty + 1))}>+</button>
        </div>
      </div>

      <button type="button" class="confirm" on:click={confirm}>
        {needsSize ? "Select an option" : "Add to cart"}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1010;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .box {
    position: relative;
    width: min(1180px, 92vw);
    max-height: 90vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 8px;
    padding: 56px 56px 48px;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 48px;
  }
  .sheet-head,
  .summary {
    display: none;
  }
  .box-close {
    position: absolute;
    top: 18px;
    right: 22px;
    border: none;
    background: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
  }
  .big {
    position: relative;
    background: #f6f6f6;
  }
  .big img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    display: block;
  }
  .arrow {
    position: absolute;
    top: 16px;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    border: none;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .arrow.prev {
    left: 16px;
  }
  .arrow.next {
    right: 16px;
  }
  .thumbs {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
  }
  .thumbs button {
    width: 76px;
    height: 76px;
    padding: 0;
    border: 2px solid transparent;
    background: #fff;
    cursor: pointer;
    flex-shrink: 0;
  }
  .thumbs button.active {
    border-color: #121212;
  }
  .thumbs img,
  .choice img {
    width: 100%;
    object-fit: cover;
    display: block;
  }
  .thumbs img {
    height: 100%;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 22px;
  }
  .choice {
    width: 120px;
    padding: 0 0 6px;
    border: 2px solid #e5e5e5;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
    color: #222;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }
  .choice img {
    height: 110px;
  }
  .choice span {
    padding: 0 4px;
    line-height: 1.25;
  }
  .choice.active {
    border-color: #121212;
  }
  .size-label {
    margin: 0 0 12px;
    font-size: 18px;
    color: #222;
  }
  .size-label.warn,
  .size-label.warn span {
    color: #d92d20;
  }
  .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
  }
  .sizes button {
    min-width: 64px;
    padding: 9px 20px;
    border: 1px solid #cfcfcf;
    border-radius: 999px;
    background: #fff;
    font-size: 17px;
    color: #222;
    cursor: pointer;
  }
  .sizes button.active {
    border: 2px solid #121212;
    padding: 8px 19px;
    font-weight: 600;
  }
  .benefits-title {
    margin: 0 0 10px;
    font-size: 17px;
    font-weight: 600;
    color: #169d4a;
  }
  .benefit {
    display: inline-block;
    padding: 8px 22px;
    border: 2px solid #121212;
    border-radius: 999px;
    color: #169d4a;
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 24px;
  }
  .qty {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 28px;
    font-size: 17px;
  }
  .stepper {
    display: flex;
    align-items: center;
    border: 1px solid #ddd;
    border-radius: 6px;
  }
  .stepper button {
    border: none;
    background: none;
    width: 38px;
    height: 38px;
    font-size: 20px;
    cursor: pointer;
  }
  .stepper span {
    min-width: 32px;
    text-align: center;
  }
  .confirm {
    width: 100%;
    border: none;
    border-radius: 999px;
    background: var(--temu-orange, #2ba8e0);
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    padding: 18px;
    cursor: pointer;
  }

  /* Phone: bottom sheet. */
  @media (max-width: 899px) {
    .backdrop {
      align-items: flex-end;
    }
    .box {
      width: 100%;
      max-height: 82vh;
      border-radius: 12px 12px 0 0;
      padding: 0 0 calc(14px + env(safe-area-inset-bottom, 0px));
      display: block;
    }
    .box-close,
    .gallery {
      display: none;
    }
    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--temu-orange, #2ba8e0);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      font-style: italic;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .head-close {
      border: none;
      background: none;
      padding: 2px;
      display: flex;
      cursor: pointer;
    }
    .options {
      padding: 12px;
    }
    .summary {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }
    .summary img {
      width: 64px;
      height: 64px;
      object-fit: cover;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .sum-title {
      margin: 0 0 4px;
      font-size: 13px;
      color: #222;
    }
    .sum-price {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px;
      font-size: 12px;
    }
    .sum-price strong {
      color: var(--temu-orange, #2ba8e0);
      font-size: 16px;
    }
    .sum-price del {
      color: #999;
    }
    .off {
      color: var(--temu-orange, #2ba8e0);
      border: 1px solid currentColor;
      padding: 0 4px;
      border-radius: 3px;
      font-size: 11px;
    }
    .choices {
      gap: 8px;
      margin-bottom: 16px;
    }
    .choice {
      width: calc((100% - 16px) / 3);
      font-size: 12px;
    }
    .choice img {
      height: auto;
      aspect-ratio: 1;
    }
    .size-label {
      font-size: 14px;
    }
    .sizes {
      gap: 8px;
      margin-bottom: 16px;
    }
    .sizes button {
      min-width: 48px;
      font-size: 14px;
      padding: 7px 14px;
    }
    .sizes button.active {
      padding: 6px 13px;
    }
    .benefits-title {
      font-size: 13px;
    }
    .benefit {
      font-size: 13px;
      padding: 5px 14px;
      margin-bottom: 16px;
    }
    .qty {
      font-size: 14px;
      margin-bottom: 16px;
    }
    .confirm {
      font-size: 16px;
      padding: 13px;
    }
  }
</style>
