<script lang="ts">
  import { onMount } from "svelte";
  import "$lib/styles/opsPages.css";
  import { fetchOrdersForAnalytics } from "$lib/data/orders";
  import {
    aggregateProductSales,
    buildDailySalesSeries,
    categoryPieParts,
    salesTodayTotal,
    salesTotal,
    paidOrdersOnly,
    orderTimestamp,
    type ProductSalesAgg
  } from "$lib/commerce/orderSales";

  let loading = true;
  let orders: Record<string, unknown>[] = [];
  let filterProduct = "";
  let filterFrom = "";
  let filterTo = "";
  let filterStatus = "paid";
  let viewProduct: ProductSalesAgg | null = null;

  onMount(async () => {
    try {
      orders = await fetchOrdersForAnalytics(500);
    } finally {
      loading = false;
    }
  });

  function ugx(n: number) {
    return `UGX ${Math.round(n).toLocaleString("en-UG")}`;
  }

  function inDateRange(order: Record<string, unknown>) {
    const d = orderTimestamp(order);
    if (!d) return true;
    if (filterFrom) {
      const from = new Date(filterFrom);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
    }
    if (filterTo) {
      const to = new Date(filterTo);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  }

  $: filteredOrders = orders.filter((o) => {
    const paid = paidOrdersOnly([o]).length > 0;
    if (filterStatus === "paid" && !paid) return false;
    if (filterStatus === "pending" && paid) return false;
    return inDateRange(o);
  });

  $: aggs = aggregateProductSales(filteredOrders);
  $: filteredAggs = filterProduct.trim()
    ? aggs.filter((a) => a.name.toLowerCase().includes(filterProduct.trim().toLowerCase()))
    : aggs;
  $: todaySales = salesTodayTotal(filteredOrders);
  $: totalSales = salesTotal(filteredOrders);
  $: mostSold = aggs[0];
  $: leastSold = aggs.length ? aggs[aggs.length - 1] : null;
  $: series = buildDailySalesSeries(filteredOrders, 14);
  $: pie = categoryPieParts(aggs);
  $: linePoints = toLine(series);

  function toLine(days: { total: number }[]) {
    const max = Math.max(...days.map((d) => d.total), 1);
    return days
      .map((d, i) => {
        const x = 24 + (i * 272) / Math.max(days.length - 1, 1);
        const y = 140 - (d.total / max) * 110;
        return `${x},${y}`;
      })
      .join(" ");
  }

  function pieSlices(parts: { pct: number }[]) {
    let offset = 0;
    const r = 40;
    const c = 2 * Math.PI * r;
    return parts.map((p) => {
      const len = (p.pct / 100) * c;
      const slice = { dash: `${len} ${c - len}`, offset: -offset };
      offset += len;
      return slice;
    });
  }

  $: slices = pieSlices(pie);
  const pieColors = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#64748b"];
</script>

<h1>Sales</h1>
<p class="ops-intro">
  Revenue counts <strong>paid</strong> orders only. Pending checkouts are excluded so totals stay at zero until money is confirmed.
</p>

{#if loading}
  <p>Loading sales data…</p>
{:else}
  <div class="ops-kpis">
    <div class="ops-kpi">
      <span>Sales today</span>
      <strong>{ugx(todaySales)}</strong>
    </div>
    <div class="ops-kpi">
      <span>Total sales (filtered)</span>
      <strong>{ugx(totalSales)}</strong>
    </div>
    <div class="ops-kpi">
      <span>Most sold product</span>
      <strong>{mostSold ? `${mostSold.name} (${mostSold.qty})` : "—"}</strong>
    </div>
    <div class="ops-kpi">
      <span>Lowest sold (in range)</span>
      <strong>{leastSold && leastSold.qty > 0 ? `${leastSold.name} (${leastSold.qty})` : "—"}</strong>
    </div>
  </div>

  <div class="ops-panels">
    <section class="ops-panel">
      <h3>Sales trend (14 days, paid)</h3>
      <svg viewBox="0 0 320 160" class="ops-chart">
        <polyline fill="none" stroke="#f97316" stroke-width="3" points={linePoints} />
        {#each series as day, i}
          <text x={24 + (i * 272) / Math.max(series.length - 1, 1)} y="155" text-anchor="middle" font-size="8" fill="#94a3b8">{day.label}</text>
        {/each}
      </svg>
    </section>
    <section class="ops-panel">
      <h3>Revenue by category</h3>
      <svg viewBox="0 0 120 120" class="ops-chart" style="max-width:200px">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#e2e8f0" stroke-width="14" />
        {#each pie as part, i}
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke={pieColors[i % pieColors.length]}
            stroke-width="14"
            stroke-dasharray={slices[i]?.dash}
            stroke-dashoffset={slices[i]?.offset}
            transform="rotate(-90 60 60)"
          />
        {/each}
      </svg>
      <ul class="pie-legend">
        {#each pie as part, i}
          <li><span class="dot" style="background:{pieColors[i % pieColors.length]}"></span>{part.label} ({part.pct.toFixed(0)}%)</li>
        {:else}
          <li>No paid sales yet</li>
        {/each}
      </ul>
    </section>
  </div>

  <section class="ops-panel">
    <h3>Product sales</h3>
    <div class="ops-filters">
      <label>
        Product name
        <input type="search" bind:value={filterProduct} placeholder="Search…" />
      </label>
      <label>
        From
        <input type="date" bind:value={filterFrom} />
      </label>
      <label>
        To
        <input type="date" bind:value={filterTo} />
      </label>
      <label>
        Payment
        <select bind:value={filterStatus}>
          <option value="paid">Paid only</option>
          <option value="pending">Pending only</option>
          <option value="all">All orders</option>
        </select>
      </label>
    </div>
    <table class="ops-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>Qty sold</th>
          <th>Orders</th>
          <th>Revenue</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredAggs as row}
          <tr>
            <td>
              <div class="prod-cell">
                {#if row.image}<img src={row.image} alt="" />{/if}
                {row.name}
              </div>
            </td>
            <td>{row.category || "—"}</td>
            <td>{row.qty}</td>
            <td>{row.orderCount}</td>
            <td>{ugx(row.revenue)}</td>
            <td><button type="button" class="ops-btn" on:click={() => (viewProduct = row)}>View</button></td>
          </tr>
        {:else}
          <tr><td colspan="6">No sales match your filters.</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

{#if viewProduct}
  <div class="ops-modal-backdrop" role="presentation" on:click={() => (viewProduct = null)} on:keydown={(e) => e.key === "Escape" && (viewProduct = null)}>
    <div class="ops-modal" role="dialog" aria-labelledby="sales-modal-title" on:click|stopPropagation>
      <h2 id="sales-modal-title">{viewProduct.name}</h2>
      <p>{viewProduct.qty} units · {viewProduct.buyers.length} line items · {ugx(viewProduct.revenue)}</p>
      <table class="ops-table">
        <thead>
          <tr><th>Customer</th><th>Phone</th><th>Qty</th><th>Order</th><th>Date</th></tr>
        </thead>
        <tbody>
          {#each viewProduct.buyers as b}
            <tr>
              <td>{b.name}</td>
              <td>{b.phone || "—"}</td>
              <td>{b.qty}</td>
              <td><a href="/orders/{b.orderId}">#{String(b.orderId).slice(-8)}</a></td>
              <td>{b.at ? b.at.toLocaleString("en-GB") : "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button type="button" class="ops-btn ghost" on:click={() => (viewProduct = null)}>Close</button>
    </div>
  </div>
{/if}

<style>
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
  .pie-legend {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    font-size: 12px;
  }
  .pie-legend li {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
</style>
