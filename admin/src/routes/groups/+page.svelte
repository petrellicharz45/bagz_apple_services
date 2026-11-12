<script lang="ts">
  import { onMount } from "svelte";
  import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch
  } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { NOT_A_CATEGORY, loadGroups, saveGroups } from "$lib/data/groups";

  let groups: string[] = [];
  let loading = true;
  let busy = false;
  let errorMsg = "";
  let successMsg = "";

  let newGroupName = "";
  let renamingGroup = "";
  let renameValue = "";

  onMount(async () => {
    groups = await loadGroups();
    loading = false;
    await loadLegacyRecommended();
  });

  // ---- One-off: products whose *category* is still "Recommended" (from before it became a group) ----
  type LegacyRow = { ref: any; name: string; category: string };
  let legacyRows: LegacyRow[] = [];
  let categoryChoices: string[] = [];
  let applyingLegacy = false;

  /** First match wins, so the order matters (e.g. "Dress And Bag set" → Clothing, "Flat Shoes" → Shoes). */
  const CATEGORY_KEYWORDS: [string, RegExp][] = [
    ["Shoes", /\b(shoes?|sandals?|mules|sneakers?|slides|loafers|heels|boots?)\b/i],
    ["Jewelry", /\b(watch(es)?|bracelets?|necklaces?|earrings?|jewel\w*|pendant)\b/i],
    ["Beauty", /\b(wigs?|hair|perfume|parfum|deodorant|nail|odor|spray|skincare|clay|panty pads|lipstick|makeup)\b/i],
    ["Clothing", /\bdress(es)?\b/i], // "Dress with matching hat" is still a dress
    ["Accessories", /\b(arm sleeves|beanie|hats?|caps?|blanket|incense|sunglasses|scarf)\b/i],
    ["Clothing", /\b(dress(es)?|shirts?|t-shirt|tee|pants|trousers|shorts|set|romper|bodysuit|jumpsuit|vest|top|skirt|leggings|pajama|sweatshirt|pullover|thobe|kaftan|apron|outfit|tracksuit|sportswear|hoodie|jacket|clothes|clothing|socks|lingerie|panties|panty|bra|briefs|thong|knickers|underwear|shapewear|waist|ensemble|polo|tank)\b/i],
    ["Bags", /\b(bags?|backpack|handbag|purse|wallet)\b/i]
  ];

  function guessCategory(name: string): string {
    for (const [cat, re] of CATEGORY_KEYWORDS) {
      if (re.test(name) && categoryChoices.includes(cat)) return cat;
    }
    return "";
  }

  async function loadLegacyRecommended() {
    try {
      const catSnap = await getDoc(doc(db!, "settings", "categories"));
      categoryChoices = Object.keys(catSnap.exists() ? catSnap.data() : {}).filter((c) => c !== NOT_A_CATEGORY);
      const snap = await getDocs(query(collection(db!, "product"), where("category", "==", NOT_A_CATEGORY)));
      legacyRows = snap.docs.map((d) => {
        const name = String(d.data().name || "");
        return { ref: d.ref, name, category: guessCategory(name) };
      });
    } catch (e: any) {
      errorMsg = "Failed to load old Recommended products: " + e.message;
    }
  }

  async function applyLegacy() {
    const missing = legacyRows.filter((r) => !r.category).length;
    if (missing) {
      errorMsg = `Pick a category for the ${missing} product${missing === 1 ? "" : "s"} marked “choose…” first.`;
      return;
    }
    if (!window.confirm(`Move ${legacyRows.length} products to the categories shown and tick the Recommended group on all of them?`)) return;
    applyingLegacy = true;
    errorMsg = "";
    successMsg = "";
    try {
      if (!groups.includes(NOT_A_CATEGORY)) {
        groups = [...groups, NOT_A_CATEGORY];
        await saveGroups(groups);
      }
      for (let i = 0; i < legacyRows.length; i += 400) {
        const batch = writeBatch(db!);
        for (const r of legacyRows.slice(i, i + 400)) {
          batch.update(r.ref, { category: r.category, groups: arrayUnion(NOT_A_CATEGORY) });
        }
        await batch.commit();
      }
      successMsg = `Done: ${legacyRows.length} products moved to real categories and kept in the Recommended group. You can now delete the “Recommended” category under Categories.`;
      legacyRows = [];
    } catch (e: any) {
      errorMsg = "Failed to update products: " + e.message;
    } finally {
      applyingLegacy = false;
    }
  }

  function exists(name: string, except = "") {
    return groups.some((g) => g !== except && g.toLowerCase() === name.toLowerCase());
  }

  /** Apply one change to every product that has `group` in its groups list. */
  async function updateProductsInGroup(group: string, change: (ref: any, batch: any) => void): Promise<number> {
    const snap = await getDocs(query(collection(db!, "product"), where("groups", "array-contains", group)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db!);
      for (const p of snap.docs.slice(i, i + 400)) change(p.ref, batch);
      await batch.commit();
    }
    return snap.size;
  }

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    if (exists(name)) {
      errorMsg = `Group "${name}" already exists!`;
      return;
    }
    busy = true;
    errorMsg = "";
    successMsg = "";
    try {
      const next = [...groups, name];
      await saveGroups(next);
      groups = next;
      newGroupName = "";
      successMsg = `Added group "${name}". It now shows as a checkbox in the product form.`;
    } catch (e: any) {
      errorMsg = "Failed to add group: " + e.message;
    } finally {
      busy = false;
    }
  }

  function startRename(group: string) {
    renamingGroup = group;
    renameValue = group;
  }

  function cancelRename() {
    renamingGroup = "";
    renameValue = "";
  }

  async function confirmRename(oldName: string) {
    const newName = renameValue.trim();
    if (!newName) {
      errorMsg = "Group name cannot be empty.";
      return;
    }
    if (newName === oldName) {
      cancelRename();
      return;
    }
    if (exists(newName, oldName)) {
      errorMsg = `Group "${newName}" already exists!`;
      return;
    }
    busy = true;
    errorMsg = "";
    successMsg = "";
    try {
      const next = groups.map((g) => (g === oldName ? newName : g));
      await saveGroups(next);
      groups = next;
      // arrayUnion and arrayRemove can't both target `groups` in one update, so do two passes.
      const moved = await updateProductsInGroup(oldName, (ref, batch) =>
        batch.update(ref, { groups: arrayUnion(newName) })
      );
      await updateProductsInGroup(oldName, (ref, batch) => batch.update(ref, { groups: arrayRemove(oldName) }));
      successMsg = `Renamed "${oldName}" to "${newName}" (${moved} product${moved === 1 ? "" : "s"} updated).`;
      cancelRename();
    } catch (e: any) {
      errorMsg = "Failed to rename group: " + e.message;
    } finally {
      busy = false;
    }
  }

  async function deleteGroup(name: string) {
    if (!window.confirm(`Delete the "${name}" group? Products keep their category; they are just untagged from this group.`)) return;
    busy = true;
    errorMsg = "";
    successMsg = "";
    try {
      const next = groups.filter((g) => g !== name);
      await saveGroups(next);
      groups = next;
      const removed = await updateProductsInGroup(name, (ref, batch) =>
        batch.update(ref, { groups: arrayRemove(name) })
      );
      successMsg = `Deleted group "${name}" (${removed} product${removed === 1 ? "" : "s"} untagged).`;
    } catch (e: any) {
      errorMsg = "Failed to delete group: " + e.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="header">
  <h1>Manage Groups</h1>
  <a href="/" class="back-link">← Back to Dashboard</a>
</div>

<p>
  Groups are the tick-boxes in the product form (Men, Women, Kids, Recommended…). A product can be in many groups;
  they show as filters in the shop. Products in <strong>Recommended</strong> are shown first in the shop's Recommended feed.
</p>

{#if loading}
  <p>Loading...</p>
{:else}
  <div class="add-card">
    <h3>Add New Group</h3>
    <div class="form-row">
      <input
        type="text"
        bind:value={newGroupName}
        placeholder="Enter new group name (e.g. Teens)"
        disabled={busy}
        on:keydown={(e) => { if (e.key === 'Enter') addGroup(); }}
      />
      <button class="add-btn" on:click={addGroup} disabled={busy || !newGroupName.trim()}>Add Group</button>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success">{successMsg}</div>
  {/if}

  <div class="groups-list">
    {#each groups as group (group)}
      <div class="group-row">
        {#if renamingGroup === group}
          <input
            type="text"
            bind:value={renameValue}
            on:keydown={(e) => { if (e.key === 'Enter') confirmRename(group); if (e.key === 'Escape') cancelRename(); }}
          />
          <button class="rename-confirm-btn" on:click={() => confirmRename(group)} disabled={busy}>✓</button>
          <button class="rename-cancel-btn" on:click={cancelRename}>✕</button>
        {:else}
          <span class="group-name">{group}</span>
          <button class="rename-btn" on:click={() => startRename(group)} disabled={busy}>Rename</button>
          <button class="delete-btn" on:click={() => deleteGroup(group)} disabled={busy}>Delete</button>
        {/if}
      </div>
    {/each}
    {#if groups.length === 0}
      <p>No groups yet — add one above.</p>
    {/if}
  </div>

  {#if legacyRows.length}
    <div class="legacy">
      <h2>{legacyRows.length} products still have “Recommended” as their category</h2>
      <p>
        Each got a suggested category from its name. Check the list, change any that are wrong, then click
        <strong>Apply</strong>. All of them will also be ticked in the <strong>Recommended</strong> group.
      </p>
      <table>
        <thead>
          <tr><th>#</th><th>Product</th><th>New category</th></tr>
        </thead>
        <tbody>
          {#each legacyRows as row, i}
            <tr class:unsure={!row.category}>
              <td>{i + 1}</td>
              <td class="pname">{row.name}</td>
              <td>
                <select bind:value={row.category} disabled={applyingLegacy}>
                  <option value="">choose…</option>
                  {#each categoryChoices as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button class="add-btn" on:click={applyLegacy} disabled={applyingLegacy}>
        {applyingLegacy ? "Applying..." : `Apply to ${legacyRows.length} products`}
      </button>
    </div>
  {/if}
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .back-link {
    color: #f97316;
    text-decoration: none;
  }
  .alert {
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
  }
  .error { background: #ffebee; color: #c62828; }
  .success { background: #e8f5e9; color: #2e7d32; }

  .add-card {
    background: #fff;
    border: 1px solid #dee2e6;
    padding: 20px;
    border-radius: 8px;
    margin: 20px 0 30px;
    max-width: 500px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .add-card h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 16px;
    color: #1b1512;
  }
  .form-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .form-row input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
  }
  .add-btn {
    padding: 10px 18px;
    background: #f97316;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .groups-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 600px;
  }
  .group-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 10px 14px;
  }
  .group-row input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
  }
  .group-name {
    flex: 1;
    font-weight: 600;
    color: #1b1512;
  }
  .rename-btn,
  .delete-btn,
  .rename-confirm-btn,
  .rename-cancel-btn {
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 13px;
    padding: 6px 14px;
  }
  .rename-btn { background: #6c5ce7; }
  .delete-btn { background: #dc3545; }
  .rename-confirm-btn { background: #28a745; padding: 6px 10px; }
  .rename-cancel-btn { background: #6c757d; padding: 6px 10px; }
  button:disabled { opacity: 0.6; cursor: not-allowed; }

  .legacy {
    margin-top: 40px;
    max-width: 900px;
  }
  .legacy h2 {
    font-size: 18px;
    margin-bottom: 6px;
  }
  .legacy table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 13px;
  }
  .legacy th,
  .legacy td {
    border-bottom: 1px solid #eee;
    padding: 6px 8px;
    text-align: left;
    vertical-align: middle;
  }
  .legacy .pname {
    max-width: 560px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .legacy tr.unsure {
    background: #fff7ed;
  }
  .legacy select {
    padding: 4px 6px;
  }
</style>
