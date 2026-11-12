<script>
  import TemuIcon from "./TemuIcon.svelte";

  /** @type {(topic: string) => void} */
  export let onAction = () => {};

  const items = [
    { topic: "about", icon: "shield", label: "Why choose Bagz?" },
    { topic: "protection", icon: "check", label: "100% authentic + warranty" },
    { topic: "seller", icon: "package", label: "Swap & top-up" },
    { topic: "shipping", icon: "truck", label: "Same-day Kampala delivery" }
  ];
</script>

<div class="trust-green" role="navigation" aria-label="Shop guarantees">
  {#each items as item, i}
    {#if i > 0}
      <span class="sep" aria-hidden="true">|</span>
    {/if}
    <button type="button" class="trust-link" class:why={i === 0} on:click={() => onAction(item.topic)}>
      <TemuIcon name={item.icon} size={14} color="#fff" />
      {item.label}
    </button>
  {/each}
</div>

<style>
  .trust-green {
    background: linear-gradient(90deg, var(--trust-green-dark), var(--trust-green));
    color: #fff;
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: 1.35;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px 12px;
  }
  .trust-link {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 2px 4px;
    margin: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 4px;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: rgba(255, 255, 255, 0.35);
  }
  .trust-link:hover,
  .trust-link:focus-visible {
    text-decoration-color: #fff;
    background: rgba(255, 255, 255, 0.12);
    outline: none;
  }
  .trust-link.why {
    font-weight: 700;
    text-decoration: none;
  }
  .trust-link.why:hover,
  .trust-link.why:focus-visible {
    text-decoration: underline;
  }
  .sep {
    opacity: 0.45;
    font-weight: 300;
  }
  @media (max-width: 900px) {
    .trust-green {
      font-size: 11px;
      padding: 6px 10px;
      gap: 6px 10px;
      flex-wrap: nowrap;
      overflow-x: auto;
      justify-content: flex-start;
      scrollbar-width: none;
    }
    .trust-green::-webkit-scrollbar {
      display: none;
    }
    .sep {
      display: none;
    }
    .trust-link {
      flex-shrink: 0;
    }
  }
</style>
