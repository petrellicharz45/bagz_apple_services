<script lang="ts">
  import { to, appPath } from "$lib/paths";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { signOut } from "firebase/auth";
  import { auth } from "$lib/firebase";
  import { userStore, accessStore } from "$lib/stores/auth";
  import { pageLevel, levelFor, moduleForPath, roleLabel, isFullAdmin } from "$lib/auth/permissions";
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
    { href: "/popups", label: "Pop-ups", icon: "popup" },
    { href: "/social-links", label: "Social links", icon: "share" },
    { href: "/orders", label: "Orders", icon: "bag" },
    { href: "/product-reports", label: "Wrong product info", icon: "flag" },
    { href: "/tickets", label: "Support Tickets", icon: "chat" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/system-insights", label: "System insights", icon: "pulse" },
    { href: "/push-notifications", label: "Push broadcasts", icon: "send" },
    { href: "/admin", label: "Users & Roles", icon: "users" },
    { href: "/seo", label: "SEO", icon: "chart" },
    { href: "/settings", label: "Settings", icon: "gear" }
  ];

  /** Sidebar icon names → Font Awesome 4.7 classes. */
  const NAV_FA: Record<string, string> = {
    grid: "th-large",
    box: "cube",
    chart: "bar-chart",
    layers: "clone",
    tag: "tag",
    circles: "sitemap",
    truck: "truck",
    image: "picture-o",
    bag: "shopping-bag",
    flag: "flag-o",
    chat: "comments-o",
    bell: "bell-o",
    pulse: "heartbeat",
    send: "paper-plane-o",
    users: "users",
    gear: "cog",
    share: "share-alt",
    popup: "window-restore"
  };

  let alertUnread = 0;

  $: path = normalizePath(appPath($page.url.pathname));
  $: activeNavHref = pickActiveNav(path);
  $: isDashboard = activeNavHref === "/";
  $: title = links.find((link) => link.href === activeNavHref)?.label ?? "Dashboard";
  // Only the pages this person may open (Firestore rules enforce the same permissions).
  $: visibleLinks = links.filter((link) => pageLevel($accessStore, link.href) !== "none");
  $: level = pageLevel($accessStore, path, $page.url.search);
  $: canSearchProducts = levelFor($accessStore, "products") !== "none";
  $: roleName = $accessStore?.kind === "owner" ? "Owner" : roleLabel($accessStore?.role || "");
  $: whoName = $accessStore?.name && $accessStore.name !== $userStore?.email ? $accessStore.name : "";

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
        goto(to(q ? `/products?q=${encodeURIComponent(q)}` : "/products"), {
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
    goto(to(q ? `/products?q=${encodeURIComponent(q)}` : "/products"));
  }

  function openProduct(id: string) {
    showHits = false;
    goto(to(`/products/${id}`));
  }

  async function handleLogout() {
    if (auth) await signOut(auth);
    goto(to("/login"));
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
        src={to("/brand/bagz-logo-white.png")}
        alt="Bagz Apple Services"
        width="168"
        height="40"
      />
      <span class="console-label">Admin Console</span>
    </div>
    <nav>
      {#each visibleLinks as link}
        <a
          href={to(link.href)}
          class:nav-active={link.href === activeNavHref}
          aria-current={link.href === activeNavHref ? "page" : undefined}
          on:click={onNavClick}
        >
          <i class="fa fa-fw fa-{NAV_FA[link.icon] || 'circle-o'} icon" aria-hidden="true"></i>
          {link.label}
        </a>
      {/each}
    </nav>
    <div class="promo">
      <div class="promo-icon-wrap" aria-hidden="true">
        <img class="promo-mark" src={to("/favicon.png")} alt="" width="40" height="40" />
      </div>
      <p class="promo-title">Bagz Apple Services — Authentic Genuine Gadget Store</p>
      <button type="button" class="promo-cta" on:click={openShopInBrowser}>View shop <i class="fa fa-arrow-right" aria-hidden="true"></i></button>
    </div>
  </aside>

  <div class="main">
    <AdminToast />
    <header>
      <button class="menu" on:click={() => (open = !open)} aria-label="Open menu"><i class="fa fa-bars" aria-hidden="true"></i></button>
      <form class="search" class:hidden-search={!canSearchProducts} on:submit|preventDefault={search}>
        <span><i class="fa fa-search" aria-hidden="true"></i></span>
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
          <i class="fa fa-external-link website-icon" aria-hidden="true"></i>
          <span class="website-label">View shop</span>
        </button>
        <a class="bell" href={to("/notifications")} aria-label="Notifications" title="Alerts & inbox">
          <i class="fa fa-bell-o" aria-hidden="true"></i>
          {#if alertUnread > 0}<span class="bell-badge">{alertUnread > 99 ? "99+" : alertUnread}</span>{/if}
        </a>
        <a class="profile-link" href={to("/settings?tab=account")} title="My account">
          {#if avatarUrl}
            <img class="avatar-img" src={avatarUrl} alt="" />
          {:else}
            <div class="avatar">{initials}</div>
          {/if}
          <div class="who">
            <strong>{whoName || $userStore?.email}</strong>
            <small>{roleName}{whoName ? ` · ${$userStore?.email}` : ""}</small>
          </div>
        </a>
        <button class="logout" on:click={handleLogout}>Log out</button>
      </div>
    </header>
    <section class="content">
      {#key path}
        {#if level === "none"}
          <div class="no-access" role="alert">
            <i class="fa fa-lock" aria-hidden="true"></i>
            <h2>You don't have access to this page</h2>
            <p>
              Your role ({roleName}) doesn't include {moduleForPath(path) === "staff" ? "managing users" : "this part of the admin"}.
              Ask an admin to change your permissions in Users &amp; Roles.
            </p>
            <a href={to("/")}>Back to Dashboard</a>
          </div>
        {:else}
          {#if level === "view" && !isFullAdmin($accessStore)}
            <div class="view-only" role="note">
              <i class="fa fa-eye" aria-hidden="true"></i>
              <span><strong>View only.</strong> You can look around here, but changes you try to save will be refused.</span>
            </div>
          {/if}
          <slot />
        {/if}
      {/key}
    </section>
  </div>
</div>

<style>
  .hidden-search {
    visibility: hidden;
  }
  .no-access {
    max-width: 520px;
    margin: 48px auto;
    text-align: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 32px 24px;
    color: #13344f;
  }
  .no-access .fa {
    font-size: 34px;
    color: #1673c4;
  }
  .no-access h2 {
    margin: 12px 0 8px;
    font-size: 20px;
  }
  .no-access p {
    color: #4b5563;
    margin: 0 0 18px;
  }
  .no-access a {
    font-weight: 600;
    color: #1673c4;
  }
  .view-only {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fff8e6;
    border: 1px solid #f5d48a;
    color: #7a5200;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
    font-size: 14px;
  }
  .shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 250px 1fr;
    background: var(--fd-bg);
  }
  aside {
    background: #0c2236;
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
    color: #9fb3c8;
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
    color: #d5dfe9;
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
    background: rgba(43, 168, 224, 0.18);
    color: #fff !important;
  }
  nav a.nav-active {
    background: linear-gradient(90deg, #135fa3 0%, #1673c4 100%);
    color: #fff !important;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(19, 95, 163, 0.35);
  }
  nav a.nav-active:hover {
    background: linear-gradient(90deg, #135fa3 0%, #1673c4 100%);
    color: #fff !important;
  }
  nav a.nav-active .icon,
  nav a:hover:not(.nav-active) .icon {
    opacity: 1;
    color: #fff;
  }
  .icon {
    width: 18px;
    font-size: 16px;
    text-align: center;
    opacity: 0.75;
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
    background: linear-gradient(145deg, #135fa3 0%, #1673c4 55%, #2ba8e0 100%);
    color: #fff;
    text-align: center;
    box-shadow: 0 8px 24px rgba(19, 95, 163, 0.35);
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
    color: #13344f;
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
    background: #eef7fc;
    border-color: #9fd6f0;
    color: #13344f;
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
    background: #eef7fc;
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
