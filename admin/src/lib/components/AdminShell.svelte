<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { signOut } from "firebase/auth";
  import { auth } from "$lib/firebase";
  import { userStore } from "$lib/stores/auth";
  import { productMatchesSearch } from "$lib/data/products";
  import { loadProductCatalog, productCatalog } from "$lib/stores/catalog";
  import AdminToast from "$lib/components/AdminToast.svelte";
  import { openShopInBrowser } from "$lib/shopWebsite";

  let open = false;
  let query = "";
  let showHits = false;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  const links = [
    { href: "/", label: "Dashboard", icon: "grid" },
    { href: "/products", label: "Products", icon: "box" },
    { href: "/sales", label: "Sales", icon: "chart" },
    { href: "/inventory", label: "Inventory", icon: "layers" },
    { href: "/categories", label: "Categories", icon: "tag" },
    { href: "/subcategories", label: "Subcategories", icon: "circles" },
    { href: "/groups", label: "Groups", icon: "layers" },
    { href: "/delivery-fees", label: "Delivery fees", icon: "truck" },
    { href: "/banners", label: "Home Banners", icon: "image" },
    { href: "/orders", label: "Orders", icon: "bag" },
    { href: "/product-reports", label: "Wrong product info", icon: "chat" },
    { href: "/tickets", label: "Support Tickets", icon: "chat" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/system-insights", label: "System insights", icon: "pulse" },
    { href: "/push-notifications", label: "Push broadcasts", icon: "send" },
    { href: "/admin", label: "Admin Management", icon: "users" },
    { href: "/seo", label: "SEO", icon: "chart" },
    { href: "/settings", label: "Settings", icon: "gear" }
  ];

  let alertUnread = 0;

  $: path = normalizePath($page.url.pathname);
  $: activeNavHref = pickActiveNav(path);
  $: isDashboard = activeNavHref === "/";
  $: title = links.find((link) => link.href === activeNavHref)?.label ?? "Dashboard";

  function normalizePath(pathname: string) {
    const base = pathname.split("?")[0].split("#")[0];
    if (!base || base === "/") return "/";
    return base.endsWith("/") ? base.slice(0, -1) : base;
  }

  /** Longest matching nav path wins (never treat "/" as prefix of every route). */
  function pickActiveNav(pathname: string) {
    if (pathname === "/") return "/";
    let best = "";
    for (const { href } of links) {
      if (href === "/") continue;
      if (pathname === href || pathname.startsWith(`${href}/`)) {
        if (href.length > best.length) best = href;
      }
    }
    return best || "/";
  }
  $: today = new Date().toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  $: initials = ($userStore?.email || "A").slice(0, 1).toUpperCase();
  $: avatarUrl = $userStore?.photoURL || "";
  $: hits = query.trim()
    ? $productCatalog.filter((p) => productMatchesSearch(p, query)).slice(0, 8)
    : [];

  onMount(() => {
    loadProductCatalog();
    void refreshAlertCount();
  });

  async function refreshAlertCount() {
    try {
      const { fetchAdminNotifications, unreadCount } = await import("$lib/data/adminNotifications");
      const list = await fetchAdminNotifications(40);
      alertUnread = unreadCount(list);
    } catch {
      alertUnread = 0;
    }
  }

  function onNavClick(event: MouseEvent) {
    open = false;
    (event.currentTarget as HTMLElement | null)?.blur();
  }

  function onQueryInput() {
    showHits = query.trim().length > 0;
    loadProductCatalog();
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const q = query.trim();
      if (path.startsWith("/products") && !path.includes("/products/")) {
        goto(q ? `/products?q=${encodeURIComponent(q)}` : "/products", {
          keepFocus: true,
          noScroll: true,
          replaceState: true
        });
      }
    }, 120);
  }

  function search() {
    const q = query.trim();
    showHits = false;
    goto(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  function openProduct(id: string) {
    showHits = false;
    goto(`/products/${id}`);
  }

  async function handleLogout() {
    if (auth) await signOut(auth);
    goto("/login");
  }
</script>

<div class="shell">
  {#if open}
    <button class="backdrop" on:click={() => (open = false)} aria-label="Close menu"></button>
  {/if}

  <aside class:open>
    <div class="brand">
      <img
        class="logo-wordmark"
        src="/fancy-deals-logo-white.png"
        alt="Fancy Deals"
        width="168"
        height="40"
      />
      <span class="console-label">Admin Console</span>
    </div>
    <nav>
      {#each links as link}
        <a
          href={link.href}
          class:nav-active={link.href === activeNavHref}
          aria-current={link.href === activeNavHref ? "page" : undefined}
          on:click={onNavClick}
        >
          <span class="icon" data-icon={link.icon}></span>
          {link.label}
        </a>
      {/each}
    </nav>
    <div class="promo">
      <div class="promo-icon-wrap" aria-hidden="true">
        <img class="promo-mark" src="/favicon.png" alt="" width="40" height="40" />
      </div>
      <p class="promo-title">Fancy Deals: More Deals, Happier Customers</p>
      <button type="button" class="promo-cta" on:click={openShopInBrowser}>View shop →</button>
    </div>
  </aside>

  <div class="main">
    <AdminToast />
    <header>
      <button class="menu" on:click={() => (open = !open)} aria-label="Open menu">☰</button>
      <form class="search" on:submit|preventDefault={search}>
        <span>⌕</span>
        <input
          bind:value={query}
          on:input={onQueryInput}
          on:focus={() => (showHits = query.trim().length > 0)}
          on:blur={() => setTimeout(() => (showHits = false), 180)}
          placeholder="Search products as you type…"
          autocomplete="off"
        />
        {#if showHits}
          <div class="hits">
            {#if hits.length === 0}
              <div class="hit muted">No products match “{query.trim()}”</div>
            {:else}
              {#each hits as product}
                <button type="button" class="hit" on:mousedown|preventDefault={() => openProduct(product.id)}>
                  <strong>{product.name}</strong>
                  <small>{product.category || "Catalog"}</small>
                </button>
              {/each}
              <button type="button" class="hit more" on:mousedown|preventDefault={search}>
                See all matches in Products
              </button>
            {/if}
          </div>
        {/if}
      </form>
      {#if !isDashboard}
        <h1>{title}</h1>
      {/if}
      <div class="header-meta">
        <time>{today}</time>
        <button
          type="button"
          class="website-link"
          title="Open shop in your browser (not the installed app)"
          on:click={openShopInBrowser}
        >
          <svg class="website-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-6h-2v6H5V5z"
            />
          </svg>
          <span class="website-label">View shop</span>
        </button>
        <a class="bell" href="/notifications" aria-label="Notifications" title="Alerts & inbox">
          🔔
          {#if alertUnread > 0}<span class="bell-badge">{alertUnread > 99 ? "99+" : alertUnread}</span>{/if}
        </a>
        <a class="profile-link" href="/settings?tab=account" title="My account">
          {#if avatarUrl}
            <img class="avatar-img" src={avatarUrl} alt="" />
          {:else}
            <div class="avatar">{initials}</div>
          {/if}
          <div class="who">
            <strong>Admin</strong>
            <small>{$userStore?.email}</small>
          </div>
        </a>
        <button class="logout" on:click={handleLogout}>Log out</button>
      </div>
    </header>
    <section class="content">
      {#key path}
        <slot />
      {/key}
    </section>
  </div>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 250px 1fr;
    background: var(--fd-bg);
  }
  aside {
    background: #1b1512;
    color: #f0ebe8;
    padding: 22px 16px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .brand {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    padding: 0 8px 4px;
  }
  .logo-wordmark {
    width: 100%;
    max-width: 168px;
    height: auto;
    max-height: 40px;
    object-fit: contain;
    object-position: left center;
    flex-shrink: 0;
  }
  .console-label {
    font-size: 11px;
    font-weight: 500;
    color: #a8a29e;
    letter-spacing: 0.02em;
  }
  .logo {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--fd-orange);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
  }
  .brand strong {
    display: block;
    color: #fff;
  }
  .brand span {
    font-size: 12px;
    color: #8aa0b8;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #d6d3d1;
    text-decoration: none;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }
  nav a:hover:not(.nav-active) {
    background: #eab308;
    color: #fff !important;
  }
  nav a.nav-active {
    background: linear-gradient(90deg, #ea580c 0%, #f97316 100%);
    color: #fff !important;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
  }
  nav a.nav-active:hover {
    background: linear-gradient(90deg, #ea580c 0%, #f97316 100%);
    color: #fff !important;
  }
  nav a.nav-active .icon,
  nav a:hover:not(.nav-active) .icon {
    opacity: 1;
    background-color: #fff;
  }
  .icon {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: currentColor;
    opacity: 0.75;
    mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg>") center / contain no-repeat;
  }
  .icon[data-icon="box"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M3 7l9-4 9 4-9 4-9-4zm0 4l9 4 9-4v6l-9 4-9-4v-6z'/></svg>");
  }
  .icon[data-icon="tag"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M2 12l10 10 10-10V4H12L2 12zm15-6a1.5 1.5 0 110 3 1.5 1.5 0 010-3z'/></svg>");
  }
  .icon[data-icon="circles"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='8' cy='12' r='4' fill='black'/><circle cx='16' cy='12' r='4' fill='black'/></svg>");
  }
  .icon[data-icon="image"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='5' width='18' height='14' rx='2' fill='black'/></svg>");
  }
  .icon[data-icon="bag"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 016 0v2'/></svg>");
  }
  .icon[data-icon="truck"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M3 6h11v9H3V6zm12 0h3l2 3v6h-5V6zm-9 13a2 2 0 110-4 2 2 0 010 4zm10 0a2 2 0 110-4 2 2 0 010 4z'/></svg>");
  }
  .icon[data-icon="chat"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M4 4h16v12H7l-3 3V4z'/></svg>");
  }
  .icon[data-icon="bell"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M12 22a2 2 0 002-2H10a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5L4 18v1h16v-1l-2-2z'/></svg>");
  }
  .icon[data-icon="users"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='9' cy='8' r='3' fill='black'/><path fill='black' d='M3 19c0-3 3-5 6-5s6 2 6 5H3zm12-9a3 3 0 110-2 3 3 0 010 2zm3 9c0-2-1-3.5-3-4.5'/></svg>");
  }
  .icon[data-icon="gear"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='3' fill='black'/><path fill='black' d='M19 12l2-1-1-3-2 .5a7 7 0 00-1.5-1.5L17 5l-3-1-1 2a7 7 0 00-2 0L10 4 7 5l.5 2A7 7 0 006 8.5L4 8 3 11l2 1a7 7 0 000 2l-2 1 1 3 2-.5A7 7 0 007.5 18L7 20l3 1 1-2a7 7 0 002 0l1 2 3-1-.5-2a7 7 0 001.5-1.5l2 .5 1-3-2-1a7 7 0 000-2z'/></svg>");
  }
  .icon[data-icon="chart"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M4 19h16v2H2V3h2v16zm4-8h2v8H8v-8zm4-6h2v14h-2V5zm4 4h2v10h-2V9z'/></svg>");
  }
  .icon[data-icon="layers"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M12 2l10 5-10 5L2 7l10-5zm0 8l10 5-10 5-10-5 10-5z'/></svg>");
  }
  .icon[data-icon="pulse"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M3 12h3l2-7 4 14 3-9 2 2h6v-2h-4l-2-2-3 9-4-14-2 7H3v2z'/></svg>");
  }
  .icon[data-icon="send"] {
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M2 21l21-9L2 3v7l15 2-15 2v7z'/></svg>");
  }
  .bell {
    position: relative;
    text-decoration: none;
    font-size: 18px;
    line-height: 1;
  }
  .bell-badge {
    position: absolute;
    top: -6px;
    right: -8px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  .promo {
    border-radius: 16px;
    padding: 16px 14px;
    background: linear-gradient(145deg, #ea580c 0%, #f97316 55%, #fb923c 100%);
    color: #fff;
    text-align: center;
    box-shadow: 0 8px 24px rgba(234, 88, 12, 0.35);
  }
  .promo-icon-wrap {
    width: 52px;
    height: 52px;
    margin: 0 auto 10px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.2);
    display: grid;
    place-items: center;
  }
  .promo-mark {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .promo-title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
  }
  .promo-cta {
    border: 0;
    cursor: pointer;
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    background: #fff;
    color: #c2410c;
    font-weight: 700;
    font-size: 13px;
  }
  .main {
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 24px;
    background: #fff;
    border-bottom: 1px solid #e6edf5;
  }
  header h1 {
    margin: 0;
    font-size: 18px;
    white-space: nowrap;
  }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f4f7fb;
    border-radius: 999px;
    padding: 0 14px;
    max-width: 520px;
    position: relative;
  }
  .hits {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    background: #fff;
    border: 1px solid #e6edf5;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
    z-index: 30;
    max-height: 360px;
    overflow: auto;
    padding: 6px;
  }
  .hit {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
  }
  .hit:hover {
    background: #f4f7fb;
  }
  .hit strong {
    font-size: 13px;
    color: var(--fd-navy);
  }
  .hit small {
    color: #6b7280;
    font-size: 12px;
  }
  .hit.muted {
    cursor: default;
    color: #6b7280;
  }
  .hit.more {
    font-weight: 700;
    color: var(--fd-orange);
    font-size: 13px;
  }
  .search input {
    border: 0;
    background: transparent;
    padding: 10px 0;
    width: 100%;
    margin: 0;
  }
  .header-meta {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  time {
    font-size: 12px;
    color: #6b7280;
  }
  .website-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid #e6edf5;
    color: var(--fd-navy, #1e293b);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }
  .website-link:hover {
    background: #fff7ed;
    border-color: #fdba74;
    color: #c2410c;
  }
  .website-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
  .profile-link {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    border-radius: 999px;
    padding: 4px 8px 4px 4px;
  }
  .profile-link:hover {
    background: #f4f7fb;
  }
  .avatar,
  .avatar-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }
  .avatar {
    background: var(--fd-orange);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 700;
  }
  .who {
    display: flex;
    flex-direction: column;
    font-size: 12px;
  }
  .who small {
    color: #6b7280;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .logout,
  .menu {
    border: 0;
    cursor: pointer;
  }
  .logout {
    background: #fff3e8;
    color: var(--fd-orange);
    border-radius: 999px;
    padding: 8px 12px;
    font-weight: 600;
  }
  .menu {
    display: none;
    background: #eef3f9;
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }
  .content {
    padding: 22px 24px 36px;
  }
  .backdrop {
    display: none;
  }
  @media (max-width: 1100px) {
    .who,
    time {
      display: none;
    }
    .website-label {
      display: none;
    }
    .website-link {
      padding: 8px 10px;
    }
  }
  @media (max-width: 960px) {
    .shell {
      grid-template-columns: 1fr;
    }
    aside {
      position: fixed;
      inset: 0 auto 0 0;
      width: 250px;
      transform: translateX(-100%);
      z-index: 20;
    }
    aside.open {
      transform: none;
    }
    .menu,
    .backdrop {
      display: block;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      border: 0;
      background: rgba(15, 23, 42, 0.45);
      z-index: 15;
    }
  }
</style>
