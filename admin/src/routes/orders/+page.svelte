<script lang="ts">
  import { onMount } from "svelte";
  import { fetchOrders } from "$lib/data/orders";
  import type { QueryDocumentSnapshot } from "firebase/firestore";
  
  let orders: any[] = [];
  let filteredOrders: any[] = [];
  let searchTerm = "";
  let bucket = "all";
  let fromDate = "";
  let toDate = "";
  let loading = true;
  let loadingMore = false;
  let error = "";
  let lastVisibleDoc: QueryDocumentSnapshot | undefined = undefined;
  let hasMore = true;
  const PAGE_SIZE = 50;

  function orderBucket(order: any): "successful" | "failed" | "attempted" {
    const pay = String(order.paymentStatus || "").toLowerCase();
    const status = String(order.orderStatus || order.status || "").toLowerCase();
    if (pay === "paid" || ["confirmed", "delivered", "completed", "successful", "success"].includes(status)) {
      return "successful";
    }
    if (pay === "failed" || status === "failed" || status === "cancelled" || status === "canceled") {
      return "failed";
    }
    return "attempted";
  }

  function dayString(d: Date): string {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  }

  function applyRange(preset: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    if (preset === "yesterday") {
      start.setDate(start.getDate() - 1);
      fromDate = dayString(start);
      toDate = dayString(start);
      return;
    }
    if (preset === "week") start.setDate(start.getDate() - 6);
    else if (preset === "month") start.setMonth(start.getMonth() - 1);
    else if (preset === "3months") start.setMonth(start.getMonth() - 3);
    else if (preset === "6months") start.setMonth(start.getMonth() - 6);
    else if (preset === "year") start.setFullYear(start.getFullYear() - 1);
    fromDate = dayString(start);
    toDate = dayString(today);
  }

  function orderDay(order: any): string {
    const val = order.timestamp || order.createdAt || order.date;
    if (!val) return "";
    const d = val?.seconds ? new Date(val.seconds * 1000) : new Date(val);
    if (isNaN(d.getTime())) return "";
    return dayString(d);
  }

  $: {
    const term = searchTerm.trim().toLowerCase();
    filteredOrders = orders.filter((order) => {
      if (bucket !== "all" && orderBucket(order) !== bucket) return false;
      const day = orderDay(order);
      if (fromDate && day && day < fromDate) return false;
      if (toDate && day && day > toDate) return false;
      if (!term) return true;
      return (
        order.id?.toLowerCase().includes(term) ||
        order.orderStatus?.toLowerCase().includes(term) ||
        order.paymentStatus?.toLowerCase().includes(term) ||
        order.customerName?.toLowerCase().includes(term) ||
        productNames(order).toLowerCase().includes(term) ||
        order.address?.phone?.includes(term) ||
        order.address?.city?.toLowerCase().includes(term)
      );
    });
  }

  function productNames(order: any): string {
    const rows = Array.isArray(order.products) ? order.products : Array.isArray(order.items) ? order.items : [];
    const names = rows
      .map((row: any) => {
        const name = String(row?.product?.name || row?.name || row?.productName || "").trim();
        const qty = Number(row?.quantity || row?.qty || 1);
        if (!name) return "";
        return qty > 1 ? `${name} × ${qty}` : name;
      })
      .filter(Boolean);
    return names.join(", ");
  }

  function money(value: any): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return `UGX ${amount.toLocaleString("en-UG")}`;
  }

  function statusLabel(value: any): string {
    const raw = String(value || "").replaceAll("_", " ").trim();
    if (!raw) return "—";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function formatDate(val: any): string {
    if (!val) return "N/A";
    const d = val?.seconds ? new Date(val.seconds * 1000) : new Date(val);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  onMount(async () => {
    try {
      const res = await fetchOrders(PAGE_SIZE);
      orders = res.items;
      lastVisibleDoc = res.docs.length > 0 ? res.docs[res.docs.length - 1] : undefined;
      hasMore = res.docs.length === PAGE_SIZE;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    loadingMore = true;
    error = "";
    try {
      const res = await fetchOrders(PAGE_SIZE, lastVisibleDoc);
      orders = [...orders, ...res.items];
      lastVisibleDoc = res.docs.length > 0 ? res.docs[res.docs.length - 1] : undefined;
      hasMore = res.docs.length === PAGE_SIZE;
    } catch (err: any) {
      error = err.message;
    } finally {
      loadingMore = false;
    }
  }
</script>

<div class="filters">
  <button type="button" class:active={bucket === "all"} on:click={() => (bucket = "all")}>All</button>
  <button type="button" class:active={bucket === "successful"} on:click={() => (bucket = "successful")}>Successful</button>
  <button type="button" class:active={bucket === "attempted"} on:click={() => (bucket = "attempted")}>Attempted</button>
  <button type="button" class:active={bucket === "failed"} on:click={() => (bucket = "failed")}>Failed</button>
  <label>From <input type="date" bind:value={fromDate} /></label>
  <label>To <input type="date" bind:value={toDate} /></label>
  <button type="button" on:click={() => applyRange("today")}>Today</button>
  <button type="button" on:click={() => applyRange("yesterday")}>Yesterday</button>
  <button type="button" on:click={() => applyRange("week")}>Last week</button>
  <button type="button" on:click={() => applyRange("month")}>Last month</button>
  <button type="button" on:click={() => applyRange("3months")}>Last 3 months</button>
  <button type="button" on:click={() => applyRange("6months")}>Last 6 months</button>
  <button type="button" on:click={() => applyRange("year")}>Last year</button>
</div>

<div class="header-container">
  <h1>Orders</h1>
  <input
    type="text"
    bind:value={searchTerm}
    placeholder="Search orders..."
    class="search-input"
  />
</div>

{#if loading}
  <p>Loading...</p>
{:else if error}
  <p style="color: red">{error}</p>
{:else}
  <div class="table-card">
  <table>
    <thead>
      <tr>
        <th>Order</th>
        <th>Product</th>
        <th>Customer</th>
        <th>Date</th>
        <th>Status</th>
        <th>Payment</th>
        <th>Total</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each filteredOrders as order}
        {@const kind = orderBucket(order)}
        <tr>
          <td class="order-id">{order.id}</td>
          <td class="product">{productNames(order) || "—"}</td>
          <td>
            <div class="customer">{order.customerName || "—"}</div>
            <div class="muted">{order.customerPhone || order.address?.phone || ""}</div>
          </td>
          <td class="nowrap">{formatDate(order.timestamp || order.createdAt || order.date)}</td>
          <td><span class="pill {kind}">{statusLabel(order.orderStatus || order.status)}</span></td>
          <td><span class="pill {kind}">{statusLabel(order.paymentStatus)}</span></td>
          <td class="money">{money(order.totalPrice)}</td>
          <td><a class="view" href={`/orders/${order.id}`}>View</a></td>
        </tr>
      {/each}
      {#if filteredOrders.length === 0}
        <tr>
          <td colspan="8" class="empty">No orders found.</td>
        </tr>
      {/if}
    </tbody>
  </table>
  </div>

  {#if hasMore}
    <div class="load-more-container">
      <button class="btn btn-secondary" on:click={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading...' : 'Load More Orders'}
      </button>
    </div>
  {/if}
{/if}

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 18px;
    padding: 12px;
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 14px;
  }
  .filters button,
  .filters input {
    padding: 8px 12px;
    border: 1px solid #e7e5e4;
    border-radius: 999px;
    background: #fafaf9;
    color: #44403c;
    cursor: pointer;
    font-size: 13px;
  }
  .filters button.active {
    background: #c2410c;
    border-color: #c2410c;
    color: #fff;
  }
  .filters label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #57534e;
  }
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  .header-container h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.03em;
  }
  .search-input {
    padding: 10px 14px;
    border: 1px solid #e7e5e4;
    border-radius: 999px;
    font-size: 14px;
    width: 260px;
    background: #fff;
  }
  .table-card {
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 16px;
    overflow: auto;
  }
  table { width: 100%; border-collapse: collapse; min-width: 860px; }
  th, td { padding: 12px 14px; text-align: left; vertical-align: top; }
  th {
    background: #fafaf9;
    color: #78716c;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-bottom: 1px solid #e7e5e4;
  }
  td { border-bottom: 1px solid #f5f5f4; font-size: 14px; color: #1c1917; }
  tr:last-child td { border-bottom: none; }
  .order-id { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #57534e; }
  .product { font-weight: 600; max-width: 280px; }
  .customer { font-weight: 600; }
  .muted { color: #78716c; font-size: 12px; margin-top: 2px; }
  .nowrap { white-space: nowrap; }
  .money { font-weight: 700; white-space: nowrap; }
  .empty { text-align: center; padding: 28px; color: #78716c; }
  .pill {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: #f5f5f4;
    color: #44403c;
  }
  .pill.successful { background: #dcfce7; color: #166534; }
  .pill.failed { background: #fee2e2; color: #991b1b; }
  .pill.attempted { background: #ffedd5; color: #9a3412; }
  .view {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 999px;
    background: #fff7ed;
    color: #c2410c;
    font-weight: 700;
    text-decoration: none;
  }
  .btn {
    padding: 10px 20px;
    border-radius: 999px;
    text-decoration: none;
    cursor: pointer;
    border: none;
    font-size: 14px;
    color: white;
  }
  .btn-secondary { background-color: #44403c; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .load-more-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    padding: 8px 0 20px;
  }
</style>
