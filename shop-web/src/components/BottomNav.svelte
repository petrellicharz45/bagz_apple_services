<script>
  import TemuIcon from "./TemuIcon.svelte";

  export let active = "shop";
  export let cartCount = 0;
  export let onChange = () => {};
  const items = [
    { id: "shop", label: "Home", icon: "home" },
    { id: "category", label: "Categories", icon: "grid" },
    { id: "cart", label: "Cart", icon: "cart" },
    { id: "me", label: "You", icon: "user" }
  ];
</script>

<nav class="bottom-nav">
  {#each items as item}
    <button
      type="button"
      class:active={active === item.id}
      class:has-badge={item.id === "cart" && cartCount > 0}
      on:click={() => onChange(item.id)}
    >
      <span class="icon-wrap">
        <TemuIcon name={item.icon} size={22} color={active === item.id ? "#f97316" : "#999"} />
        {#if item.id === "cart" && cartCount > 0}
          <span class="nav-badge">{cartCount > 99 ? "99+" : cartCount}</span>
        {/if}
      </span>
      <span>{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: #fff;
    border-top: 1px solid #e8e8e8;
    padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 0));
    z-index: 40;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  }
  button {
    border: none;
    background: transparent;
    color: #999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 0;
  }
  button.active {
    color: var(--temu-orange);
    font-weight: 600;
  }
  .icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav-badge {
    position: absolute;
    top: -5px;
    right: -10px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--temu-orange);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    display: grid;
    place-items: center;
    line-height: 1;
  }
</style>
