<script>
  export let search = "";
  export let cartCount = 0;
  export let onSearch = () => {};
</script>

<header class="top-bar">
  <div class="logo" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="36" height="36">
      <path d="M4,5 L4,13 C4,13.5 4.5,14 5,14 L11,14 C11.5,14 12,13.5 12,13 L12,5 Z" fill="#2ba8e0" />
      <path
        d="M6.5,5 C6.5,3.5 7.5,2.5 8,2.5 C8.5,2.5 9.5,3.5 9.5,5"
        fill="none"
        stroke="#2ba8e0"
        stroke-width="1.2"
      />
      <path d="M6.5,6.5 L6.5,12" stroke="#FFF" stroke-width="1.5" stroke-linecap="round" />
      <path d="M6.5,6.5 L10,6.5" stroke="#FFF" stroke-width="1.5" stroke-linecap="round" />
      <path d="M6.5,9 L9,9" stroke="#FFF" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </div>

  <div class="search-wrap">
    <input
      type="search"
      placeholder="Search products, brands and categories"
      bind:value={search}
      on:keydown={(e) => e.key === "Enter" && onSearch()}
    />
    <button type="button" class="search-btn" aria-label="Search" on:click={onSearch}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
    </button>
  </div>

  <button type="button" class="icon-btn" aria-label="Help">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1673c4" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  </button>

  <div class="cart-wrap">
    <button type="button" class="icon-btn" aria-label="Cart">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1673c4" stroke-width="2">
        <path d="M6 6h15l-1.5 9h-12z" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
        <path d="M6 6L5 3H2" />
      </svg>
    </button>
    {#if cartCount > 0}
      <span class="cart-badge">{cartCount}</span>
    {/if}
  </div>
</header>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .logo {
    flex-shrink: 0;
  }
  .search-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    height: 40px;
    margin-left: 8px;
    border: 1.5px solid #121212;
    border-radius: 100px;
    padding: 0 6px 0 10px;
    background: #fff;
  }
  .search-wrap input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--semi-black);
    background: transparent;
  }
  .search-wrap input::placeholder {
    color: var(--hint);
  }
  .search-btn {
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 100px;
    background: #121212;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .icon-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 8px;
  }
  .cart-wrap {
    position: relative;
    margin-left: 2px;
  }
  .cart-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    background: var(--g-dark-blue);
    color: #fff;
    font-size: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
  }
</style>
