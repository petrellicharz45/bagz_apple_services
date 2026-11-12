<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import "$lib/styles/opsPages.css";
  import { fetchAuditLogs, type AuditEntry } from "$lib/data/auditLog";

  let loading = true;
  let items: AuditEntry[] = [];
  let filterType = "";
  let filterAction = "";
  let filterFrom = "";
  let filterTo = "";

  onMount(async () => {
    const t = $page.url.searchParams.get("type");
    if (t) filterType = t;
    await reload();
  });

  async function reload() {
    loading = true;
    try {
      const from = filterFrom ? new Date(filterFrom) : undefined;
      const to = filterTo ? new Date(filterTo) : undefined;
      if (to) to.setHours(23, 59, 59, 999);
      const res = await fetchAuditLogs({
        pageSize: 120,
        entityType: filterType || undefined,
        action: filterAction || undefined,
        from,
        to
      });
      items = res.items;
    } finally {
      loading = false;
    }
  }
</script>

<h1>System insights</h1>
<p class="ops-intro">
  Audit trail for orders, products, users, tickets, and admin actions. Deploy Cloud Functions to record server-side events automatically; new admin actions also log from this console.
</p>

<div class="ops-filters">
  <label>
    Entity
    <select bind:value={filterType}>
      <option value="">All</option>
      <option value="order">Orders</option>
      <option value="product">Products</option>
      <option value="user">Users</option>
      <option value="ticket">Tickets</option>
      <option value="admin">Admin</option>
    </select>
  </label>
  <label>
    Action contains
    <input type="search" bind:value={filterAction} placeholder="e.g. payment" />
  </label>
  <label>
    From
    <input type="date" bind:value={filterFrom} />
  </label>
  <label>
    To
    <input type="date" bind:value={filterTo} />
  </label>
  <button type="button" class="ops-btn" on:click={reload}>Apply</button>
</div>

{#if loading}
  <p>Loading audit log…</p>
{:else}
  <section class="ops-panel">
    <table class="ops-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Action</th>
          <th>Entity</th>
          <th>Message</th>
          <th>Actor</th>
        </tr>
      </thead>
      <tbody>
        {#each items as row}
          <tr>
            <td>{row.createdAt ? row.createdAt.toLocaleString("en-GB") : "—"}</td>
            <td><code>{row.action}</code></td>
            <td>{row.entityType}{row.entityId ? ` · ${row.entityId}` : ""}</td>
            <td>{row.message}</td>
            <td>{row.actorEmail || row.actorUid || "system"}</td>
          </tr>
        {:else}
          <tr>
            <td colspan="5">No log entries yet. Deploy <code>audit*</code> functions and use the store to generate activity.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<style>
  code {
    font-size: 11px;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
