<script>
  import { onMount, onDestroy } from "svelte";
  import TemuIcon from "./TemuIcon.svelte";
  import { openCartDrawer } from "../lib/stores/cart.js";

  /** Full-screen product photos (Temu-style). Mobile: swipe; desktop: arrows + left strip. */
  export let images = [];
  export let names = [];
  export let index = 0;
  export let title = "";
  export let shareUrl = "";
  export let onClose = () => {};
  export let onAddToCart = () => {};

  $: count = images.length;
  $: name = (names[index] || "").trim();

  function go(i) {
    if (!count) return;
    index = (i + count) % count;
  }

  function onKey(e) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
  }

  // Swipe left / right (pointer events work for finger and mouse; the image is not draggable).
  let swipeStartX = null;
  function onPointerDown(e) {
    swipeStartX = e.clientX;
  }
  function onPointerUp(e) {
    if (swipeStartX == null) return;
    const dx = e.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(dx) >= 40) go(index + (dx < 0 ? 1 : -1));
  }

  async function share() {
    const url = shareUrl || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, "_blank", "noopener");
  }

  let prevOverflow = "";
  onMount(() => {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
  });
  onDestroy(() => {
    document.body.style.overflow = prevOverflow;
    window.removeEventListener("keydown", onKey);
  });
</script>

<div class="viewer" role="dialog" aria-modal="true" aria-label="Product photos">
  <!-- Mobile top bar: close · counter · share -->
  <div class="top-bar">
    <button type="button" class="icon-btn" aria-label="Close" on:click={onClose}>
      <TemuIcon name="x" size={22} color="#fff" strokeWidth={2} />
    </button>
    <span class="counter">{index + 1}/{count}</span>
    <button type="button" class="icon-btn" aria-label="Share" on:click={share}>
      <TemuIcon name="share" size={20} color="#fff" strokeWidth={2} />
    </button>
  </div>

  <!-- Desktop close (top-right) -->
  <button type="button" class="close-desktop" aria-label="Close" on:click={onClose}>
    <TemuIcon name="x" size={28} color="#fff" strokeWidth={2} />
  </button>

  {#if count > 1}
    <div class="strip" aria-label="All photos">
      {#each images as src, i}
        <button
          type="button"
          class:active={i === index}
          aria-label={names[i] || `Photo ${i + 1}`}
          on:click={() => go(i)}
        >
          <img {src} alt="" loading="lazy" decoding="async" />
        </button>
      {/each}
    </div>
  {/if}

  <div class="stage">
    {#if count > 1}
      <button type="button" class="arrow prev" aria-label="Previous photo" on:click={() => go(index - 1)}>
        <TemuIcon name="chevronLeft" size={26} color="#121212" strokeWidth={2.25} />
      </button>
    {/if}
    <div
      class="photo"
      on:pointerdown={onPointerDown}
      on:pointerup={onPointerUp}
      on:pointercancel={() => (swipeStartX = null)}
    >
      <img src={images[index]} alt={name || title} draggable="false" />
      {#if name}
        <span class="label">Items: {name}</span>
      {/if}
    </div>
    {#if count > 1}
      <button type="button" class="arrow next" aria-label="Next photo" on:click={() => go(index + 1)}>
        <TemuIcon name="chevronRight" size={26} color="#121212" strokeWidth={2.25} />
      </button>
    {/if}
  </div>

  <div class="bottom">
    <button type="button" class="cart-round" aria-label="Open cart" on:click={() => { onClose(); openCartDrawer(); }}>
      <TemuIcon name="cart" size={18} color="#169d4a" strokeWidth={2} />
      <span>Cart</span>
    </button>
    <button type="button" class="add" on:click={() => onAddToCart(index)}>Add to cart</button>
  </div>
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .top-bar {
    display: none;
  }
  .icon-btn {
    border: none;
    background: none;
    padding: 8px;
    cursor: pointer;
    display: flex;
  }
  .close-desktop {
    position: absolute;
    top: 18px;
    right: 22px;
    border: none;
    background: none;
    cursor: pointer;
    padding: 6px;
    display: flex;
    z-index: 2;
  }
  /* Desktop: vertical strip of photos on the left. */
  .strip {
    position: absolute;
    left: 32px;
    top: 50%;
    transform: translateY(-50%);
    max-height: 86vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px;
  }
  .strip button {
    width: 96px;
    height: 96px;
    padding: 0;
    border: 3px solid transparent;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    flex-shrink: 0;
    overflow: hidden;
  }
  .strip button.active {
    border-color: var(--temu-orange, #f97316);
  }
  .strip img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .stage {
    display: flex;
    align-items: center;
    gap: 28px;
  }
  .photo {
    position: relative;
    display: flex;
    justify-content: center;
    /* Horizontal swipes come to us; vertical scrolling / pinch still work. */
    touch-action: pan-y pinch-zoom;
    user-select: none;
    -webkit-user-select: none;
  }
  /* Bigger than Temu's desktop viewer. */
  .photo img {
    height: 82vh;
    width: min(82vh, 70vw);
    object-fit: contain;
    display: block;
    background: #fff;
  }
  .label {
    position: absolute;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    max-width: 90%;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .arrow {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: none;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .bottom {
    margin-top: 18px;
    width: min(520px, 90vw);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cart-round {
    display: none;
  }
  .add {
    flex: 1;
    border: none;
    border-radius: 999px;
    background: var(--temu-orange, #f97316);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    padding: 14px;
    cursor: pointer;
  }

  /* Phone: black screen, top bar, swipe, Add to cart at the bottom. */
  @media (max-width: 899px) {
    .viewer {
      background: #000;
      justify-content: space-between;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 8px 8px 0;
      box-sizing: border-box;
    }
    .counter {
      color: #fff;
      font-size: 15px;
      font-weight: 600;
    }
    .close-desktop,
    .strip,
    .arrow {
      display: none;
    }
    .stage {
      flex: 1;
      width: 100%;
    }
    .photo {
      width: 100%;
    }
    .photo img {
      width: 100%;
      height: auto;
      max-height: 70vh;
      aspect-ratio: 1;
    }
    .label {
      font-size: 12px;
      bottom: 10px;
    }
    .bottom {
      width: 100%;
      margin: 0;
      padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
      box-sizing: border-box;
    }
    .cart-round {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2px solid #169d4a;
      background: #fff;
      color: #169d4a;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }
    .add {
      font-size: 16px;
      padding: 13px;
    }
  }
</style>
