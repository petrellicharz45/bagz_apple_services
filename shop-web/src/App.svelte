<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { BRAND } from "./lib/brand.js";
  import { liveContact } from "./lib/shopContact.js";
  import TemuHeader from "./components/TemuHeader.svelte";
  import TemuIcon from "./components/TemuIcon.svelte";
  import TrustGreenBar from "./components/TrustGreenBar.svelte";
  import HeroBanner from "./components/HeroBanner.svelte";
  import InterestPills from "./components/InterestPills.svelte";
  import FloatActions from "./components/FloatActions.svelte";
  import BottomNav from "./components/BottomNav.svelte";
  import ProductCard from "./components/ProductCard.svelte";
  import ProductDetail from "./components/ProductDetail.svelte";
  import LightningDealsRow from "./components/LightningDealsRow.svelte";
  import CategoryMenuPanel from "./components/CategoryMenuPanel.svelte";
  import CategoryBrowseView from "./components/CategoryBrowseView.svelte";
  import {
    browseChipsForCategory,
    loadBrowseMenu,
    loadMerchGroups,
    productsForBrowseChip,
    resolveMenuGroups,
    selectionFromSub
  } from "./lib/categoryMenu.js";
  import CategorySidebar from "./components/CategorySidebar.svelte";
  import PromoPopup from "./components/PromoPopup.svelte";
  import CartDrawer from "./components/CartDrawer.svelte";
  import ShopCartPage from "./components/ShopCartPage.svelte";
  import CheckoutPage from "./components/CheckoutPage.svelte";
  import InfoPage from "./components/InfoPage.svelte";
  import AccountSectionView from "./components/AccountSectionView.svelte";
  import { saveOrder, syncOrdersToAdmin } from "./lib/orders.js";
  import { saveProfile } from "./lib/accountStore.js";
  import { loadCategories, loadProducts, loadCategoryImageMap, priceParts, coverUrl, productNeedsSize } from "./lib/catalog.js";
  import {
    BROWSE_NEW_IN,
    BROWSE_RECOMMENDED,
    buildBrowsePills,
    filterShopProducts,
    pillLabelForCategory
  } from "./lib/shopBrowse.js";
  import {
    applyDefaultSeo,
    applyProductSeo,
    applyShopPage,
    applySupportSeo,
    productCanonicalPath,
    loadSeoSettings
  } from "./lib/pageSeo.js";
  import {
    getSupportPage,
    supportTopicFromPath,
    supportPath,
    SUPPORT_PAGES
  } from "./lib/supportContent.js";
  import { productMatchesQuery as matchQ, matchedPhotoIndex } from "./lib/search.js";
  import { productAsPhoto } from "./lib/productPhotos.js";
  import AppDownloadActions from "./components/AppDownloadActions.svelte";
  import { pushBrowse } from "./lib/browsingHistory.js";
  import {
    cartCount,
    cartDrawerOpen,
    openCartDrawer,
    closeCartDrawer,
    addToCart
  } from "./lib/stores/cart.js";

  let tab = "shop";
  let search = "";
  let categories = [];
  /** Admin → Groups (Men, Women, Recommended…); undefined until loaded = built-in list. */
  let merchGroups = undefined;
  let products = [];
  let activeCategory = "All";
  let activeGroup = null;
  let browseMode = BROWSE_RECOMMENDED;
  let loading = true;
  let error = "";
  let selected = null;
  let viewportW = 390;
  let shopFeedExtraBatches = 0;
  let supportTopic = "support";
  let accountSection = "hub";
  let accountRefresh = 0;
  let browseGroups = null;
  let categoryImages = {};
  let lastSearchValue = "";
  /** @type {{ category: string, group: string | null, browseMode: string, activeChipId: string, fromNav: string } | null} */
  let browseState = null;

  function productFromPath(pathname) {
    const m = pathname.match(/^\/p\/([^/?#]+)/);
    if (!m) return null;
    const key = decodeURIComponent(m[1]);
    return products.find((p) => p.slug === key || p.id === key) || null;
  }

  function openSupportFromUrl(pathname) {
    const topic = supportTopicFromPath(pathname);
    if (!topic) return false;
    selected = null;
    supportTopic = topic;
    tab = "support";
    applySupportSeo(getSupportPage(topic));
    return true;
  }

  function syncBrowserPath(path = "/") {
    if (typeof window === "undefined") return;
    const target = path || "/";
    if (window.location.pathname !== target) {
      history.pushState({}, "", target);
    }
  }

  function clearProductPathFromUrl() {
    const path = window.location.pathname;
    if (path.startsWith("/p/") || path.startsWith("/help/")) {
      syncBrowserPath("/");
    }
  }

  function openFromUrl() {
    const pathname = window.location.pathname;
    if (openSupportFromUrl(pathname)) return;
    const p = productFromPath(pathname);
    if (p) {
      selectedPhotoIndex = 0;
      selected = p;
      tab = "shop";
      applyProductSeo(p, null, priceParts, coverUrl);
      tick().then(() => window.scrollTo(0, 0));
    } else {
      const y = listScrollY;
      listScrollY = null;
      selected = null;
      browseState = null;
      activeCategory = "All";
      activeGroup = null;
      browseMode = BROWSE_RECOMMENDED;
      if (tab !== "support") {
        tab = "shop";
        applyDefaultSeo();
      }
      if (y != null) tick().then(() => window.scrollTo(0, y));
    }
  }

  function onPopState() {
    const pathname = window.location.pathname;
    if (openSupportFromUrl(pathname)) return;
    const p = productFromPath(pathname);
    if (p) {
      selectedPhotoIndex = 0;
      selected = p;
      tab = "shop";
      applyProductSeo(p, null, priceParts, coverUrl);
      tick().then(() => window.scrollTo(0, 0));
    } else {
      const y = listScrollY;
      listScrollY = null;
      selected = null;
      browseState = null;
      activeCategory = "All";
      activeGroup = null;
      browseMode = BROWSE_RECOMMENDED;
      tab = "shop";
      applyDefaultSeo();
      if (y != null) tick().then(() => window.scrollTo(0, y));
    }
  }

  function onHelpLinkClick(e) {
    const a = e.target.closest?.("a[href^='/help/']");
    if (!a) return;
    e.preventDefault();
    const topic = supportTopicFromPath(a.getAttribute("href") || "");
    if (topic) handleSupportAction(topic);
  }

  const PAGE_SEO_KEY = {
    shop: "home",
    trends: "newIn",
    browse: "categories",
    category: "categories",
    cart: "cart",
    checkout: "checkout",
    account: "orders",
    support: "support"
  };

  $: if (!selected && tab !== "support") {
    applyShopPage(search.trim() ? "search" : PAGE_SEO_KEY[tab] || "home");
  }

  onMount(async () => {
    loadSeoSettings().then(() => {
      if (!selected) applyShopPage(PAGE_SEO_KEY[tab] || "home");
    });
    // Send any orders from this browser the admin has not received yet (background).
    syncOrdersToAdmin();
    loadMerchGroups().then((list) => (merchGroups = list));
    try {
      categories = await loadCategories();
      products = await loadProducts();
      const menu = await loadBrowseMenu();
      browseGroups = menu.groups;
      const imageMap = await loadCategoryImageMap();
      categoryImages = { ...imageMap, ...(menu.categoryImages || {}) };
      error = "";
    } catch (e) {
      products = await loadProducts();
      categories = await loadCategories();
      error = products.length ? "" : e.message || "Failed to load shop";
    } finally {
      loading = false;
      openFromUrl();
    }
    window.addEventListener("popstate", onPopState);
    syncViewport();
    window.addEventListener("resize", syncViewport);
  });

  onDestroy(() => {
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("resize", syncViewport);
  });

  function syncViewport() {
    viewportW = window.innerWidth;
  }

  function loadMoreFeed() {
    shopFeedExtraBatches += 1;
    requestAnimationFrame(() => {
      document.getElementById("product-feed-see-more")?.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
      });
    });
  }

  function goHome() {
    focusReviewForm = false;
    selected = null;
    browseState = null;
    // Home / logo always shows the full shop, not the last search results.
    search = "";
    lastSearchValue = "";
    tab = "shop";
    browseMode = BROWSE_RECOMMENDED;
    activeCategory = "All";
    activeGroup = null;
    closeCartDrawer();
    applyDefaultSeo();
    clearProductPathFromUrl();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let focusReviewForm = false;
  /** Photo to show first on the product page (set when a named photo was searched / picked). */
  let selectedPhotoIndex = 0;
  /** Where the shop list was when a product was opened. */
  let listScrollY = null;

  function addFromGrid(p) {
    if (productNeedsSize(p)) {
      openProduct(p);
      return;
    }
    addToCart(p, 1);
  }

  function openProduct(p, opts = {}) {
    const full = products.find((x) => x.id === p.id) || p;
    pushBrowse(full);
    selectedPhotoIndex = Number.isInteger(p?.photoIndex) ? p.photoIndex : 0;
    if (!selected) listScrollY = window.scrollY || 0;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    selected = full;
    focusReviewForm = !!opts.review;
    tab = browseState ? "browse" : "shop";
    applyProductSeo(full, null, priceParts, coverUrl);
    const path = productCanonicalPath(full);
    if (window.location.pathname !== path) {
      history.pushState({}, "", path);
    }
    tick().then(() => window.scrollTo(0, 0));
  }

  function shouldUseCategoryBrowse({ category = "All", group = null } = {}) {
    return !!(group || (category && category !== "All"));
  }

  function openCategoryBrowse({
    category = "All",
    group = null,
    browseMode: mode = BROWSE_RECOMMENDED,
    activeChipId = "all",
    fromNav = "shop"
  } = {}) {
    selected = null;
    closeCartDrawer();
    search = "";
    browseMode = mode || BROWSE_RECOMMENDED;
    browseState = {
      category: category || "All",
      group: group || null,
      browseMode: browseMode,
      activeChipId: activeChipId || "all",
      fromNav
    };
    activeCategory = category || "All";
    activeGroup = group || null;
    tab = "browse";
    applyDefaultSeo();
    clearProductPathFromUrl();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exitCategoryBrowse() {
    if (browseState?.fromNav === "category") {
      tab = "category";
    } else {
      goHome();
      return;
    }
    browseState = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pickShopBrowse({
    category = "All",
    group = null,
    browseMode: mode = BROWSE_RECOMMENDED
  } = {}) {
    if (shouldUseCategoryBrowse({ category, group })) {
      openCategoryBrowse({ category, group, browseMode: mode, fromNav: "shop" });
      return;
    }
    selected = null;
    closeCartDrawer();
    browseState = null;
    activeCategory = category || "All";
    activeGroup = group || null;
    browseMode = mode || BROWSE_RECOMMENDED;
    search = "";
    tab = "shop";
    applyDefaultSeo();
    clearProductPathFromUrl();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applySearchQuery(q, { scroll = false } = {}) {
    search = q;
    lastSearchValue = q.trim();
    if (q.trim()) {
      activeCategory = "All";
      activeGroup = null;
      selected = null;
      closeCartDrawer();
      tab = "shop";
      applyDefaultSeo();
      clearProductPathFromUrl();
      if (scroll) {
        setTimeout(() => {
          document.getElementById("product-feed")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    }
  }

  function runSearch() {
    applySearchQuery(search, { scroll: true });
  }

  /** Live filter while typing; leave product page only when the query changes. */
  $: {
    const q = search.trim();
    if (q !== lastSearchValue) {
      if (q) {
        activeCategory = "All";
        activeGroup = null;
        if (tab !== "shop" && tab !== "trends") tab = "shop";
        if (selected) selected = null;
      }
      lastSearchValue = q;
    }
  }

  function goCheckout() {
    closeCartDrawer();
    selected = null;
    tab = "checkout";
    window.scrollTo({ top: 0 });
  }

  function handleAccountAction(id) {
    selected = null;
    accountSection = id || "hub";
    tab = "account";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function completeCheckout(order) {
    saveOrder(order);
    // Also send it (and any earlier unsent orders) to the admin; never blocks checkout.
    syncOrdersToAdmin();
    if (order.name || order.phone) {
      saveProfile({ name: order.name, phone: order.phone });
    }
    if (order.status === "paid") {
      try {
        products = await loadProducts();
      } catch {
        /* keep current list */
      }
    }
    tab = "account";
    accountSection = "orders";
    accountRefresh += 1;
    window.scrollTo({ top: 0 });
  }

  function applyCategorySelection({
    filterCategory,
    query,
    tab: targetTab = "shop",
    browseMode: mode = BROWSE_RECOMMENDED
  }) {
    if (filterCategory) {
      openCategoryBrowse({
        category: filterCategory,
        browseMode: mode,
        fromNav: targetTab === "category" ? "category" : "shop"
      });
      return;
    }
    selected = null;
    closeCartDrawer();
    browseState = null;
    browseMode = mode || BROWSE_RECOMMENDED;
    if (query) {
      search = query;
      activeCategory = "All";
    } else if (filterCategory) {
      activeCategory = filterCategory;
      activeGroup = null;
      search = "";
    } else {
      activeCategory = "All";
      activeGroup = null;
      search = "";
    }
    tab = targetTab;
    applyDefaultSeo();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (targetTab === "shop" || filterCategory || query) {
      setTimeout(() => {
        document.getElementById("product-feed")?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }

  function handleCategorySub(sub) {
    const sel = selectionFromSub(sub);
    if (sel.filterCategory) {
      const chipId =
        sub.label === `Shop ${sel.filterCategory}` || sub.label === sel.filterCategory
          ? "all"
          : sub.label;
      openCategoryBrowse({
        category: sel.filterCategory,
        browseMode: sel.browseMode,
        activeChipId: chipId,
        fromNav: "category"
      });
      return;
    }
    if (sel.query && !sel.tab) {
      openCategoryBrowse({
        category: "All",
        browseMode: sel.browseMode,
        activeChipId: sub.label,
        fromNav: "category"
      });
      return;
    }
    applyCategorySelection(sel);
  }

  function handleSupportAction(id) {
    selected = null;
    closeCartDrawer();
    supportTopic = SUPPORT_PAGES[id] ? id : "support";
    tab = "support";
    const path = supportPath(supportTopic);
    if (window.location.pathname !== path) {
      history.pushState({}, "", path);
    }
    applySupportSeo(getSupportPage(supportTopic));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** In search results, a product found by a photo name shows that photo and name. */
  function withSearchPhotos(list, q) {
    if (!q.trim()) return list;
    return list.map((p) => {
      const i = matchedPhotoIndex(p, q);
      return i >= 0 ? productAsPhoto(p, i) : p;
    });
  }

  // search / category / group / browseMode are listed so the feed refilters while typing.
  $: shopProducts = withSearchPhotos(
    filterShopProducts(products, {
      search,
      category: activeCategory,
      group: activeGroup,
      browseMode,
      matchQuery: matchQ
    }),
    search
  );
  $: feedGridCols =
    viewportW >= 900 ? 5 : viewportW >= 520 ? 3 : 2;
  /** Temu-like depth: ~80 rows on phone (2 col), then “See more” loads another batch. */
  $: feedInitialRows =
    feedGridCols <= 2 ? 80 : feedGridCols === 3 ? 12 : 8;
  $: feedBatchSize = feedInitialRows * feedGridCols;
  $: feedShowLimit = feedBatchSize * (1 + shopFeedExtraBatches);
  $: visibleFeedProducts = shopProducts.slice(0, feedShowLimit);
  $: canLoadMoreFeed = visibleFeedProducts.length < shopProducts.length;
  let lastFeedFilterKey = "";
  $: {
    const key = `${tab}|${activeCategory}|${activeGroup}|${browseMode}|${search.trim()}`;
    if (key !== lastFeedFilterKey) {
      lastFeedFilterKey = key;
      shopFeedExtraBatches = 0;
    }
  }
  $: lightningProducts = (() => {
    const onSale = products.filter((p) => Number(p.offerPercentage) > 0);
    const list = (onSale.length ? onSale : products).slice();
    list.sort((a, b) => (Number(b.offerPercentage) || 0) - (Number(a.offerPercentage) || 0));
    return list;
  })();
  $: browsePills = buildBrowsePills(categories, merchGroups);
  /** Keep pill highlight in sync with category browse (desktop + mobile). */
  $: interestCategory = browseState?.category ?? activeCategory;
  $: interestGroup = browseState?.group ?? activeGroup;
  $: interestBrowseMode = browseState?.browseMode ?? browseMode;
  $: showingFiltered =
    !search.trim() &&
    (browseMode === BROWSE_NEW_IN || activeGroup || activeCategory !== "All");
  $: filterLabel =
    browseMode === BROWSE_NEW_IN
      ? "New In"
      : activeGroup
        ? activeGroup
        : activeCategory !== "All"
          ? pillLabelForCategory(activeCategory)
          : "";
  $: headerTab =
    tab === "account"
      ? "me"
      : tab === "cart"
        ? "cart"
        : tab === "browse"
          ? browseState?.fromNav === "category"
            ? "category"
            : "shop"
          : tab;
  $: bottomNavActive =
    tab === "account"
      ? "me"
      : tab === "checkout" || tab === "cart"
        ? "cart"
        : $cartDrawerOpen
          ? "cart"
          : tab === "browse"
            ? browseState?.fromNav === "category"
              ? "category"
              : "shop"
            : tab === "category"
              ? "category"
              : selected
                ? browseState
                  ? browseState.fromNav === "category"
                    ? "category"
                    : "shop"
                  : "shop"
                : tab === "support"
                  ? "shop"
                  : tab;
  $: browseChips =
    browseState && browseGroups
      ? browseChipsForCategory(browseState.category, browseGroups)
      : browseState
        ? browseChipsForCategory(browseState.category, [])
        : [];
  $: browseActiveChip =
    browseChips.find((c) => c.id === browseState?.activeChipId) || browseChips[0] || null;
  $: browseGridProducts =
    browseState && browseActiveChip
      ? productsForBrowseChip(products, browseActiveChip, {
          group: browseState.group,
          browseMode: browseState.browseMode
        })
      : [];
  $: browseTitle =
    browseState?.group ||
    (browseState?.category && browseState.category !== "All"
      ? pillLabelForCategory(browseState.category)
      : "Shop");

  function closeProductView() {
    selected = null;
    focusReviewForm = false;
    applyDefaultSeo();
    clearProductPathFromUrl();
    if (browseState) {
      tab = "browse";
    } else {
      tab = "shop";
    }
    const y = listScrollY ?? 0;
    listScrollY = null;
    tick().then(() => window.scrollTo(0, y));
  }

  function onBottomNavChange(id) {
    closeCartDrawer();
    selected = null;
    if (id === "me") {
      tab = "account";
      accountSection = "hub";
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (id === "cart") {
      openCartDrawer();
      return;
    }
    if (id === "shop") {
      goHome();
      return;
    }
    if (id === "category") {
      browseState = null;
    }
    tab = id;
    clearProductPathFromUrl();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openNewInBrowse() {
    pickShopBrowse({ category: "All", group: null, browseMode: BROWSE_NEW_IN });
  }

  function openRecommendedBrowse() {
    pickShopBrowse({ category: "All", group: null, browseMode: BROWSE_RECOMMENDED });
  }
  $: supportInfo = getSupportPage(supportTopic);
</script>

<svelte:window on:click={onHelpLinkClick} />

<div class="site">
  <TemuHeader
    bind:search
    {products}
    {categories}
    {browseGroups}
    {categoryImages}
    onCategoryPick={applyCategorySelection}
    shopBrowseMode={browseMode}
    onOpenNewIn={openNewInBrowse}
    onOpenRecommended={openRecommendedBrowse}
    activeTab={headerTab === "cart" || headerTab === "checkout" || headerTab === "support" ? "shop" : headerTab}
    cartCount={$cartCount}
    onTab={(id) => {
      if (id === "me") {
        tab = "account";
        accountSection = "hub";
        closeCartDrawer();
        clearProductPathFromUrl();
      } else if (id === "cart") {
        openCartDrawer();
        selected = null;
      } else if (id === "shop") {
        goHome();
      } else {
        tab = id;
        closeCartDrawer();
        selected = null;
        clearProductPathFromUrl();
      }
    }}
    onSearch={runSearch}
    onApplyQuery={(q) => applySearchQuery(q, { scroll: true })}
    onPickProduct={openProduct}
    onOpenCart={openCartDrawer}
    onAccountAction={handleAccountAction}
    onSupportAction={handleSupportAction}
  />

  <CartDrawer onGoCart={() => {
    closeCartDrawer();
    selected = null;
    tab = "cart";
  }} onCheckout={goCheckout} />

  {#if (tab === "shop" || tab === "trends" || selected) && tab !== "checkout" && tab !== "cart" && tab !== "account" && tab !== "support" && tab !== "browse"}
    <div class="bleed-block">
      {#if !selected}
        <HeroBanner onShop={goHome} />
      {/if}
      <TrustGreenBar onAction={handleSupportAction} />
    </div>
  {/if}

  {#if selected}
    <main class="site-main product-detail-page">
      {#if !loading && products.length}
        <div class="category-strip browse-block pdp-pills">
          <InterestPills
            pills={browsePills}
            activeCategory={interestCategory}
            activeGroup={interestGroup}
            browseMode={interestBrowseMode}
            onPick={pickShopBrowse}
          />
        </div>
      {/if}
      <ProductDetail
        product={selected}
        initialPhoto={selectedPhotoIndex}
        {products}
        {focusReviewForm}
        onBack={closeProductView}
        onOpenProduct={openProduct}
        onAddToCart={addFromGrid}
      />
    </main>
  {:else if tab === "browse" && browseState}
    <main class="site-main browse-main">
      <CategoryBrowseView
        title={browseTitle}
        chips={browseChips}
        activeChipId={browseState.activeChipId}
        products={browseGridProducts}
        allProducts={products}
        {categoryImages}
        browseMode={browseState.browseMode}
        group={browseState.group}
        onPickChip={(chip) => {
          browseState = { ...browseState, activeChipId: chip.id };
        }}
        onOpenProduct={openProduct}
        onAddToCart={addFromGrid}
        onBack={exitCategoryBrowse}
      />
    </main>
  {:else if tab === "checkout"}
    <main class="site-main">
      <CheckoutPage
        {products}
        onBack={() => (tab = "cart")}
        onSuccess={completeCheckout}
        onGoShop={goHome}
        onOpenProduct={openProduct}
        onOpenWallet={() => {
          selected = null;
          tab = "account";
          accountSection = "wallet";
          window.scrollTo({ top: 0 });
        }}
      />
    </main>
  {:else if tab === "cart"}
    <main class="site-main">
      <ShopCartPage onCheckout={goCheckout} />
    </main>
  {:else if tab === "support"}
    <main class="site-main">
      <InfoPage title={supportInfo.title} onBack={goHome}>
        {@html supportInfo.body}
      </InfoPage>
    </main>
  {:else if tab === "account"}
    <main class="site-main account-main">
      <button type="button" class="back-shop" on:click={goHome}><i class="fa fa-arrow-left" aria-hidden="true"></i> Back to shop</button>
      <AccountSectionView
        section={accountSection}
        refreshKey={accountRefresh}
        {products}
        onNavigateSection={(id) => {
          accountSection = id;
          accountRefresh += 1;
        }}
        onOpenProduct={openProduct}
        onGoShop={goHome}
        onGoCart={() => {
          selected = null;
          tab = "cart";
        }}
        onOpenHelp={handleSupportAction}
      />
    </main>
  {:else}
    <main class="site-main" class:category-main={tab === "category"}>
      <h1 class="sr-only">Bagz Apple Services — authentic iPhones, Apple, Pixel &amp; Samsung devices in Kampala</h1>
      {#if tab === "shop" || tab === "trends"}
       <div class="shop-layout">
        <aside class="shop-side" aria-label="Categories">
          <CategorySidebar side="left" groups={resolveMenuGroups(categories, browseGroups)} onPick={handleCategorySub} />
        </aside>
        <div class="shop-content">
        {#if search.trim()}
          <p class="search-hint">Results for “{search.trim()}” · {shopProducts.length} items</p>
        {/if}
        {#if !loading && products.length}
          <div class="category-strip">
            <InterestPills
              pills={browsePills}
              activeCategory={interestCategory}
              activeGroup={interestGroup}
              browseMode={interestBrowseMode}
              onPick={pickShopBrowse}
            />
          </div>
        {/if}

        {#if showingFiltered && !browseState}
          <p class="filter-hint" aria-live="polite">
            Showing <strong>{filterLabel}</strong>
            · {shopProducts.length} {shopProducts.length === 1 ? "item" : "items"}
            <button type="button" class="clear-filter" on:click={() => pickShopBrowse({ category: "All", group: null })}>
              Clear filter
            </button>
          </p>
        {/if}

        {#if !loading && lightningProducts.length}
          <div class="lightning-section">
            <LightningDealsRow
              products={lightningProducts}
              onOpen={openProduct}
              onSeeAll={() => (tab = "trends")}
            />
          </div>
        {/if}

        <div id="product-feed">
          {#if loading}
            <div class="skeleton-grid">
              {#each Array(12) as _}
                <div class="sk" />
              {/each}
            </div>
          {:else if error}
            <p class="status err">{error}</p>
          {:else}
            <div class="product-grid">
              {#each visibleFeedProducts as product, i (product.id)}
                <ProductCard
                  {product}
                  index={i}
                  onOpen={openProduct}
                  onAddToCart={addFromGrid}
                />
              {/each}
            </div>
            {#if search.trim() && shopProducts.length === 0}
              <p class="status empty-search"><i class="fa fa-search" aria-hidden="true"></i> Sorry, item not found</p>
            {:else if !search.trim() && (activeCategory !== "All" || activeGroup) && shopProducts.length === 0}
              <p class="status empty-filter">
                No products in <strong>{filterLabel}</strong> yet. Add products in Admin → Products: set
                <strong>Category</strong>{#if activeGroup} and tick <strong>Groups → {activeGroup}</strong>{/if}, then
                save. Or pick another filter above.
              </p>
            {/if}
            {#if canLoadMoreFeed}
              <div id="product-feed-see-more" class="see-more-wrap">
                <button type="button" class="see-more" on:click={loadMoreFeed}>
                  See more
                  <TemuIcon name="chevronDown" size={18} color="#fff" strokeWidth={2.25} />
                </button>
              </div>
            {/if}
          {/if}
        </div>
        </div>
       </div>

      {:else if tab === "category"}
        <CategoryMenuPanel
          {categories}
          {products}
          {browseGroups}
          {categoryImages}
          variant="page"
          onPick={handleCategorySub}
        />
      {/if}
    </main>
  {/if}

  <footer class="site-footer">
    <div class="footer-cols">
      <div>
        <strong>Get to know us</strong>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("about")}>About Bagz</button>
        {#each BRAND.branches as b}
          <p class="foot-note"><strong>{b.name}:</strong> {b.address}</p>
        {/each}
      </div>
      <div>
        <strong>Customer service</strong>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("shipping")}>Delivery info</button>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("protection")}>Warranty &amp; authenticity</button>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("seller")}>Swap &amp; top-up</button>
        <a class="foot-link" href="tel:{$liveContact.call || BRAND.contact.phoneTel}">Call {$liveContact.call || BRAND.contact.phoneDisplay}</a>
        {#if $liveContact.whatsapp}
          <a class="foot-link" href="https://wa.me/{$liveContact.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp us</a>
        {/if}
      </div>
      <div>
        <strong>Help</strong>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("support")}>Support center</button>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("privacy")}>Privacy policy</button>
        <button type="button" class="foot-link" on:click={() => handleSupportAction("terms")}>Terms of use</button>
      </div>
      <div>
        <strong>Download</strong>
        <p class="foot-note">Quick install (web app) or native app from the stores.</p>
        <AppDownloadActions layout="footer" />
      </div>
    </div>
    <p class="copy">© {new Date().getFullYear()} {BRAND.legalName} · Prices in UGX {#each $liveContact.socials as s}
        · <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}><i class="fa fa-{s.icon}" aria-hidden="true"></i> {s.label}</a>
      {/each}</p>
  </footer>

  <PromoPopup suppressed={tab === "checkout" || tab === "cart"} />

  {#if !selected && tab !== "checkout"}
    <FloatActions onFeedback={() => handleSupportAction("chat")} />
  {/if}

  <div class="mobile-nav" aria-hidden="false">
    <BottomNav active={bottomNavActive} cartCount={$cartCount} onChange={onBottomNavChange} />
  </div>
</div>

<style>
  .merch-desktop {
    display: block;
  }
  .browse-block {
    margin-bottom: 8px;
  }
  .category-strip {
    position: sticky;
    top: 0;
    z-index: 8;
    background: #f5f5f5;
    padding: 6px 0 4px;
    margin: 0 -12px;
    padding-left: 12px;
    padding-right: 12px;
  }
  .lightning-section {
    margin: 8px 0 12px;
  }
  @media (max-width: 899px) {
    /*
      Product page mobile: big image → option photos → breadcrumbs → title/price.
      Desktop order unchanged (pills above full detail).
    */
    .product-detail-page {
      display: flex;
      flex-direction: column;
    }
    /* ProductDetail classes are scoped — must pierce with :global */
    .product-detail-page :global(.pdp) {
      display: contents;
    }
    .product-detail-page :global(.pdp-gallery) {
      order: 1;
    }
    .product-detail-page :global(.pdp-colors) {
      order: 2;
    }
    /* Mobile: the top interest pills are hidden; "Explore your interests" stays further down. */
    .product-detail-page .pdp-pills {
      display: none;
    }
    .product-detail-page :global(.pdp-crumbs) {
      order: 4;
    }
    .product-detail-page :global(.pdp-intro) {
      order: 5;
    }
    .product-detail-page :global(.pdp-rest) {
      order: 6;
    }
    .product-detail-page :global(.pdp-footer) {
      order: 7;
    }
    .product-detail-page :global(.pdp-explore) {
      order: 8;
    }
    .product-detail-page :global(.pdp-reviews) {
      order: 9;
    }
  }
  @media (max-width: 900px) {
    .lightning-section {
      margin: 6px -4px 10px;
    }
    .category-strip {
      top: var(--mobile-header-offset);
      margin-top: 0;
      padding-top: 4px;
      padding-bottom: 2px;
    }
    .product-detail-page .pdp-pills.category-strip {
      top: auto;
    }
    .site-footer {
      display: none;
    }
  }
  .search-hint {
    font-size: var(--text-sm);
    margin: 0 0 10px;
    color: var(--text-secondary);
  }
  .filter-hint {
    font-size: var(--text-sm);
    margin: 0 0 10px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    color: var(--text-secondary);
  }
  .filter-hint strong {
    color: var(--text-primary);
  }
  .clear-filter {
    margin-left: 10px;
    border: none;
    background: transparent;
    color: var(--header-orange);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .empty-filter {
    text-align: center;
    padding: 24px 16px;
    max-width: 420px;
    margin: 16px auto;
  }
  .account-main {
    background: #fff;
    padding: 16px;
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    border-radius: 8px;
    max-width: 720px;
  }
  .back-shop {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 999px;
    padding: 8px 14px;
    margin-bottom: 12px;
    cursor: pointer;
    font-size: var(--text-sm);
  }
  .product-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .category-main {
    padding-top: 4px;
    padding-bottom: 8px;
  }
  .browse-main {
    padding-top: 8px;
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
  @media (max-width: 900px) {
    .product-grid {
      gap: 4px;
    }
    .category-main {
      padding-left: 0;
      padding-right: 0;
      margin-left: -12px;
      margin-right: -12px;
      width: calc(100% + 24px);
    }
  }
  @media (min-width: 520px) {
    .product-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 900px) {
    .product-grid {
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
  }
  @media (min-width: 1280px) {
    .product-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  @media (min-width: 900px) {
    .skeleton-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  .sk {
    aspect-ratio: 1;
    background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
    border-radius: 4px;
  }
  .status {
    padding: 16px 4px;
    font-size: var(--text-base);
  }
  .status.err {
    color: #b91c1c;
  }
  .empty-search {
    text-align: center;
    color: var(--text-secondary);
    line-height: 1.55;
    padding: 24px 12px;
  }
  .page-title {
    font-size: var(--text-lg);
    font-weight: 700;
    margin: 12px 2px;
  }
  .see-more-wrap {
    padding: 8px 12px 16px;
  }
  .see-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    line-height: 1.2;
    width: 100%;
    max-width: 420px;
    margin: 12px auto 0;
    padding: 12px 24px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(180deg, #5bbde9 0%, #1673c4 100%);
    color: #fff;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(22, 115, 196, 0.35);
  }
  .see-more:hover {
    filter: brightness(1.05);
  }
  .see-more-wrap .see-more {
    display: flex;
    width: 100%;
  }
  .site-footer {
    background: #121212;
    color: #bbb;
    padding: 28px 12px 20px;
    margin-top: 16px;
  }
  .footer-cols {
    max-width: var(--page-max);
    margin: 0 auto;
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  .footer-cols strong {
    color: #fff;
    display: block;
    margin-bottom: 8px;
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .foot-link {
    display: block;
    color: #999;
    font-size: var(--text-xs);
    margin-bottom: 4px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  a.foot-link {
    text-decoration: none;
  }
  a.foot-link:hover,
  button.foot-link:hover {
    color: #2ba8e0;
  }
  .copy a {
    color: #999;
  }
  .foot-note {
    margin-top: 4px !important;
  }
  .footer-cols p {
    font-size: var(--text-xs);
    margin: 0;
    color: #999;
  }
  .copy {
    text-align: center;
    font-size: 11px;
    margin: 20px 0 0;
    color: #666;
  }
  .mobile-nav {
    display: block;
  }
  @media (min-width: 901px) {
    .mobile-nav {
      display: none;
    }
  }
  /* Shop page: sticky category menu on the left of the feed (wide screens); hidden on phones. */
  .shop-side {
    display: none;
  }
  @media (min-width: 1100px) {
    .shop-layout {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .shop-side {
      display: block;
      position: sticky;
      top: 175px; /* below the sticky desktop header (~163px) */
      margin-top: 12px;
      z-index: 30;
    }
    .shop-content {
      min-width: 0;
    }
  }
</style>
