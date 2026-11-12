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

  function onSearchInput() {
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const q = searchTerm.trim();
      goto(q ? `/products?q=${encodeURIComponent(q)}` : "/products", {
        keepFocus: true,
        noScroll: true,
        replaceState: true
      });
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
      {#each filteredProducts as product}
        <tr>
          <td>{product.name}</td>
          <td>{product.category}</td>
          <td>UGX {product.price?.toLocaleString()}</td>
          <td>{product.stock ?? 0}</td>
          <td>
            {#if product.hidden}
              <span class="vis-badge hidden-badge" title={product.hiddenReason === "no-photo" ? "Add a photo to show it" : "Hidden from shop"}>
                <i class="fa fa-eye-slash" aria-hidden="true"></i> {product.hiddenReason === "no-photo" ? "Needs photo" : "Hidden"}
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
</style>
