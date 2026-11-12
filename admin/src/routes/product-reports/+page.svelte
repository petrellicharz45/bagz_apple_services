<script lang="ts">
  import { onMount } from "svelte";
  import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
  import { db } from "$lib/firebase";

  if (!db) throw new Error("Firebase is not configured");
  const firestore = db;

  let rows: any[] = [];
  let loading = true;
  let error = "";

  function when(value: any) {
    if (!value) return "—";
    const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  onMount(async () => {
    try {
      const snap = await getDocs(query(collection(firestore, "productReport"), orderBy("createdAt", "desc"), limit(100)));
      rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (e: any) {
      error = e.message || "Could not load reports.";
    } finally {
      loading = false;
    }
  });
</script>

<h1>Wrong product info</h1>
{#if loading}
  <p>Loading...</p>
{:else if error}
  <p>{error}</p>
{:else if rows.length === 0}
  <p>No reports yet.</p>
{:else}
  <table>
    {#each rows as row}
      <tr>
        <td>{when(row.createdAt)}</td>
        <td>{row.productName || row.productId || "—"}</td>
        <td>{row.message}</td>
      </tr>
    {/each}
  </table>
{/if}

<style>
  h1 { margin: 0 0 16px; font-size: 28px; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  td { border-bottom: 1px solid #e7e5e4; padding: 12px; vertical-align: top; }
  td:first-child { white-space: nowrap; color: #57534e; }
  td:nth-child(2) { font-weight: 700; width: 28%; }
</style>
