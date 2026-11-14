<script>
  import { onDestroy, onMount } from "svelte";
  import TemuIcon from "./TemuIcon.svelte";
  import SearchPanel from "./SearchPanel.svelte";
  import AccountMenu from "./AccountMenu.svelte";
  import SupportMenu from "./SupportMenu.svelte";
  import CategoriesMegaMenu from "./CategoriesMegaMenu.svelte";
  import { profileStore } from "../lib/accountStore.js";
  import { profileInitials } from "../lib/avatarImage.js";
  import { selectionFromSub } from "../lib/categoryMenu.js";
  import AppInstallBanner from "./AppInstallBanner.svelte";
  import SocialLinks from "./SocialLinks.svelte";
  import { liveContact } from "../lib/shopContact.js";
  import { displaySettings, resolvedLogoUrl } from "../lib/storeDisplay.js";

  $: shopLogoSrc = resolvedLogoUrl($displaySettings);

  export let search = "";
  export let products = [];
  export let categories = [];
  export let browseGroups = null;
  export let categoryImages = {};
  export let onCategoryPick = () => {};
  export let onSearch = () => {};
  export let onPickProduct = () => {};
  export let onApplyQuery = () => {};
  export let activeTab = "shop";
  export let onTab = () => {};
  export let cartCount = 0;
  export let onOpenCart = () => {};
  export let onSupportAction = () => {};
  export let onAccountAction = () => {};
  export let shopBrowseMode = "recommended";
  export let onOpenNewIn = () => {};
  export let onOpenRecommended = () => {};

  let searchOpen = false;
  let searchWrap;
  let categoriesOpen = false;
  let catWrap;
  let catCloseTimer;
  let inApp = false;

  const defaultHint = "Search iPhone, Pixel, AirPods…";

  function openCategories() {
    clearTimeout(catCloseTimer);
    categoriesOpen = true;
    searchOpen = false;
  }

  function scheduleCloseCategories() {
    clearTimeout(catCloseTimer);
    catCloseTimer = setTimeout(() => {
      closeCategories();
    }, 80);
  }

  function closeCategories() {
    clearTimeout(catCloseTimer);
    categoriesOpen = false;
    catWrap?.querySelector("button.cat")?.blur();
  }

  function onCategoriesPointerLeave() {
    scheduleCloseCategories();
  }

  function onWindowKeydown(e) {
    if (e.key === "Escape") closeCategories();
  }

  onMount(() => {
    inApp = navigator.userAgent.includes("BagzApp");
    window.addEventListener("keydown", onWindowKeydown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", onWindowKeydown);
    clearTimeout(catCloseTimer);
  });

  function handleCategorySub(sub) {
    onCategoryPick(selectionFromSub(sub));
    closeCategories();
  }

  function submitSearch() {
    searchOpen = false;
    onSearch();
  }

  function clearSearch() {
    search = "";
    onApplyQuery("");
  }

  function handlePickQuery(q) {
    search = q;
    searchOpen = false;
    onApplyQuery(q);
    onSearch();
  }

  function handlePickProduct(p) {
    searchOpen = false;
    onPickProduct(p);
  }

  function onDocClick(e) {
    if (searchWrap && !searchWrap.contains(e.target)) searchOpen = false;
    if (catWrap && !catWrap.contains(e.target)) categoriesOpen = false;
  }
</script>

<svelte:window on:click={onDocClick} />

<div class="sticky-wrap">
  <div class="app-strip" class:in-app={inApp}>
    <AppInstallBanner variant="mobile" />
  </div>
  <div class="utility">
    <button type="button" class="u-item link" on:click={() => onTab("shop")}>
      <TemuIcon name="truck" size={14} color="#6ee7b7" />
      <span class="u-strong">Same-day delivery</span>
      <span class="u-muted">· Kampala</span>
    </button>
    <button type="button" class="u-item link" on:click={() => onSupportAction("protection")}>
      <TemuIcon name="package" size={14} color="#fcd34d" />
      <span class="u-strong">100% authentic · warranty</span>
    </button>
    <span class="grow" />
    {#if $liveContact.socials.length}
      <span class="u-follow">
        <span class="u-muted">Follow us</span>
        <SocialLinks links={$liveContact.socials} size={24} />
      </span>
    {/if}
    <button type="button" class="seller" on:click={() => onSupportAction("seller")}>
      Swap &amp; top-up ›
    </button>
  </div>

  <header class="main-bar">
    <div class="bar-start desktop-only">
      <div
        class="brand"
        on:click={() => onTab("shop")}
        on:keydown
        role="button"
        tabindex="0"
      >
        <img
          class="brand-logo"
          src={shopLogoSrc}
          alt="Bagz Apple Services"
          width="192"
          height="46"
        />
      </div>

      <nav class="links" aria-label="Shop highlights">
        <button
          type="button"
          class="nav-pill hide-lg"
          class:active={activeTab === "shop" && shopBrowseMode !== "newIn"}
          on:click={() => {
            onOpenRecommended();
            onTab("shop");
          }}
        >
          <span class="nav-ico" aria-hidden="true">
            <TemuIcon name="thumbUp" size={13} color="#fff" strokeWidth={2} />
          </span>
          <span class="label-full">Best-Selling Items</span>
          <span class="label-short">Best sellers</span>
        </button>
        <button
          type="button"
          class="nav-pill"
          class:active={activeTab === "trends"}
          on:click={() => onTab("trends")}
        >
          <span class="nav-ico" aria-hidden="true">
            <TemuIcon name="star" size={13} color="#fff" strokeWidth={1.85} />
          </span>
          <span class="label-full">5-Star Rated</span>
          <span class="label-short">5-Star</span>
        </button>
        <button type="button" class="nav-pill promo" on:click={() => onTab("trends")}>
          <span class="nav-ico promo-ico" aria-hidden="true">
            <TemuIcon name="bolt" size={13} color="#fef08a" strokeWidth={1.85} />
          </span>
          <span>Mega Sale</span>
        </button>
        <button
          type="button"
          class="nav-pill link-new"
          class:active={activeTab === "shop" && shopBrowseMode === "newIn"}
          on:click={() => {
            onOpenNewIn();
            onTab("shop");
          }}
        >
          <span class="nav-ico" aria-hidden="true">
            <TemuIcon name="sparkles" size={13} color="#fff" strokeWidth={1.85} />
          </span>
          <span>New In</span>
        </button>
      </nav>
    </div>

    <div
      class="cat-wrap desktop-only"
      class:menu-open={categoriesOpen}
      role="group"
      aria-label="Categories"
      bind:this={catWrap}
      on:mouseenter={openCategories}
      on:mouseleave={onCategoriesPointerLeave}
    >
      <button
        type="button"
        class="cat nav-link"
        class:open={categoriesOpen}
        aria-expanded={categoriesOpen}
        aria-haspopup="dialog"
      >
        <span class="nav-ico" aria-hidden="true">
          <TemuIcon name="layers" size={13} color="#fff" strokeWidth={1.85} />
        </span>
        <span>Categories</span>
        <span class="cat-chev" class:open={categoriesOpen}>
          <TemuIcon name="chevronDown" size={14} color="#fff" strokeWidth={2} />
        </span>
      </button>
      <CategoriesMegaMenu
        open={categoriesOpen}
        {categories}
        {products}
        {browseGroups}
        {categoryImages}
        onPick={handleCategorySub}
        onClose={closeCategories}
      />
    </div>

    <div class="mobile-header-row mobile-only">
      <div
        class="brand"
        on:click={() => onTab("shop")}
        on:keydown
        role="button"
        tabindex="0"
      >
        <img
          class="brand-logo sm"
          src={shopLogoSrc}
          alt="Bagz Apple Services"
          width="140"
          height="34"
        />
      </div>
      <div class="mobile-actions">
        <button
          type="button"
          class="action icon-only mobile-cart"
          aria-label="Shopping cart"
          on:click={onOpenCart}
        >
          <TemuIcon name="cart" size={24} color="#fff" strokeWidth={1.75} />
          {#if cartCount > 0}
            <span class="badge">{cartCount}</span>
          {/if}
        </button>
        <button
          type="button"
          class="action icon-only mobile-profile"
          aria-label="Account"
          on:click={() => onTab("me")}
        >
          {#if $profileStore.avatarUrl}
            <span class="avatar mobile">
              <img src={$profileStore.avatarUrl} alt="" />
            </span>
          {:else}
            <TemuIcon name="user" size={24} color="#fff" strokeWidth={1.75} />
          {/if}
        </button>
      </div>
    </div>

    <div class="search-wrap" bind:this={searchWrap}>
      <div class="search">
        <input
          type="search"
          placeholder={defaultHint}
          bind:value={search}
          on:focus={() => (searchOpen = true)}
          on:input={() => (searchOpen = true)}
          on:keydown={(e) => e.key === "Enter" && submitSearch()}
        />
        {#if search}
          <button type="button" class="clear" aria-label="Clear" on:click={clearSearch}>×</button>
        {/if}
        <button type="button" class="search-go" aria-label="Search" on:click={submitSearch}>
          <TemuIcon name="search" size={18} color="#fff" strokeWidth={2.25} />
        </button>
      </div>
      <SearchPanel
        {products}
        query={search}
        open={searchOpen}
        onPickQuery={handlePickQuery}
        onPickProduct={handlePickProduct}
        onSearch={submitSearch}
      />
    </div>

    <div class="actions desktop-only">
      <div class="drop-wrap account-drop nav-drop">
        <button type="button" class="action row nav-tab-trigger" tabindex="0">
          <span class="avatar">
            {#if $profileStore.avatarUrl}
              <img src={$profileStore.avatarUrl} alt="" />
            {:else if profileInitials($profileStore.name)}
              {profileInitials($profileStore.name)}
            {:else}
              <i class="fa fa-user" aria-hidden="true"></i>
            {/if}
          </span>
          <span class="label">Orders &amp; Account</span>
        </button>
        <div class="drop-panel">
          <AccountMenu
            onNavigate={(id) => onAccountAction(id)}
            onOpenProduct={(p) => onPickProduct(p)}
          />
        </div>
      </div>
      <div class="drop-wrap support-drop nav-drop">
        <button type="button" class="action row nav-tab-trigger" tabindex="0">
          <TemuIcon name="headset" size={22} color="#fff" strokeWidth={1.75} />
          <span class="label">Support</span>
        </button>
        <div class="drop-panel support">
          <SupportMenu onNavigate={(id) => onSupportAction(id)} />
        </div>
      </div>
      <button type="button" class="action row locale" on:click={() => onAccountAction("locale")}>
        <span class="flag" aria-hidden="true">🇺🇬</span>
        <span class="label">English</span>
      </button>
      <button type="button" class="action icon-only cart" aria-label="Cart" on:click={onOpenCart}>
        <TemuIcon name="cart" size={24} color="#fff" strokeWidth={1.75} />
        {#if cartCount > 0}
          <span class="badge">{cartCount}</span>
        {/if}
      </button>
    </div>
  </header>
</div>

<style>
  .sticky-wrap {
    position: sticky;
    top: 0;
    z-index: 50;
    isolation: isolate;
  }
  .app-strip {
    display: block;
  }
  .app-strip.in-app {
    display: none;
  }
  .u-item.app-dl {
    text-decoration: none;
    color: inherit;
  }
  .utility {
    background: #0a0a0a;
    color: #e8e8e8;
    font-size: 12px;
    padding: 9px 16px;
    min-height: 36px;
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: nowrap;
    overflow: hidden;
  }
  .u-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .u-strong {
    font-weight: 600;
  }
  .u-muted {
    color: #9ca3af;
    font-weight: 400;
  }
  .u-item.link {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
  .grow {
    flex: 1;
  }
  .u-follow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
  }
  .seller {
    border: none;
    background: linear-gradient(90deg, #13344f, #1673c4);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }
  .main-bar {
    background: linear-gradient(180deg, var(--header-bar) 0%, var(--header-bar-deep) 100%);
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 0 14px 0 16px;
    min-height: 68px;
    height: 68px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    position: relative;
  }
  .bar-start {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 1 auto;
    min-width: 0;
    position: relative;
    overflow: visible;
    align-self: center;
  }
  .brand {
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 4px 0;
  }
  .brand-logo {
    display: block;
    height: 42px;
    width: auto;
    max-width: min(188px, 28vw);
    object-fit: contain;
    object-position: left center;
  }
  .brand-logo.sm {
    height: 36px;
    max-width: 168px;
  }
  .links {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow: visible;
    flex: 1;
  }
  .links button.nav-pill,
  .cat-wrap button.nav-link {
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.95);
    font-size: 12px;
    font-weight: 500;
    padding: 5px 7px;
    cursor: pointer;
    border-radius: 999px;
    white-space: nowrap;
    transition: background 0.18s ease;
    line-height: 1.2;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .nav-ico {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.14);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .nav-ico.promo-ico {
    background: rgba(0, 0, 0, 0.22);
  }
  .label-short {
    display: none;
  }
  .links button.nav-pill:hover {
    background: rgba(0, 0, 0, 0.12);
    color: #fff;
  }
  .links button.nav-pill.promo {
    color: #fef08a;
    font-weight: 700;
  }
  .links button.nav-pill.active {
    font-weight: 700;
    color: #fff;
  }
  .cat-wrap {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    margin: 0 6px 0 2px;
    z-index: 15;
    align-self: center;
  }
  .cat-chev {
    display: inline-flex;
    transition: transform 0.15s ease;
    margin-left: -2px;
  }
  .cat-chev.open {
    transform: rotate(180deg);
  }
  .cat-wrap::after {
    content: "";
    position: absolute;
    left: -4px;
    right: -4px;
    top: 100%;
    height: 20px;
    z-index: 79;
  }
  .cat-wrap.menu-open {
    z-index: 85;
  }
  .cat-wrap button.nav-link {
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.92);
    font-weight: 500;
    font-size: 12px;
    line-height: 1.2;
    border-radius: 999px;
    padding: 6px 9px;
    cursor: pointer;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-radius 0.12s ease;
  }
  .cat-wrap:hover button.nav-link,
  .cat-wrap:focus-within button.nav-link,
  .cat-wrap button.nav-link.open {
    background: #1b1512;
    color: #fff;
    font-weight: 600;
    border-radius: 6px 6px 0 0;
  }
  .nav-tab-trigger {
    border: none;
    background: transparent;
    color: #fff;
    font-weight: 500;
    font-size: 12px;
    border-radius: 6px 6px 0 0;
    padding: 8px 10px;
    cursor: pointer;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }
  .search-wrap {
    position: relative;
    flex: 1 1 0;
    min-width: 160px;
    max-width: 100%;
    align-self: center;
    margin: 0 4px;
    z-index: 1;
  }
  .search {
    display: flex;
    height: 42px;
    background: #fff;
    border: none;
    border-radius: 999px;
    padding: 3px 3px 3px 18px;
    align-items: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  }
  .search input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 14px;
    min-width: 0;
    color: var(--text-primary);
  }
  .clear {
    border: none;
    background: #eee;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: #666;
    margin-right: 4px;
  }
  .search-go {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 999px;
    background: #1b1512;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    align-self: center;
  }
  .drop-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .nav-drop .nav-tab-trigger {
    font-weight: 500;
    padding: 8px 10px;
    max-height: 40px;
  }
  /* Invisible bridge so hover stays open moving from trigger to panel */
  .drop-wrap::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    height: 14px;
  }
  .drop-panel {
    position: absolute;
    right: 0;
    top: 100%;
    background: #fff;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    z-index: 70;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(6px);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease,
      visibility 0.18s;
  }
  .drop-wrap:hover .drop-panel,
  .drop-wrap:focus-within .drop-panel {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
  }
  .nav-drop:hover .nav-tab-trigger,
  .nav-drop:focus-within .nav-tab-trigger {
    background: #1b1512;
    color: #fff;
    border-radius: 6px 6px 0 0;
  }
  .action {
    border: none;
    background: transparent;
    color: #fff;
    cursor: pointer;
    border-radius: 999px;
    transition: background 0.18s ease;
  }
  .action.row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    max-width: none;
  }
  .action.row:not(.nav-tab-trigger):hover {
    background: rgba(0, 0, 0, 0.14);
  }
  .label {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    line-height: 1;
    color: #fff;
  }
  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5bbde9, #1673c4);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .flag {
    font-size: 18px;
    line-height: 1;
  }
  .action.icon-only {
    padding: 8px 10px;
    position: relative;
    align-self: center;
    margin-bottom: 6px;
  }
  .actions .locale {
    align-self: center;
    margin-bottom: 6px;
  }
  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    background: #1673c4;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    padding: 0 4px;
  }
  .mobile-only {
    display: none;
  }
  @media (max-width: 1280px) {
    .label-full {
      display: none;
    }
    .label-short {
      display: inline;
    }
    .brand-logo {
      max-width: 148px;
      height: 36px;
    }
  }
  @media (max-width: 1200px) {
    .link-new {
      display: none;
    }
    .links button.hide-lg {
      display: none;
    }
    .links button.nav-pill,
    .cat-wrap button.nav-link {
      padding: 5px 6px;
      font-size: 11px;
    }
    .label {
      font-size: 11px;
    }
    .action.row .label {
      display: none;
    }
    .action.row {
      padding: 8px;
    }
  }
  .mobile-header-row {
    display: none;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mobile-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .mobile-profile .avatar.mobile {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    overflow: hidden;
    display: block;
    border: 2px solid rgba(255, 255, 255, 0.9);
  }
  .mobile-profile .avatar.mobile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  @media (max-width: 900px) {
    .app-strip {
      display: block;
    }
    .app-strip.in-app {
      display: none;
    }
    .desktop-only,
    .hide-md {
      display: none !important;
    }
    .mobile-only {
      display: flex;
    }
    .mobile-header-row.mobile-only {
      display: flex;
      order: 1;
    }
    .utility {
      display: none;
    }
    .main-bar {
      height: auto;
      min-height: 52px;
      flex-wrap: wrap;
      padding: 8px 10px 10px;
      gap: 8px;
    }
    .search-wrap {
      order: 2;
      width: 100%;
      flex: 1 1 100%;
    }
    .search {
      height: 40px;
    }
    .mobile-cart .badge {
      top: 2px;
      right: 0;
    }
  }
</style>
