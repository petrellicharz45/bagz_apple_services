<script lang="ts">
  import { onMount } from "svelte";
  import { to } from "$lib/paths";
  import "$lib/styles/opsPages.css";
  import { fetchAllProducts } from "$lib/data/products";
  import { fetchOrdersForAnalytics } from "$lib/data/orders";
  import { fetchAllUsersAndAdmins } from "$lib/data/users";
  import {
    fetchAdminNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    syncAdminNotifications,
    unreadCount,
    type AdminNotification
  } from "$lib/data/adminNotifications";

  let loading = true;
  let items: AdminNotification[] = [];
  let tab: "all" | "stock" | "order" | "user" | "payment" | "system" = "all";

  async function load() {
    loading = true;
    try {
      const [products, orders, users] = await Promise.all([
        fetchAllProducts(),
        fetchOrdersForAnalytics(200),
        fetchAllUsersAndAdmins()
      ]);
      await syncAdminNotifications({
        products,
        orders,
        users: users.map((u) => ({ id: u.id, email: u.email }))
      });
      items = await fetchAdminNotifications(80);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  $: filtered = items.filter((n) => tab === "all" || n.type === tab || (tab === "order" && n.type === "payment"));

  async function readOne(n: AdminNotification) {
    if (!n.read) await markNotificationRead(n.id);
    n.read = true;
    items = [...items];
    if (n.href) window.location.href = to(n.href);
  }

  async function readAll() {
    await markAllNotificationsRead(items);
    items = items.map((n) => ({ ...n, read: true }));
  }
</script>

<h1>Notifications</h1>
<p class="ops-intro">Stock alerts (≤30% of baseline), new orders, registrations, and system events. Use the bell in the top bar for quick access.</p>

<div class="ops-filters">
  <div class="tabs">
    <button type="button" class:active={tab === "all"} on:click={() => (tab = "all")}>All</button>
    <button type="button" class:active={tab === "stock"} on:click={() => (tab = "stock")}>Stock</button>
    <button type="button" class:active={tab === "order"} on:click={() => (tab = "order")}>Orders</button>
    <button type="button" class:active={tab === "user"} on:click={() => (tab = "user")}>Users</button>
    <button type="button" class:active={tab === "payment"} on:click={() => (tab = "payment")}>Sales</button>
  </div>
  <button type="button" class="ops-btn ghost" on:click={readAll} disabled={unreadCount(items) === 0}>Mark all read</button>
  <button type="button" class="ops-btn ghost" on:click={load}>Refresh</button>
</div>

{#if loading}
  <p>Loading…</p>
{:else}
  <ul class="inbox">
    {#each filtered as n}
      <li class:unread={!n.read}>
        <button type="button" class="inbox-row" on:click={() => readOne(n)}>
          <span class="type type-{n.type}">{n.type}</span>
          <div class="body">
            <strong>{n.title}</strong>
            <p>{n.message}</p>
            <small>{n.createdAt ? n.createdAt.toLocaleString("en-GB") : ""}</small>
          </div>
          {#if !n.read}<span class="dot-unread" aria-label="Unread"></span>{/if}
        </button>
      </li>
    {:else}
      <li class="empty">No notifications in this tab.</li>
    {/each}
  </ul>
{/if}

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tabs button {
    border: 1px solid #e2e8f0;
    background: #fff;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }
  .tabs button.active {
    background: #13344f;
    color: #fff;
    border-color: #13344f;
  }
  .inbox {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .inbox-row {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: start;
    text-align: left;
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 8px;
    background: #fff;
    cursor: pointer;
  }
  li.unread .inbox-row {
    border-color: #cbe8f7;
    background: #fffbeb;
  }
  .type {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 6px;
    background: #f1f5f9;
  }
  .type-stock {
    background: #fee2e2;
    color: #b91c1c;
  }
  .type-order,
  .type-payment {
    background: #e0f1fa;
    color: #13344f;
  }
  .type-user {
    background: #dbeafe;
    color: #1d4ed8;
  }
  .body p {
    margin: 4px 0;
    font-size: 13px;
    color: #475569;
  }
  .body small {
    color: #94a3b8;
  }
  .dot-unread {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #1673c4;
    margin-top: 6px;
  }
  .empty {
    padding: 24px;
    color: #64748b;
  }
</style>
