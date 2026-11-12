<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { productMatchesSearch, deleteProduct } from "$lib/data/products";
  import {
    invalidateProductCatalog,
    loadProductCatalog,
    productCatalog
  } from "$lib/stores/catalog";
  
  let searchTerm = "";
  let loading = true;
  let error = "";
  let catalogReady = false;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;

  $: products = $productCatalog;
  $: urlQ = $page.url.searchParams.get("q") ?? "";
  let lastUrlQ = "";
  $: if (urlQ !== lastUrlQ) {
    lastUrlQ = urlQ;
    searchTerm = urlQ;
  }
  $: filteredProducts = searchTerm.trim()
    ? products.filter((p) => productMatchesSearch(p, searchTerm))
    : products;
  $: loading = !catalogReady;

  // ---------- pagination (state lives in the URL: ?page=2&per=100) ----------
  const PAGE_SIZES = [25, 50, 100, 0] as const; // 0 = all
  const LIST_URL_KEY = "admin_products_list_url";
  $: perParam = Number($page.url.searchParams.get("per") ?? 50);
  $: perPage = (PAGE_SIZES as readonly number[]).includes(perParam) ? perParam : 50;
  $: pageCount = perPage === 0 ? 1 : Math.max(1, Math.ceil(filteredProducts.length / perPage));
  $: currentPage = Math.min(Math.max(1, Number($page.url.searchParams.get("page") ?? 1) || 1), pageCount);
  $: startIndex = perPage === 0 ? 0 : (currentPage - 1) * perPage;
  $: pageProducts = perPage === 0 ? filteredProducts : filteredProducts.slice(startIndex, startIndex + perPage);
  $: rangeLabel = filteredProducts.length
    ? `Showing ${startIndex + 1}–${startIndex + pageProducts.length} of ${filteredProducts.length}`
    : "Showing 0 of 0";
  $: pageButtons = buildPageButtons(currentPage, pageCount);

  /** 1 … 4 5 [6] 7 8 … 20 */
  function buildPageButtons(cur: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | "…")[] = [1];
    const from = Math.max(2, cur - 2);
    const to = Math.min(total - 1, cur + 2);
    if (from > 2) out.push("…");
    for (let i = from; i <= to; i++) out.push(i);
    if (to < total - 1) out.push("…");
    out.push(total);
    return out;
  }

  function listUrl(opts: { q?: string; page?: number; per?: number }) {
    const params = new URLSearchParams();
    const q = (opts.q ?? searchTerm).trim();
    const per = opts.per ?? perPage;
    const pg = opts.page ?? currentPage;
    if (q) params.set("q", q);
    if (per !== 50) params.set("per", String(per));
    if (pg > 1) params.set("page", String(pg));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  function navigate(url: string, scrollTop = false) {
    try {
      sessionStorage.setItem(LIST_URL_KEY, url);
    } catch {
      /* ignore */
    }
    goto(url, { keepFocus: true, noScroll: !scrollTop, replaceState: !scrollTop });
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToPage(n: number) {
    if (n < 1 || n > pageCount || n === currentPage) return;
    navigate(listUrl({ page: n }), true);
  }

  function setPerPage(e: Event) {
    navigate(listUrl({ per: Number((e.currentTarget as HTMLSelectElement).value), page: 1 }));
  }

  function onSearchInput() {
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      // New search starts again at page 1.
      navigate(listUrl({ q: searchTerm, page: 1 }));
    }, 120);
  }

  async function fallbackFetch() {
    try {
      error = "";
      await loadProductCatalog(true);
    } catch (e: any) {
      error = "Failed to load products: " + e.message;
    }
  }

  onMount(async () => {
    try {
      sessionStorage.setItem(LIST_URL_KEY, $page.url.pathname + $page.url.search);
    } catch {
      /* ignore */
    }
    try {
      await loadProductCatalog(true);
    } catch (e: any) {
      error = "Failed to load products: " + (e?.message || "unknown error");
    } finally {
      catalogReady = true;
    }
  });

  async function handleRefresh() {
    await fallbackFetch();
  }

  async function handleDelete(productId: string) {
    if (!confirm("Are you sure you want to completely delete this product? This action cannot be undone.")) {
      return;
    }
    
    try {
      await deleteProduct(productId);
      invalidateProductCatalog();
      await loadProductCatalog(true);
    } catch (err: any) {
      alert("Error deleting product: " + err.message);
    }
  }
</script>

<div class="header-container">
  <h1>Products ({filteredProducts.length})</h1>
  <div class="header-actions">
    <input
      type="search"
      bind:value={searchTerm}
      on:input={onSearchInput}
      placeholder="Search name or category…"
      class="search-input"
      autocomplete="off"
    />
    <button on:click={handleRefresh} class="btn btn-refresh" disabled={loading}>
      {loading ? 'Loading...' : 'Refresh'}
    </button>
    <a href="/products/bulk" class="btn btn-secondary">Bulk add</a>
    <a href="/products/new" class="btn btn-primary">Create New Product</a>
  </div>
</div>

{#if error}
  <p style="color: red">{error}</p>
{/if}
{#if loading && products.length === 0}
  <p>Loading products...</p>
{:else}
  <div class="table-toolbar">
    <label class="per-page">
      Show
      <select value={String(perPage)} on:change={setPerPage} aria-label="Products per page">
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
        <option value="0">All</option>
      </select>
      per page
    </label>
    <span class="range">{rangeLabel}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Category</th>
        <th>Price</th>
        <th>Stock</th>
        <th>Shop</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each pageProducts as product (product.id)}
        <tr>
          <td>{product.name}</td>
          <td>{product.category}</td>
          <td>UGX {product.price?.toLocaleString()}</td>
          <td>{product.stock ?? 0}</td>
          <td>
            {#if product.hidden}
              <span
                class="vis-badge hidden-badge"
                title={product.hiddenReason === "no-photo"
                  ? "Add a photo to show it"
                  : product.hiddenReason === "price-check"
                    ? "Price looked wrong on the old site — fix it, then untick Hidden"
                    : "Hidden from shop"}
              >
                <i class="fa fa-eye-slash" aria-hidden="true"></i>
                {product.hiddenReason === "no-photo" ? "Needs photo" : product.hiddenReason === "price-check" ? "Check price" : "Hidden"}
              </span>
            {:else}
              <span class="vis-badge"><i class="fa fa-eye" aria-hidden="true"></i> Visible</span>
            {/if}
          </td>
          <td class="actions">
            <a href={`/products/${product.id}`} class="btn btn-edit">Edit</a>
            <button on:click={() => handleDelete(product.id)} class="btn btn-delete">Delete</button>
          </td>
        </tr>
      {/each}
      {#if filteredProducts.length === 0}
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px;">
            {searchTerm ? `No products match “${searchTerm.trim()}”.` : 'No products found.'}
          </td>
        </tr>
      {/if}
    </tbody>
  </table>

  {#if pageCount > 1}
    <nav class="pagination" aria-label="Product pages">
      <button type="button" class="pg-btn" disabled={currentPage === 1} on:click={() => goToPage(currentPage - 1)}>
        <i class="fa fa-chevron-left" aria-hidden="true"></i> Previous
      </button>
      {#each pageButtons as b}
        {#if b === "…"}
          <span class="pg-gap">…</span>
        {:else}
          <button
            type="button"
            class="pg-btn pg-num"
            class:active={b === currentPage}
            aria-current={b === currentPage ? "page" : undefined}
            on:click={() => goToPage(b)}
          >{b}</button>
        {/if}
      {/each}
      <button type="button" class="pg-btn" disabled={currentPage === pageCount} on:click={() => goToPage(currentPage + 1)}>
        Next <i class="fa fa-chevron-right" aria-hidden="true"></i>
      </button>
    </nav>
  {/if}
{/if}

<style>
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .search-input {
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    width: 280px;
  }
  table { 
    width: 100%; 
    border-collapse: collapse; 
  }
  th, td { 
    border: 1px solid #ccc; 
    padding: 12px 8px; 
    text-align: left; 
  }
  th {
    background-color: #f8f9fa;
  }
  .actions {
    display: flex;
    gap: 10px;
  }
  .btn {
    padding: 6px 12px;
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;
    border: none;
    font-size: 14px;
    color: white;
  }
  .btn-primary {
    background-color: #1673c4;
  }
  .btn-secondary {
    background-color: #475569;
  }
  .btn-edit {
    background-color: #6c757d;
  }
  .btn-delete {
    background-color: #dc3545;
  }
  .btn-refresh {
    background-color: #0d6efd;
  }
  .btn:hover {
    opacity: 0.9;
  }
  .vis-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #e0f1fa;
    color: #135fa3;
    white-space: nowrap;
  }
  .vis-badge.hidden-badge {
    background: #fef3c7;
    color: #92400e;
  }
  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .per-page {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #374151;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .per-page select {
    width: auto;
    min-width: 76px;
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font: inherit;
  }
  .range {
    font-size: 14px;
    color: #6b7280;
  }
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin: 18px 0 8px;
  }
  .pg-btn {
    min-width: 38px;
    height: 36px;
    padding: 0 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    color: #13344f;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .pg-btn:hover:not(:disabled):not(.active) {
    border-color: #2ba8e0;
    background: #eef7fc;
  }
  .pg-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .pg-btn.active {
    background: #1673c4;
    border-color: #1673c4;
    color: #fff;
    font-weight: 700;
  }
  .pg-gap {
    color: #94a3b8;
    padding: 0 2px;
  }
</style>
