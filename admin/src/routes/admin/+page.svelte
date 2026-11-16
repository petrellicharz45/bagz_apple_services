<script lang="ts">
  import { onMount } from "svelte";
  import { doc, updateDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { userStore, accessStore } from "$lib/stores/auth";
  import { fetchAllUsersAndAdmins, type AppUser } from "$lib/data/users";
  import { logAdminAudit } from "$lib/data/auditLog";
  import {
    createStaff,
    listStaff,
    removeStaff,
    sendStaffPasswordReset,
    updateStaff,
    type StaffMember
  } from "$lib/data/staff";
  import {
    LEVELS,
    MODULES,
    ROLES,
    isCustomised,
    permsSummary,
    presetPerms,
    roleLabel,
    type Perms
  } from "$lib/auth/permissions";

  let staff: StaffMember[] = [];
  let loading = true;
  let errorMsg = "";
  let infoMsg = "";
  let busyUid = "";

  // ---- add / edit form ----
  let formOpen = false;
  let editing: StaffMember | null = null;
  let fName = "";
  let fEmail = "";
  let fPhone = "";
  let fPassword = "";
  let showPassword = false;
  let fRole = "sales";
  let fPerms: Perms = presetPerms("sales");
  let saving = false;
  let formError = "";

  // ---- customers (wallet) ----
  let customers: AppUser[] = [];
  let customerQuery = "";
  let customersLoaded = false;
  let customersOpen = false;

  $: me = $userStore?.uid || "";
  $: activeCount = staff.filter((s) => s.active).length;
  $: customised = fRole !== "admin" && isCustomised(fRole, fPerms);
  $: filteredCustomers = customers.filter((u) => {
    const q = customerQuery.trim().toLowerCase();
    return !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
  });

  onMount(refresh);

  async function refresh() {
    loading = true;
    errorMsg = "";
    try {
      staff = await listStaff();
    } catch (e: any) {
      errorMsg =
        e?.code === "permission-denied"
          ? "The database refused to list users. Publish the new Firestore rules (deploy-firestore-rules.cmd) and reload."
          : `Could not load users: ${e?.message || e}`;
    } finally {
      loading = false;
    }
  }

  function openAdd() {
    editing = null;
    fName = "";
    fEmail = "";
    fPhone = "";
    fPassword = "";
    showPassword = false;
    fRole = "sales";
    fPerms = presetPerms("sales");
    formError = "";
    formOpen = true;
  }

  function openEdit(s: StaffMember) {
    editing = s;
    fName = s.name;
    fEmail = s.email;
    fPhone = s.phone;
    fPassword = "";
    fRole = ROLES.some((r) => r.id === s.role) ? s.role : "sales";
    fPerms = { ...s.perms };
    formError = "";
    formOpen = true;
    setTimeout(() => document.getElementById("user-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function pickRole(id: string) {
    fRole = id;
    fPerms = presetPerms(id);
  }

  function setLevel(moduleId: string, level: string) {
    fPerms = { ...fPerms, [moduleId]: level as Perms[string] };
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    fPassword = Array.from(bytes, (b) => chars[b % chars.length]).join("") + "!7";
    showPassword = true;
  }

  async function save() {
    formError = "";
    const name = fName.trim();
    const email = fEmail.trim().toLowerCase();
    if (!name) return (formError = "Enter the person's name.");
    if (!editing) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (formError = "Enter a valid email address.");
      if (fPassword.length < 8) return (formError = "The password needs at least 8 characters.");
      if (staff.some((s) => s.email === email)) return (formError = "This email is already in the team list. Edit it there instead.");
    }
    saving = true;
    try {
      if (editing) {
        await updateStaff(editing.uid, { name, phone: fPhone.trim(), role: fRole, perms: fPerms });
        await logAdminAudit("staff.update", "staff", `${email}: role ${roleLabel(fRole)}`, editing.uid).catch(() => {});
        infoMsg = `Saved ${name}. The change applies the next time they open or reload the admin.`;
      } else {
        const res = await createStaff({ name, email, phone: fPhone, password: fPassword, role: fRole, perms: fPerms });
        await logAdminAudit("staff.create", "staff", `Added ${email} as ${roleLabel(fRole)}`, res.uid).catch(() => {});
        infoMsg = res.existingAccount
          ? `${email} already had a login, so it was given ${roleLabel(fRole)} access. They sign in with their existing password (use "Reset password" if they don't know it).`
          : `Added ${name} as ${roleLabel(fRole)}. They sign in at this admin with ${email} and the password you set.`;
      }
      formOpen = false;
      await refresh();
    } catch (e: any) {
      formError = e?.message || String(e);
    } finally {
      saving = false;
    }
  }

  async function toggleActive(s: StaffMember) {
    const turningOff = s.active;
    if (turningOff && !confirm(`Switch off ${s.name || s.email}? They will not be able to use the admin until you switch them back on.`)) return;
    busyUid = s.uid;
    errorMsg = "";
    try {
      await updateStaff(s.uid, { active: !s.active });
      await logAdminAudit(turningOff ? "staff.disable" : "staff.enable", "staff", s.email, s.uid).catch(() => {});
      infoMsg = `${s.name || s.email} is now ${turningOff ? "switched off" : "active"}.`;
      await refresh();
    } catch (e: any) {
      errorMsg = e?.message || String(e);
    } finally {
      busyUid = "";
    }
  }

  async function remove(s: StaffMember) {
    if (!confirm(`Remove ${s.name || s.email} from the team? Their admin access ends immediately. (Their login stays, so you can add the same email again later.)`)) return;
    busyUid = s.uid;
    errorMsg = "";
    try {
      await removeStaff(s.uid);
      await logAdminAudit("staff.remove", "staff", s.email, s.uid).catch(() => {});
      infoMsg = `Removed ${s.name || s.email}.`;
      if (editing?.uid === s.uid) formOpen = false;
      await refresh();
    } catch (e: any) {
      errorMsg = e?.message || String(e);
    } finally {
      busyUid = "";
    }
  }

  async function resetPassword(s: StaffMember) {
    if (!confirm(`Email ${s.email} a link to choose a new password?`)) return;
    busyUid = s.uid;
    errorMsg = "";
    try {
      await sendStaffPasswordReset(s.email);
      infoMsg = `Password reset email sent to ${s.email}. Ask them to check spam too.`;
    } catch (e: any) {
      errorMsg = e?.message || String(e);
    } finally {
      busyUid = "";
    }
  }

  async function loadCustomers() {
    customersOpen = !customersOpen;
    if (!customersOpen || customersLoaded) return;
    try {
      customers = await fetchAllUsersAndAdmins();
      customersLoaded = true;
    } catch (e: any) {
      errorMsg = `Could not load customers: ${e?.message || e}`;
    }
  }

  async function saveWallet(user: AppUser) {
    busyUid = user.id;
    try {
      const amount = Number(user.walletBalance) || 0;
      await updateDoc(doc(db!, "user", user.id), { walletBalance: amount });
      await logAdminAudit("customer.wallet", "user", `${user.email}: wallet UGX ${amount}`, user.id).catch(() => {});
      infoMsg = `Wallet updated for ${user.email}.`;
    } catch (e: any) {
      errorMsg = e?.message || String(e);
    } finally {
      busyUid = "";
    }
  }
</script>

<svelte:head>
  <title>Users & Roles — Bagz Admin</title>
</svelte:head>

<section class="hero">
  <div>
    <h1>Users &amp; Roles</h1>
    <p>Add the people who run the shop, give each one a role, and choose exactly what they can see and change.</p>
  </div>
  <button type="button" class="btn-add" on:click={openAdd}>
    <i class="fa fa-user-plus" aria-hidden="true"></i> Add user
  </button>
</section>

{#if errorMsg}<p class="msg error" role="alert">{errorMsg}</p>{/if}
{#if infoMsg}<p class="msg info" role="status">{infoMsg} <button type="button" class="x" on:click={() => (infoMsg = "")} aria-label="Dismiss">×</button></p>{/if}

{#if formOpen}
  <form id="user-form" class="panel" on:submit|preventDefault={save}>
    <h2>{editing ? `Edit ${editing.name || editing.email}` : "Add a user"}</h2>

    <div class="grid">
      <label>
        Full name
        <input bind:value={fName} required maxlength="80" autocomplete="off" placeholder="e.g. Sarah Namuli" />
      </label>
      <label>
        Email (used to sign in)
        <input
          type="email"
          bind:value={fEmail}
          required
          readonly={Boolean(editing)}
          autocomplete="off"
          placeholder="name@example.com"
        />
      </label>
      <label>
        <span>Phone <span class="opt">(optional)</span></span>
        <input bind:value={fPhone} maxlength="20" autocomplete="off" placeholder="07…" />
      </label>
      {#if !editing}
        <label>
          <span>Password <span class="opt">(8+ characters)</span></span>
          <div class="pw">
            {#if showPassword}
              <input type="text" bind:value={fPassword} required minlength="8" autocomplete="new-password" />
            {:else}
              <input type="password" bind:value={fPassword} required minlength="8" autocomplete="new-password" />
            {/if}
            <button type="button" class="ghost" on:click={() => (showPassword = !showPassword)}>{showPassword ? "Hide" : "Show"}</button>
            <button type="button" class="ghost" on:click={generatePassword}>Generate</button>
          </div>
        </label>
      {:else}
        <div class="note">
          To change {editing.name || "their"} password, use <strong>Reset password</strong> in the team list: Firebase emails them a link.
        </div>
      {/if}
    </div>

    <h3>Role</h3>
    <div class="roles">
      {#each ROLES as r}
        <button type="button" class="role" class:sel={fRole === r.id} on:click={() => pickRole(r.id)} aria-pressed={fRole === r.id}>
          <strong>{r.label}</strong>
          <span>{r.description}</span>
        </button>
      {/each}
    </div>

    <h3>
      Permissions
      {#if customised}<span class="tag">customised</span>
        <button type="button" class="link" on:click={() => (fPerms = presetPerms(fRole))}>Back to {roleLabel(fRole)} defaults</button>{/if}
    </h3>
    {#if fRole === "admin"}
      <p class="note">Admins can see and change everything, including this Users &amp; Roles page.</p>
    {:else}
      <div class="table-wrap">
        <table class="perm">
          <thead>
            <tr>
              <th>Part of the admin</th>
              {#each LEVELS as l}<th class="c">{l.label}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each MODULES as m}
              <tr>
                <td><strong>{m.label}</strong><small>{m.pages}</small></td>
                {#each LEVELS as l}
                  <td class="c">
                    <input
                      type="radio"
                      name="perm-{m.id}"
                      value={l.id}
                      checked={(fPerms[m.id] || "none") === l.id}
                      on:change={() => setLevel(m.id, l.id)}
                      aria-label="{m.label}: {l.label}"
                    />
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="note">Everyone can open the Dashboard, Notifications and their own account. Only Admins manage users.</p>
    {/if}

    {#if formError}<p class="msg error" role="alert">{formError}</p>{/if}
    <div class="actions">
      <button type="submit" class="btn-primary" disabled={saving}>
        {saving ? "Saving…" : editing ? "Save changes" : "Add user"}
      </button>
      <button type="button" class="ghost" on:click={() => (formOpen = false)} disabled={saving}>Cancel</button>
    </div>
  </form>
{/if}

<h2 class="section-title">Team <span>{activeCount} active</span></h2>
{#if $accessStore?.kind === "owner"}
  <p class="owner">
    <i class="fa fa-star" aria-hidden="true"></i>
    You are signed in as the <strong>owner</strong> ({$userStore?.email}): full access, always. The owner can't be switched off here.
  </p>
{/if}

{#if loading}
  <p>Loading…</p>
{:else if staff.length === 0}
  <p class="empty">No users yet. Click <strong>Add user</strong> to give someone access.</p>
{:else}
  <div class="table-wrap">
    <table class="team">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Can do</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each staff as s (s.uid)}
          <tr class:off={!s.active}>
            <td>
              <div class="who">
                <div class="avatar">{(s.name || s.email).charAt(0).toUpperCase()}</div>
                <div>
                  <strong>{s.name || "—"}{#if s.uid === me} <span class="you">you</span>{/if}</strong>
                  <small>{s.email}{s.phone ? ` · ${s.phone}` : ""}</small>
                </div>
              </div>
            </td>
            <td>
              <span class="pill r-{s.role}">{roleLabel(s.role)}</span>
              {#if s.role !== "admin" && isCustomised(s.role, s.perms)}<span class="tag">customised</span>{/if}
            </td>
            <td class="sum">{permsSummary(s)}</td>
            <td>{#if s.active}<span class="st on">Active</span>{:else}<span class="st">Switched off</span>{/if}</td>
            <td class="acts">
              <button type="button" class="mini" on:click={() => openEdit(s)} disabled={busyUid === s.uid}>Edit</button>
              <button type="button" class="mini" on:click={() => resetPassword(s)} disabled={busyUid === s.uid}>Reset password</button>
              {#if s.uid !== me}
                <button type="button" class="mini" on:click={() => toggleActive(s)} disabled={busyUid === s.uid}>
                  {s.active ? "Switch off" : "Switch on"}
                </button>
                <button type="button" class="mini danger" on:click={() => remove(s)} disabled={busyUid === s.uid}>Remove</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<h2 class="section-title">What each role can do</h2>
<div class="role-cards">
  {#each ROLES as r}
    <div class="role-card">
      <strong>{r.label}</strong>
      <p>{r.description}</p>
      <small>{permsSummary({ role: r.id, perms: r.perms })}</small>
    </div>
  {/each}
</div>

<h2 class="section-title">
  Customer wallets
  <button type="button" class="link" on:click={loadCustomers}>{customersOpen ? "Hide" : "Show"}</button>
</h2>
{#if customersOpen}
  {#if !customersLoaded}
    <p>Loading…</p>
  {:else}
    <input class="search" type="search" placeholder="Search customers by name or email…" bind:value={customerQuery} />
    <div class="table-wrap">
      <table class="team">
        <thead><tr><th>Name</th><th>Email</th><th>Wallet (UGX)</th></tr></thead>
        <tbody>
          {#each filteredCustomers as u (u.id)}
            <tr>
              <td>{u.firstName} {u.lastName}</td>
              <td>{u.email}</td>
              <td class="wallet">
                <input type="number" min="0" bind:value={u.walletBalance} aria-label="Wallet for {u.email}" />
                <button type="button" class="mini" disabled={busyUid === u.id} on:click={() => saveWallet(u)}>Save</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

<style>
  .hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    background: linear-gradient(135deg, #13344f 0%, #135fa3 55%, #1673c4 100%);
    color: #fff;
    padding: 22px 24px;
    border-radius: 14px;
    margin-bottom: 20px;
  }
  .hero h1 {
    margin: 0 0 6px;
    font-size: 26px;
  }
  .hero p {
    margin: 0;
    opacity: 0.95;
    font-size: 14px;
    max-width: 640px;
  }
  .btn-add {
    border: none;
    background: #fff;
    color: #13344f;
    font-weight: 700;
    padding: 11px 18px;
    border-radius: 10px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }
  .msg {
    padding: 10px 14px;
    border-radius: 10px;
    margin: 0 0 14px;
    font-size: 14px;
  }
  .msg.error {
    background: #fdecec;
    color: #9b1c1c;
    border: 1px solid #f5c2c2;
  }
  .msg.info {
    background: #e8f4fc;
    color: #13344f;
    border: 1px solid #b9dcf3;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .x {
    border: none;
    background: none;
    font-size: 18px;
    cursor: pointer;
    color: inherit;
  }
  .panel {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 24px;
    scroll-margin-top: 80px;
  }
  .panel h2 {
    margin: 0 0 14px;
    font-size: 20px;
    color: #13344f;
  }
  .panel h3 {
    margin: 20px 0 10px;
    font-size: 15px;
    color: #13344f;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
    font-size: 13px;
    color: #374151;
  }
  .opt {
    font-weight: 400;
    color: #6b7280;
  }
  input:not([type="radio"]) {
    padding: 9px 11px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font: inherit;
    font-weight: 400;
    min-width: 0;
  }
  input[readonly] {
    background: #f3f4f6;
    color: #6b7280;
  }
  .pw {
    display: flex;
    gap: 6px;
  }
  .pw input {
    flex: 1;
    min-width: 0;
  }
  .roles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }
  .role {
    text-align: left;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    padding: 12px;
    cursor: pointer;
    font: inherit;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #13344f;
  }
  .role span {
    font-size: 12.5px;
    color: #4b5563;
  }
  .role.sel {
    border-color: #1673c4;
    background: #eef6fd;
    box-shadow: inset 0 0 0 1px #1673c4;
  }
  .table-wrap {
    overflow-x: auto;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #f0f1f3;
    text-align: left;
    vertical-align: middle;
  }
  th {
    background: #f8fafc;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #4b5563;
  }
  .perm td small {
    display: block;
    color: #6b7280;
    font-size: 12px;
    font-weight: 400;
  }
  .c {
    text-align: center;
  }
  .perm input[type="radio"] {
    width: 18px;
    height: 18px;
    accent-color: #1673c4;
  }
  .note {
    font-size: 13px;
    color: #4b5563;
    margin: 8px 0 0;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 18px;
  }
  .btn-primary {
    background: #1673c4;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-primary:disabled {
    opacity: 0.6;
  }
  .ghost,
  .mini {
    border: 1px solid #d1d5db;
    background: #fff;
    border-radius: 8px;
    padding: 8px 12px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    color: #13344f;
    white-space: nowrap;
  }
  .mini {
    padding: 5px 9px;
    font-size: 12.5px;
  }
  .mini.danger {
    color: #b91c1c;
    border-color: #f1b5b5;
  }
  .link {
    border: none;
    background: none;
    color: #1673c4;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-transform: none;
    letter-spacing: 0;
  }
  .tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    background: #fff4d6;
    color: #8a5a00;
    border-radius: 999px;
    padding: 2px 8px;
    margin-left: 4px;
  }
  .section-title {
    font-size: 18px;
    color: #13344f;
    margin: 26px 0 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-title span {
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
  }
  .owner {
    background: #f0f7fd;
    border: 1px solid #cfe5f6;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: #13344f;
  }
  .owner .fa {
    color: #e0a100;
  }
  .empty {
    color: #4b5563;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .who small {
    display: block;
    color: #6b7280;
    font-size: 12.5px;
  }
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #13344f;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex: none;
  }
  .you {
    font-size: 11px;
    background: #e0f1fa;
    color: #135fa3;
    border-radius: 999px;
    padding: 1px 7px;
    font-weight: 600;
  }
  .pill {
    display: inline-block;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 700;
    background: #eef2f7;
    color: #13344f;
  }
  .r-admin {
    background: #13344f;
    color: #fff;
  }
  .r-manager {
    background: #dbeafe;
    color: #1e40af;
  }
  .r-finance {
    background: #dcfce7;
    color: #166534;
  }
  .r-sales {
    background: #fef3c7;
    color: #92400e;
  }
  .sum {
    font-size: 12.5px;
    color: #4b5563;
    max-width: 320px;
  }
  .st {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }
  .st.on {
    color: #15803d;
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  tr.off td {
    opacity: 0.6;
  }
  tr.off td.acts {
    opacity: 1;
  }
  .role-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .role-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px;
    color: #13344f;
  }
  .role-card p {
    margin: 6px 0;
    font-size: 13px;
    color: #374151;
  }
  .role-card small {
    color: #6b7280;
    font-size: 12px;
  }
  .search {
    width: 100%;
    max-width: 420px;
    margin-bottom: 10px;
  }
  .wallet {
    display: flex;
    gap: 6px;
  }
  .wallet input {
    width: 130px;
  }
</style>
