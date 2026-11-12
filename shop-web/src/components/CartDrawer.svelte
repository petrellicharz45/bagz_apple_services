<script>
  import {
    cartItems,
    cartDrawerOpen,
    cartSubtotal,
    closeCartDrawer,
    removeLine,
    updateQty,
    MIN_CHECKOUT_UGX
  } from "../lib/stores/cart.js";
  import { formatUgx, priceParts, coverUrl } from "../lib/catalog.js";
  import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "../lib/shopContact.js";
  import TemuIcon from "./TemuIcon.svelte";

  export let onGoCart = () => {};
  export let onCheckout = () => {};

  $: items = $cartItems;
  $: subtotal = $cartSubtotal;
  $: selected = items.filter((x) => x.selected);
  $: selectedTotal = selected.reduce(
    (s, line) => s + priceParts(line.product).current * line.qty,
    0
  );
  $: needMore = Math.max(0, MIN_CHECKOUT_UGX - selectedTotal);

  function img(line) {
    return (
      coverUrl(line.product) ||
      `https://picsum.photos/seed/${encodeURIComponent(line.productId)}/120/120`
    );
  }
</script>

{#if $cartDrawerOpen}
  <button type="button" class="backdrop" aria-label="Close cart" on:click={closeCartDrawer} />
  <aside class="drawer">
    <header class="sub-head">
      <TemuIcon name="cart" size={22} color="#fff" />
      <span>Subtotal</span>
      <button type="button" class="close" aria-label="Close" on:click={closeCartDrawer}>
        <TemuIcon name="x" size={20} color="#fff" />
      </button>
    </header>
    <div class="sub-body">
      <p class="sub-price">{formatUgx(selectedTotal || subtotal)}</p>
      <p class="ship-ok">✓ Free shipping on eligible orders</p>
      {#if needMore > 0}
        <button type="button" class="checkout min" disabled>
          {formatUgx(MIN_CHECKOUT_UGX)} min. to checkout
        </button>
      {/if}
      <button type="button" class="checkout" on:click={onCheckout} disabled={items.length === 0}>
        Proceed to checkout
      </button>
      <button type="button" class="ghost" on:click={onGoCart}>Go to cart</button>
      <button type="button" class="keep" on:click={closeCartDrawer}>Keep shopping</button>
      <p class="help-hint">
        Need help?
        <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
        ·
        <a href="tel:{SUPPORT_PHONE_TEL}">{SUPPORT_PHONE_DISPLAY}</a>
      </p>
    </div>

    <div class="list">
      {#if items.length === 0}
        <p class="empty">Your cart is empty. Add items from the shop.</p>
      {:else}
        {#each items as line (line.productId + line.size + line.color)}
          {@const prices = priceParts(line.product)}
          <div class="line">
            <img src={img(line)} alt="" />
            <div class="info">
              <p class="name">{line.product.name}</p>
              <p class="opts">{line.color} · {line.size}</p>
              <p class="price">{formatUgx(prices.current)}</p>
              <div class="qty">
                <button
                  type="button"
                  on:click={() => updateQty(line.productId, line.size, line.color, line.qty - 1)}
                >
                  −
                </button>
                <span>{line.qty}</span>
                <button
                  type="button"
                  on:click={() => updateQty(line.productId, line.size, line.color, line.qty + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              class="remove"
              aria-label="Remove"
              on:click={() => removeLine(line.productId, line.size, line.color)}
            >
              <TemuIcon name="x" size={16} color="#999" />
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </aside>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    border: none;
    z-index: 80;
    cursor: pointer;
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: min(380px, 100vw);
    height: 100%;
    background: #fff;
    z-index: 90;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  }
  .sub-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    background: linear-gradient(135deg, #1b1512, #3d2919);
    color: #fff;
    font-weight: 700;
    font-size: var(--text-md);
  }
  .sub-head .close {
    margin-left: auto;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 4px;
  }
  .sub-body {
    padding: 14px 16px;
    border-bottom: 1px solid #eee;
  }
  .sub-price {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 800;
  }
  .ship-ok {
    margin: 0 0 12px;
    font-size: var(--text-xs);
    color: var(--trust-green);
    font-weight: 600;
  }
  .checkout {
    width: 100%;
    border: none;
    background: var(--temu-orange);
    color: #fff;
    font-weight: 700;
    font-size: var(--text-sm);
    padding: 12px;
    border-radius: 999px;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .checkout.min {
    opacity: 0.85;
    cursor: not-allowed;
  }
  .ghost {
    width: 100%;
    border: 1px solid #ddd;
    background: #fff;
    padding: 10px;
    border-radius: 999px;
    font-size: var(--text-sm);
    cursor: pointer;
    margin-bottom: 8px;
  }
  .keep {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--temu-orange);
    font-weight: 700;
    font-size: var(--text-sm);
    padding: 8px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .help-hint {
    margin: 12px 0 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-secondary);
    text-align: center;
  }
  .help-hint a {
    color: #c2410c;
    text-decoration: none;
    font-weight: 600;
  }
  .help-hint a:hover {
    text-decoration: underline;
  }
  .list {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }
  .empty {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-align: center;
    padding: 24px;
  }
  .line {
    display: grid;
    grid-template-columns: 72px 1fr auto;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .line img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 6px;
    background: #f5f5f5;
  }
  .name {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .opts {
    margin: 4px 0;
    font-size: 11px;
    color: #888;
  }
  .price {
    margin: 0;
    font-weight: 700;
    font-size: var(--text-sm);
  }
  .qty {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 2px 6px;
    font-size: var(--text-xs);
  }
  .qty button {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
  }
  .remove {
    border: none;
    background: transparent;
    cursor: pointer;
    align-self: start;
  }
</style>
