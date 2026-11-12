<script>
  import {
    cartItems,
    cartSubtotal,
    removeLine,
    updateQty,
    toggleSelectAll,
    setLineSelected,
    MIN_CHECKOUT_UGX
  } from "../lib/stores/cart.js";
  import { formatUgx, priceParts, coverUrl } from "../lib/catalog.js";

  export let onCheckout = () => {};

  $: items = $cartItems;
  $: selected = items.filter((x) => x.selected);
  $: total = selected.reduce((s, l) => s + priceParts(l.product).current * l.qty, 0);
  $: needMore = Math.max(0, MIN_CHECKOUT_UGX - total);
  $: allSelected = items.length > 0 && items.every((x) => x.selected);

  function img(line) {
    return coverUrl(line.product) || `https://picsum.photos/seed/${line.productId}/100/100`;
  }
</script>

<nav class="crumbs">Home › Cart</nav>

<div class="grid">
  <section class="lines">
    <label class="all">
      <input
        type="checkbox"
        checked={allSelected}
        on:change={(e) => toggleSelectAll(e.currentTarget.checked)}
      />
      Select all ({items.length})
    </label>
    {#if items.length === 0}
      <p class="empty">Your cart is empty.</p>
    {:else}
      {#each items as line}
        {@const prices = priceParts(line.product)}
        <article class="line">
          <input
            type="checkbox"
            checked={line.selected}
            on:change={(e) =>
              setLineSelected(line.productId, line.size, line.color, e.currentTarget.checked)}
          />
          <img src={img(line)} alt="" />
          <div>
            <h3>{line.product.name}</h3>
            <p class="opts">{line.color} · Size {line.size}</p>
            <p class="price">{formatUgx(prices.current)}</p>
            {#if prices.old}
              <p class="was">Was: {formatUgx(prices.old)}</p>
            {/if}
            <div class="qty">
              Qty
              <select
                value={line.qty}
                on:change={(e) =>
                  updateQty(line.productId, line.size, line.color, Number(e.currentTarget.value))}
              >
                {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as n}
                  <option value={n}>{n}</option>
                {/each}
              </select>
            </div>
          </div>
          <button
            type="button"
            class="del"
            on:click={() => removeLine(line.productId, line.size, line.color)}
          >
            Remove
          </button>
        </article>
      {/each}
    {/if}
  </section>

  <aside class="summary">
    <h2>Order summary</h2>
    <div class="row">
      <span>Item total</span>
      <span>{formatUgx(total)}</span>
    </div>
    <div class="row total">
      <span>Total</span>
      <strong>{formatUgx(total)}</strong>
    </div>
    {#if needMore > 0}
      <button type="button" class="cta secondary" disabled>
        {formatUgx(MIN_CHECKOUT_UGX)} min. to checkout
      </button>
      <p class="hint">Add {formatUgx(needMore)} more, or continue to pay what you have selected.</p>
    {/if}
    <button
      type="button"
      class="cta"
      disabled={selected.length === 0}
      on:click={onCheckout}
    >
      Proceed to checkout
    </button>
    <p class="lock">🔒 Pay with mobile money on the next step — no charge until you approve on your phone.</p>
  </aside>
</div>

<style>
  .crumbs {
    font-size: var(--text-sm);
    margin-bottom: 16px;
    color: var(--text-secondary);
  }
  .grid {
    display: grid;
    gap: 20px;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: 1fr 320px;
      align-items: start;
    }
  }
  .lines,
  .summary {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
  }
  .all {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-sm);
    margin-bottom: 12px;
  }
  .line {
    display: grid;
    grid-template-columns: auto 80px 1fr auto;
    gap: 12px;
    padding: 14px 0;
    border-top: 1px solid #eee;
    align-items: start;
  }
  .line img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 6px;
  }
  .line h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .opts {
    font-size: 11px;
    color: #888;
    margin: 4px 0;
  }
  .price {
    font-weight: 700;
    margin: 0;
  }
  .was {
    font-size: 11px;
    color: #999;
    margin: 2px 0;
  }
  .qty {
    margin-top: 8px;
    font-size: var(--text-xs);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .del {
    border: none;
    background: none;
    color: #b91c1c;
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .summary h2 {
    margin: 0 0 12px;
    font-size: var(--text-md);
  }
  .row {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-sm);
    margin-bottom: 8px;
  }
  .row.total {
    margin: 12px 0 16px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }
  .cta {
    width: 100%;
    border: none;
    background: var(--temu-orange);
    color: #fff;
    font-weight: 700;
    padding: 14px;
    border-radius: 999px;
    cursor: pointer;
    font-size: var(--text-sm);
  }
  .cta:disabled {
    opacity: 0.85;
    cursor: not-allowed;
  }
  .cta.secondary {
    background: #fdba74;
    margin-bottom: 8px;
  }
  .hint,
  .lock {
    font-size: 11px;
    color: #666;
    margin-top: 10px;
  }
  .empty {
    padding: 24px;
    text-align: center;
    color: #888;
  }
</style>
