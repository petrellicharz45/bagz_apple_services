<script lang="ts">
  import { to } from "$lib/paths";
  import { onMount } from "svelte";
  import { fetchTickets } from "$lib/data/tickets";
  import type { QueryDocumentSnapshot } from "firebase/firestore";

  let tickets: any[] = [];
  let loading = true;
  let loadingMore = false;
  let error = "";
  let lastVisibleDoc: QueryDocumentSnapshot | undefined = undefined;
  let hasMore = true;
  let statusFilter = "All";
  const PAGE_SIZE = 20;

  onMount(async () => {
    await loadTickets();
  });

  async function loadTickets() {
    loading = true;
    error = "";
    try {
      const res = await fetchTickets(PAGE_SIZE, undefined, statusFilter);
      tickets = res.items;
      lastVisibleDoc = res.docs.length > 0 ? res.docs[res.docs.length - 1] : undefined;
      hasMore = res.docs.length === PAGE_SIZE;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    loadingMore = true;
    try {
      const res = await fetchTickets(PAGE_SIZE, lastVisibleDoc, statusFilter);
      tickets = [...tickets, ...res.items];
      lastVisibleDoc = res.docs.length > 0 ? res.docs[res.docs.length - 1] : undefined;
      hasMore = res.docs.length === PAGE_SIZE;
    } catch (err: any) {
      error = err.message;
    } finally {
      loadingMore = false;
    }
  }

  function filterByStatus(status: string) {
    statusFilter = status;
    loadTickets();
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "Open": return "#1673c4";
      case "Under Review": return "#0d6efd";
      case "Resolved": return "#198754";
      case "Rejected": return "#dc3545";
      case "Closed": return "#6c757d";
      default: return "#6c757d";
    }
  }

  function formatDate(timestamp: any) {
    if (!timestamp?.seconds) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });
  }
</script>

<h1>Support Tickets</h1>

<div class="filter-bar">
  {#each ["All", "Open", "Under Review", "Resolved", "Rejected"] as status}
    <button
      class="filter-btn"
      class:active={statusFilter === status}
      on:click={() => filterByStatus(status)}
    >
      {status}
    </button>
  {/each}
</div>

{#if loading}
  <p>Loading...</p>
{:else if error}
  <p style="color: red">{error}</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Ticket ID</th>
        <th>Issue Type</th>
        <th>Order #</th>
        <th>Status</th>
        <th>Created</th>
        <th>Credit</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each tickets as ticket}
        <tr>
          <td class="ticket-id">{ticket.id?.substring(0, 8)}...</td>
          <td>{ticket.issueType}</td>
          <td>#{ticket.orderNumber}</td>
          <td>
            <span class="status-badge" style="background-color: {getStatusColor(ticket.status)}">
              {ticket.status}
            </span>
          </td>
          <td>{formatDate(ticket.createdAt)}</td>
          <td>
            {#if ticket.walletCreditAmount > 0}
              <span class="credit-amount">UGX {ticket.walletCreditAmount.toLocaleString()}</span>
            {:else}
              —
            {/if}
          </td>
          <td>
            <a href={to(`/tickets/${ticket.id}`)}>Review</a>
          </td>
        </tr>
      {/each}
      {#if tickets.length === 0}
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px;">No tickets found.</td>
        </tr>
      {/if}
    </tbody>
  </table>

  {#if hasMore}
    <div class="load-more-container">
      <button class="btn btn-secondary" on:click={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading...' : 'Load More'}
      </button>
    </div>
  {/if}
{/if}

<style>
  .filter-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .filter-btn {
    padding: 6px 14px;
    border: 1px solid #dee2e6;
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  .filter-btn.active {
    background: #1673c4;
    color: white;
    border-color: #1673c4;
  }
  .filter-btn:hover:not(.active) {
    background: #f8f9fa;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background-color: #f8f9fa; }
  .ticket-id { font-family: monospace; font-size: 12px; color: #6c757d; }
  .status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 500;
  }
  .credit-amount {
    color: #198754;
    font-weight: 600;
  }
  .btn {
    padding: 10px 20px;
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;
    border: none;
    font-size: 14px;
    color: white;
  }
  .btn-secondary { background-color: #6c757d; }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .load-more-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    padding: 20px 0;
  }
</style>
