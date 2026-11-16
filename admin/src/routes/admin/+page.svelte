<script lang="ts">
  import { onMount } from "svelte";
  import { httpsCallable } from "firebase/functions";
  import { PUBLIC_ADMIN_APP_URL } from "$env/static/public";
  import { base } from "$app/paths";
  import { getAdminFunctions, formatCallableError } from "$lib/functionsClient";
  import { doc, updateDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { fetchAllUsersAndAdmins, type AppUser } from "$lib/data/users";
  import {
    ADMIN_MODULES,
    ADMIN_ROLES,
    modulesForRole,
    formatModulesSummary
  } from "$lib/auth/adminModules";

  type StaffInvite = {
    id: string;
    email: string;
    role: string;
    modules?: string[];
    status: string;
    createdAt: number;
  };

  let users: AppUser[] = [];
  let filteredUsers: AppUser[] = [];
  let invites: StaffInvite[] = [];
  let searchQuery = "";
  let loading = true;
  let errorMsg = "";
  let infoMsg = "";
  let processingUid = "";
  let inviteOpen = false;
  let inviteEmail = "";
  let inviteName = "";
  let inviteRole = "catalog_manager";
  let inviteModules: string[] = modulesForRole("catalog_manager");
  let inviting = false;
  let lastInviteLink = "";
  let lastRolePicked = inviteRole;

  const adminRoot = (PUBLIC_ADMIN_APP_URL || "http://localhost:5174").replace(/\/$/, "");
  const adminAppUrl = base && !adminRoot.endsWith(base) ? `${adminRoot}${base}` : adminRoot;

  $: pendingInvites = invites.filter((i) => i.status === "pending");
  $: if (inviteRole !== lastRolePicked) {
    lastRolePicked = inviteRole;
    inviteModules = modulesForRole(inviteRole);
  }

  function roleLabel(id: string) {
    return ADMIN_ROLES.find((r) => r.id === id)?.label || id;
  }

  onMount(async () => {
    await refresh();
  });

  async function refresh() {
    loading = true;
    errorMsg = "";
    try {
      users = await fetchAllUsersAndAdmins();
      filteredUsers = users;
    } catch (e: unknown) {
      errorMsg = "Failed to load users: " + formatCallableError(e);
    }
    try {
      const functions = getAdminFunctions();
      const list = httpsCallable(functions, "adminListStaffInvites");
      const res: any = await list({});
      invites = res.data?.invites || [];
    } catch {
      infoMsg = "Staff invites stay off until Cloud Functions are deployed. The user list still works.";
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    const q = searchQuery.toLowerCase();
    filteredUsers = users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }

  function toggleModule(id: string) {
    if (inviteRole === "super_admin") return;
    if (inviteModules.includes(id)) {
      inviteModules = inviteModules.filter((m) => m !== id);
    } else {
      inviteModules = [...inviteModules, id];
    }
  }

  async function sendInvite() {
    errorMsg = "";
    infoMsg = "";
    lastInviteLink = "";
    const email = inviteEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      errorMsg = "Enter a valid email address.";
      return;
    }
    inviting = true;
    try {
      const functions = getAdminFunctions();
      const fn = httpsCallable(functions, "adminInviteStaff");
      const res: any = await fn({
        email,
        displayName: inviteName.trim(),
        role: inviteRole,
        modules: inviteModules
      });
      lastInviteLink = res.data?.inviteLink || "";
      if (res.data?.emailSent) {
        infoMsg = `Invitation email sent to ${email}.`;
        inviteOpen = false;
        inviteEmail = "";
        inviteName = "";
      } else {
        infoMsg = res.data?.message || "Copy the invite link below.";
      }
      await refresh();
    } catch (e: unknown) {
      errorMsg = formatCallableError(e);
    } finally {
      inviting = false;
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      infoMsg = "Invite link copied.";
    } catch {
      errorMsg = "Could not copy — select the link manually.";
    }
  }

  async function resendInvite(inv: StaffInvite) {
    try {
      const functions = getAdminFunctions();
      const fn = httpsCallable(functions, "adminResendStaffInvite");
      const res: any = await fn({ inviteId: inv.id });
      if (res.data?.emailSent) {
        infoMsg = `Email resent to ${inv.email}.`;
      } else if (res.data?.inviteLink) {
        lastInviteLink = res.data.inviteLink;
        infoMsg = "Email could not be sent (check SMTP). Copy the invite link below.";
      }
    } catch (e: unknown) {
      errorMsg = formatCallableError(e);
    }
  }

  async function revokeInvite(inv: StaffInvite) {
    if (!confirm(`Revoke invitation for ${inv.email}?`)) return;
    try {
      const functions = getAdminFunctions();
      await httpsCallable(functions, "adminRevokeStaffInvite")({ inviteId: inv.id });
      await refresh();
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  async function saveWallet(user: AppUser) {
    processingUid = user.id;
    try {
      const amount = Number(user.walletBalance) || 0;
      await updateDoc(doc(db, "user", user.id), { walletBalance: amount });
      infoMsg = `Wallet updated for ${user.email}.`;
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      processingUid = "";
    }
  }

  async function toggleAdmin(user: AppUser, grantAdmin: boolean) {
    if (!confirm(`${grantAdmin ? "Grant" : "Revoke"} admin access for ${user.email}?`)) return;
    processingUid = user.id;
    try {
      const functions = getAdminFunctions();
      await httpsCallable(functions, "adminSetClaim")({ uid: user.id, admin: grantAdmin });
      user.isAdmin = grantAdmin;
      users = [...users];
      handleSearch();
      infoMsg = `Updated ${user.email}.`;
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      processingUid = "";
    }
  }
</script>

<section class="hero">
  <div>
    <h1>User Management</h1>
    <p>Invite staff, assign modules per person, and manage roles.</p>
  </div>
  <button type="button" class="btn-invite" on:click={() => (inviteOpen = true)}><i class="fa fa-envelope-o" aria-hidden="true"></i> Invite User</button>
</section>

{#if errorMsg}
  <div class="alert err">{errorMsg}</div>
{/if}
{#if infoMsg}
  <div class="alert ok">{infoMsg}</div>
{/if}
{#if lastInviteLink}
  <div class="link-box">
    <p><strong>Invite link</strong> (share if email did not arrive):</p>
    <code>{lastInviteLink}</code>
    <button type="button" class="btn-copy" on:click={() => copyLink(lastInviteLink)}>Copy link</button>
  </div>
{/if}

{#if inviteOpen}
  <div class="modal-backdrop" role="presentation" on:click={() => (inviteOpen = false)} />
  <div class="modal" role="dialog" aria-labelledby="invite-title">
    <h2 id="invite-title">Invite team member</h2>
    <p class="modal-sub">
      They will receive an email with a link to set their password. Invite links use
      <strong>{adminAppUrl}/invite/…</strong>
    </p>
    <label>
      Email
      <input type="email" bind:value={inviteEmail} placeholder="colleague@example.com" />
    </label>
    <label>
      Display name (optional)
      <input type="text" bind:value={inviteName} placeholder="Jane Doe" />
    </label>
    <label>
      Role
      <select bind:value={inviteRole}>
        {#each ADMIN_ROLES as r}
          <option value={r.id}>{r.label}</option>
        {/each}
      </select>
    </label>
    <fieldset class="modules">
      <legend>Module access</legend>
      {#if inviteRole === "super_admin"}
        <p class="hint">Super Admin has access to all modules.</p>
      {:else}
        <p class="hint">
          {formatModulesSummary(inviteModules)} — change role for presets, or check/uncheck below.
        </p>
        <div class="module-grid">
          {#each ADMIN_MODULES as mod}
            <label class="mod-chip">
              <input
                type="checkbox"
                checked={inviteModules.includes(mod.id)}
                on:change={() => toggleModule(mod.id)}
              />
              {mod.label}
            </label>
          {/each}
        </div>
      {/if}
    </fieldset>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" on:click={() => (inviteOpen = false)}>Cancel</button>
      <button type="button" class="btn-primary" disabled={inviting} on:click={sendInvite}>
        {inviting ? "Sending…" : "Send invitation"}
      </button>
    </div>
  </div>
{/if}

<h2 class="section-title">Pending invitations</h2>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Email</th>
        <th>Role</th>
        <th>Modules</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#if pendingInvites.length === 0}
        <tr><td colspan="5" class="empty">No pending invitations.</td></tr>
      {:else}
        {#each pendingInvites as inv}
          <tr>
            <td>{inv.email}</td>
            <td><span class="pill role">{roleLabel(inv.role)}</span></td>
            <td>{formatModulesSummary(inv.modules || [])}</td>
            <td><span class="pill pending">Pending</span></td>
            <td class="actions">
              <button type="button" class="icon-btn" title="Resend email" on:click={() => resendInvite(inv)}><i class="fa fa-envelope-o" aria-hidden="true"></i></button>
              <button type="button" class="icon-btn danger" title="Revoke" on:click={() => revokeInvite(inv)}><i class="fa fa-times" aria-hidden="true"></i></button>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<h2 class="section-title">All users</h2>
<div class="search-bar">
  <input
    type="search"
    placeholder="Search by name or email…"
    bind:value={searchQuery}
    on:input={handleSearch}
  />
</div>

{#if loading}
  <p>Loading…</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Modules</th>
          <th>Wallet (UGX)</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredUsers as user}
          <tr class:is-admin={user.isAdmin}>
            <td>
              <div class="user-info">
                <div class="avatar">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</div>
                <span>{user.firstName} {user.lastName}</span>
              </div>
            </td>
            <td>{user.email}</td>
            <td>
              {#if user.isAdmin}
                <span class="pill role">{roleLabel(user.adminRole || "super_admin")}</span>
              {:else}
                <span class="pill user">User</span>
              {/if}
            </td>
            <td>{user.isAdmin ? formatModulesSummary(user.adminModules || []) : "—"}</td>
            <td>
              <input type="number" min="0" class="wallet" bind:value={user.walletBalance} />
              <button class="btn-mini" disabled={processingUid === user.id} on:click={() => saveWallet(user)}>Save</button>
            </td>
            <td>
              <button
                class="btn-mini {user.isAdmin ? 'danger' : 'primary'}"
                disabled={processingUid === user.id}
                on:click={() => toggleAdmin(user, !user.isAdmin)}
              >
                {user.isAdmin ? "Revoke admin" : "Make admin"}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
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
    box-shadow: 0 10px 28px rgba(19, 95, 163, 0.25);
  }
  .hero h1 {
    margin: 0 0 6px;
    font-size: 26px;
  }
  .hero p {
    margin: 0;
    opacity: 0.95;
    font-size: 14px;
  }
  .btn-invite {
    border: none;
    background: #fff;
    color: #13344f;
    font-weight: 700;
    padding: 12px 20px;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }
  .section-title {
    font-size: 18px;
    margin: 24px 0 12px;
  }
  .alert {
    padding: 12px 14px;
    border-radius: 10px;
    margin-bottom: 12px;
    font-size: 14px;
  }
  .alert.err {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }
  .alert.ok {
    background: #eef7fc;
    color: #0c2236;
    border: 1px solid #cbe8f7;
  }
  .link-box {
    background: #eef7fc;
    border: 1px solid #9fd6f0;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .link-box code {
    display: block;
    word-break: break-all;
    margin: 8px 0;
    font-size: 12px;
  }
  .btn-copy {
    border: none;
    background: #135fa3;
    color: #fff;
    padding: 8px 14px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 100;
  }
  .modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    width: min(480px, 94vw);
    max-height: 90vh;
    overflow: auto;
    background: #fff;
    border-radius: 14px;
    padding: 22px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  }
  .modal h2 {
    margin: 0 0 4px;
    font-size: 20px;
  }
  .modal-sub {
    margin: 0 0 16px;
    color: #64748b;
    font-size: 13px;
  }
  .modal label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .modal input,
  .modal select {
    display: block;
    width: 100%;
    margin-top: 4px;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font: inherit;
  }
  .modules {
    border: 1px solid #cbe8f7;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 16px;
    background: #fffbeb;
  }
  .modules legend {
    font-weight: 700;
    font-size: 13px;
  }
  .hint {
    font-size: 13px;
    color: #78350f;
    margin: 0;
  }
  .mod-list {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 13px;
  }
  .module-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .mod-chip {
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .btn-ghost {
    border: 1px solid #e2e8f0;
    background: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
  }
  .btn-primary {
    border: none;
    background: linear-gradient(90deg, #135fa3, #1673c4);
    color: #fff;
    font-weight: 700;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
  }
  .search-bar input {
    width: 100%;
    max-width: 400px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .table-wrap {
    overflow-x: auto;
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 12px 14px;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
    vertical-align: middle;
  }
  th {
    background: #fafafa;
    font-weight: 600;
    color: #475569;
  }
  tr.is-admin {
    background: #eef7fc;
  }
  .empty {
    text-align: center;
    color: #94a3b8;
    padding: 24px !important;
  }
  .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #135fa3;
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 12px;
  }
  .pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .pill.role {
    background: #e0f1fa;
    color: #0c2236;
  }
  .pill.user {
    background: #f1f5f9;
    color: #64748b;
  }
  .pill.pending {
    background: #fef3c7;
    color: #1d4f7a;
  }
  .actions {
    white-space: nowrap;
  }
  .icon-btn {
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    margin-right: 4px;
  }
  .icon-btn.danger {
    color: #b91c1c;
    border-color: #fecaca;
  }
  .wallet {
    width: 96px;
    margin-right: 6px;
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }
  .btn-mini {
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: #fff;
    background: #135fa3;
  }
  .btn-mini.danger {
    background: #dc2626;
  }
  .btn-mini.primary {
    background: #16a34a;
  }
</style>
