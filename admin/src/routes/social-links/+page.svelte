<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, runTransaction } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { showSuccessToast } from "$lib/stores/toast";
  import { SOCIAL_PLATFORMS, platformInfo, type SocialLink } from "$lib/social";
  import SocialIconPicker from "$lib/components/social/SocialIconPicker.svelte";
  import SocialLogo from "$lib/components/social/SocialLogo.svelte";

  if (!db) throw new Error("Firebase is not configured");
  const firestore = db;
  const socialDoc = doc(firestore, "settings", "social");

  /** Move the item with `id` one step in the LATEST list (not a stale index). */
  function moveById<T extends { id: string }>(items: T[], id: string, delta: number): T[] {
    const i = items.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }


  let links: SocialLink[] = [];
  let loading = true;
  let saving = false;
  let errorMsg = "";

  /** Form used for both "add" (editingId = null) and "edit". */
  let formOpen = false;
  let editingId: string | null = null;
  let platform = "instagram";
  let url = "";
  let label = "";
  let icon = "";
  let active = true;

  onMount(async () => {
    try {
      const snap = await getDoc(socialDoc);
      const items = snap.exists() ? snap.data().items : null;
      if (Array.isArray(items)) {
        links = items.map((l: SocialLink) => ({ ...l, active: l.active !== false }));
      } else {
        // One-time import of the older per-field links saved in settings/config.socialLinks.
        const cfg = await getDoc(doc(db!, "settings", "config"));
        const old = (cfg.exists() && cfg.data().socialLinks) || {};
        links = Object.entries(old)
          .filter(([, v]) => typeof v === "string" && /^https:\/\//i.test(v as string))
          .map(([k, v]) => ({ id: crypto.randomUUID(), platform: k in SOCIAL_PLATFORMS ? k : "other", url: v as string, active: true }));
      }
    } catch (e: any) {
      errorMsg = "Could not load social links: " + e.message;
    } finally {
      loading = false;
    }
  });

  /** Apply `update` to the latest list in a transaction (safe with several admins / tabs). */
  async function persist(update: (items: SocialLink[]) => SocialLink[], message: string) {
    saving = true;
    errorMsg = "";
    try {
      const seed = links;
      const next = await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(socialDoc);
        // First save may come from the one-time import of old settings/config links (held in `seed`).
        const items = snap.exists() && Array.isArray(snap.data().items) ? (snap.data().items as SocialLink[]) : seed;
        const updated = update(items);
        tx.set(socialDoc, { items: updated });
        return updated;
      });
      links = next.map((l) => ({ ...l, active: l.active !== false }));
      showSuccessToast(message);
      return true;
    } catch (e: any) {
      errorMsg = "Could not save: " + e.message;
      return false;
    } finally {
      saving = false;
    }
  }

  function openAdd() {
    editingId = null;
    platform = "instagram";
    url = "";
    label = "";
    icon = "";
    active = true;
    formOpen = true;
  }

  function openEdit(link: SocialLink) {
    editingId = link.id;
    platform = link.platform in SOCIAL_PLATFORMS ? link.platform : "other";
    url = link.url;
    label = link.label || "";
    icon = link.icon || "";
    active = link.active !== false;
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editingId = null;
  }

  async function submitForm() {
    const clean = url.trim();
    if (!/^https:\/\/\S+$/i.test(clean)) {
      errorMsg = "The link must be a full address starting with https://";
      return;
    }
    if (platform === "other" && !label.trim()) {
      errorMsg = "Give the link a name (e.g. Threads) when the platform is “Other”.";
      return;
    }
    const entry: SocialLink = { id: editingId || crypto.randomUUID(), platform, url: clean, active };
    if (label.trim()) entry.label = label.trim();
    if (platform === "other" && icon) entry.icon = icon;
    const isEdit = Boolean(editingId);
    const ok = await persist(
      (items) => (isEdit ? items.map((l) => (l.id === entry.id ? entry : l)) : [...items, entry]),
      isEdit ? "Social link updated." : "Social link added."
    );
    if (ok) closeForm();
  }

  function move(index: number, delta: number) {
    const id = links[index]?.id;
    if (!id) return;
    void persist((items) => moveById(items, id, delta), "Order saved.");
  }

  function toggle(link: SocialLink) {
    const show = !link.active;
    void persist(
      (items) => items.map((l) => (l.id === link.id ? { ...l, active: show } : l)),
      show ? "Visible on the shop." : "Hidden from the shop."
    );
  }

  function remove(link: SocialLink) {
    if (!confirm(`Delete the ${link.label || platformInfo(link.platform).label} link?`)) return;
    if (editingId === link.id) closeForm();
    void persist((items) => items.filter((l) => l.id !== link.id), "Social link deleted.");
  }
</script>

<div class="page">
  <div class="header">
    <div>
      <h1><i class="fa fa-share-alt" aria-hidden="true"></i> Social links</h1>
      <p class="intro">Profiles shown in the shop footer and on the customer “You” page. Only visible links appear on the shop.</p>
    </div>
    {#if !formOpen}
      <button type="button" class="primary" on:click={openAdd}>
        <i class="fa fa-plus" aria-hidden="true"></i> Add social link
      </button>
    {/if}
  </div>

  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}

  {#if formOpen}
    <form class="card form" on:submit|preventDefault={submitForm}>
      <h2>{editingId ? "Edit social link" : "Add social link"}</h2>
      <div class="field">
        <span>Platform or icon</span>
        <SocialIconPicker bind:platform bind:icon />
      </div>
      <label>
        Profile link
        <input type="url" inputmode="url" bind:value={url} placeholder={platformInfo(platform).placeholder} required />
      </label>
      <label>
        Display name <span class="opt">{platform === "other" ? "required — shown next to the icon" : "optional"}</span>
        <input type="text" bind:value={label} placeholder={platformInfo(platform).label} />
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={active} /> Show on the shop
      </label>
      <div class="form-actions">
        <button type="submit" class="primary" disabled={saving}>
          <i class="fa fa-check" aria-hidden="true"></i> {saving ? "Saving…" : editingId ? "Save changes" : "Add link"}
        </button>
        <button type="button" class="ghost" on:click={closeForm}>Cancel</button>
      </div>
    </form>
  {/if}

  <div class="card">
    {#if loading}
      <p class="muted">Loading…</p>
    {:else if links.length === 0}
      <p class="muted">No social links yet. Click <strong>Add social link</strong> to add your first one.</p>
    {:else}
      <table>
        <thead>
          <tr><th>Platform</th><th>Link</th><th>Status</th><th class="right">Actions</th></tr>
        </thead>
        <tbody>
          {#each links as link, index (link.id)}
            <tr class:dim={!link.active}>
              <td class="platform">
                <span class="plat-cell">
                  <SocialLogo platform={link.platform in SOCIAL_PLATFORMS ? link.platform : "other"} icon={link.icon || ""} size={28} />
                  {link.label || platformInfo(link.platform).label}
                </span>
              </td>
              <td class="url"><a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a></td>
              <td>
                {#if link.active}
                  <span class="badge on">Visible</span>
                {:else}
                  <span class="badge off">Hidden</span>
                {/if}
              </td>
              <td class="right actions">
                <button type="button" title="Move up" aria-label="Move up" disabled={index === 0 || saving} on:click={() => move(index, -1)}><i class="fa fa-arrow-up"></i></button>
                <button type="button" title="Move down" aria-label="Move down" disabled={index === links.length - 1 || saving} on:click={() => move(index, 1)}><i class="fa fa-arrow-down"></i></button>
                <button type="button" title={link.active ? "Hide" : "Show"} aria-label={link.active ? "Hide" : "Show"} disabled={saving} on:click={() => toggle(link)}><i class="fa {link.active ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                <button type="button" title="Edit" aria-label="Edit" disabled={saving} on:click={() => openEdit(link)}><i class="fa fa-pencil"></i></button>
                <button type="button" class="danger" title="Delete" aria-label="Delete" disabled={saving} on:click={() => remove(link)}><i class="fa fa-trash-o"></i></button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<style>
  .page {
    max-width: 980px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 22px;
  }
  .intro,
  .muted {
    color: #6b7280;
    margin: 0;
  }
  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
  }
  .form {
    display: grid;
    gap: 12px;
    max-width: 560px;
  }
  .form h2 {
    margin: 0;
    font-size: 17px;
  }
  .form > label,
  .field {
    display: grid;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }
  .opt {
    font-weight: 400;
    font-size: 12px;
    color: #6b7280;
  }
  input[type="url"],
  input[type="text"],
  select {
    padding: 9px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font: inherit;
    font-weight: 400;
  }
  .form-actions {
    display: flex;
    gap: 8px;
  }
  .primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #1673c4;
    color: #fff;
    border: 0;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 700;
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.6;
  }
  .ghost {
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
  }
  .alert.error {
    background: #fef2f2;
    color: #b91c1c;
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
  }
  th {
    color: #64748b;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  tr.dim td {
    opacity: 0.55;
  }
  .platform {
    font-weight: 600;
    white-space: nowrap;
  }
  .plat-cell {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .url {
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .url a {
    color: #1673c4;
  }
  .right {
    text-align: right;
  }
  .actions {
    white-space: nowrap;
  }
  .actions button {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #13344f;
    cursor: pointer;
    margin-left: 2px;
  }
  .actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .actions button.danger {
    color: #b91c1c;
    border-color: #fecaca;
  }
  .badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .badge.on {
    background: #e0f1fa;
    color: #135fa3;
  }
  .badge.off {
    background: #fef3c7;
    color: #92400e;
  }
  @media (max-width: 700px) {
    .url {
      max-width: 140px;
    }
  }
</style>
