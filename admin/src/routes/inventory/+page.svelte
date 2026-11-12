<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import "$lib/styles/opsPages.css";
  import { fetchAllProducts } from "$lib/data/products";
  import { toInventoryRow, type InventoryRow } from "$lib/commerce/inventory";

  let loading = true;
  let error = "";
  let rows: InventoryRow[] = [];
  let tab: "low" | "high" | "all" = "low";
  let q = "";

  onMount(async () => {
    const urlQ = $page.url.searchParams.get("q");
    if (urlQ) q = urlQ;
    try {
      const products = await fetchAllProducts();
      rows = products.map((p) => toInventoryRow(p as InventoryRow & { id: string }));
      rows.sort((a, b) => a.stock - b.stock);
    } catch (e: any) {
      error = e?.message || "Could not load inventory.";
    } finally {
      loading = false;
    }
  });

  $: filtered = rows.filter((r) => {
    if (q.trim() && !r.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (tab === "low") return r.band === "low" || r.band === "out";
    if (tab === "high") return r.band === "high";
    return true;
  });

  $: lowCount = rows.filter((r) => r.band === "low" || r.band === "out").length;
  $: highCount = rows.filter((r) => r.band === "high").length;
  $: outCount = rows.filter((r) => r.band === "out").length;
</script>

<h1>Inventory</h1>
<p class="ops-intro">
  Low stock uses ≤30% of baseline stock (set <code>stockBaseline</code> on a product, or defaults to max(stock, 10)).
  Alerts also appear in the bell inbox.
</p>

{#if loading}
  <p>Loading inventory…</p>
{:else if error}
  <p>{error}</p>
{:else}
  <div class="ops-kpis">
    <div class="ops-kpi"><span>Out of stock</span><strong>{outCount}</strong></div>
    <div class="ops-kpi"><span>Low / critical</span><strong>{lowCount}</strong></div>
    <div class="ops-kpi"><span>Healthy stock</span><strong>{highCount}</strong></div>
    <div class="ops-kpi"><span>Total SKUs</span><strong>{rows.length}</strong></div>
  </div>

  <div class="ops-filters">
    <div class="tabs">
      <button type="button" class:active={tab === "low"} on:click={() => (tab = "low")}>Low stock</button>
      <button type="button" class:active={tab === "high"} on:click={() => (tab = "high")}>High stock</button>
      <button type="button" class:active={tab === "all"} on:click={() => (tab = "all")}>All</button>
    </div>
    <label>
      Search
      <input type="search" bind:value={q} placeholder="Product name" />
    </label>
  </div>

  <section class="ops-panel">
    <table class="ops-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>On hand</th>
          <th>Baseline</th>
          <th>% left</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as row}
          <tr>
            <td>
              <div class="prod-cell">
                {#if row.image}<img src={row.image} alt="" />{/if}
                {row.name}
              </div>
            </td>
            <td>{row.category || "—"}</td>
            <td>{row.stock}</td>
            <td>{row.baseline}</td>
            <td>{row.stockPct}%</td>
            <td>
              <span class="ops-pill {row.band === 'high' ? 'high' : row.band === 'out' ? 'out' : 'low'}">
                {row.band === "out" ? "Out" : row.band === "low" ? "Low" : row.band === "medium" ? "Medium" : "OK"}
              </span>
            </td>
            <td><a class="ops-btn ghost" href="/products/{row.id}">Edit</a></td>
          </tr>
        {:else}
          <tr><td colspan="7">No products in this view.</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<style>
  .tabs {
    display: flex;
    gap: 8px;
  }
  .tabs button {
    border: 1px solid #e2e8f0;
    background: #fff;
    padding: 8px 14px;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
  }
  .tabs button.active {
    background: #f97316;
    color: #fff;
    border-color: #f97316;
  }
  .prod-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .prod-cell img {
    width: 36px;
    height: 36px;
    object-fit: cover;
    border-radius: 6px;
  }
  a.ops-btn {
    text-decoration: none;
    display: inline-block;
  }
  code {
    font-size: 12px;
    background: #f1f5f9;
    padding: 2px 4px;
    border-radius: 4px;
  }
</style>
