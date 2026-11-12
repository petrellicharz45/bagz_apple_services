<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { httpsCallable } from "firebase/functions";
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { getAdminFunctions } from "$lib/functionsClient";
  import { app, auth } from "$lib/firebase";

  const token = $page.params.token;

  let loading = true;
  let errorMsg = "";
  let email = "";
  let displayName = "";
  let roleLabel = "";
  let password = "";
  let confirmPassword = "";
  let firstName = "";
  let lastName = "";
  let saving = false;

  onMount(async () => {
    try {
      const functions = getAdminFunctions();
      const getInvite = httpsCallable(functions, "getStaffInviteByToken");
      const res: any = await getInvite({ token });
      email = res.data.email;
      displayName = res.data.displayName || "";
      roleLabel = res.data.roleLabel;
      if (displayName) {
        const parts = displayName.split(" ");
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ");
      }
    } catch (e: any) {
      errorMsg = e.message || "Invalid invitation.";
    } finally {
      loading = false;
    }
  });

  async function accept() {
    errorMsg = "";
    if (password.length < 8) {
      errorMsg = "Password must be at least 8 characters.";
      return;
    }
    if (password !== confirmPassword) {
      errorMsg = "Passwords do not match.";
      return;
    }
    saving = true;
    try {
      const functions = getAdminFunctions();
      const accept = httpsCallable(functions, "acceptStaffInvite");
      await accept({ token, password, firstName, lastName });
      if (!auth) throw new Error("Auth not ready");
      await signInWithEmailAndPassword(auth, email, password);
      goto("/");
    } catch (e: any) {
      errorMsg = e.message || "Could not activate account.";
    } finally {
      saving = false;
    }
  }
</script>

<div class="page">
  <div class="card">
    <div class="brand">Fancy Deals Admin</div>
    {#if loading}
      <p>Loading invitation…</p>
    {:else if errorMsg && !email}
      <p class="err">{errorMsg}</p>
      <a href="/login">Sign in instead</a>
    {:else}
      <div class="avatar">{firstName?.charAt(0) || email.charAt(0).toUpperCase()}</div>
      <h1>Welcome{#if firstName}, {firstName}{/if}</h1>
      <p class="sub">Set your password to activate your account.</p>
      <span class="role">{roleLabel}</span>
      <p class="email">{email}</p>
      {#if errorMsg}
        <p class="err">{errorMsg}</p>
      {/if}
      <form on:submit|preventDefault={accept}>
        <label>
          First name
          <input bind:value={firstName} />
        </label>
        <label>
          Last name
          <input bind:value={lastName} />
        </label>
        <label>
          Password
          <input type="password" bind:value={password} placeholder="At least 8 characters" required />
        </label>
        <label>
          Confirm password
          <input type="password" bind:value={confirmPassword} required />
        </label>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save password & sign in"}</button>
      </form>
      <p class="foot"><a href="/login">Already set up? Sign in instead</a></p>
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: linear-gradient(180deg, #fff7ed, #ffedd5);
  }
  .card {
    width: min(420px, 100%);
    background: #fff;
    border-radius: 16px;
    padding: 28px 24px;
    box-shadow: 0 16px 40px rgba(15, 39, 68, 0.12);
    text-align: center;
  }
  .brand {
    font-weight: 800;
    color: #ea580c;
    margin-bottom: 16px;
  }
  .avatar {
    width: 56px;
    height: 56px;
    margin: 0 auto 12px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ea580c, #f97316);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 20px;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 22px;
  }
  .sub {
    margin: 0 0 12px;
    color: #64748b;
    font-size: 14px;
  }
  .role {
    display: inline-block;
    background: #ffedd5;
    color: #9a3412;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .email {
    font-size: 13px;
    color: #475569;
    margin: 0 0 16px;
  }
  form {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  label {
    font-size: 13px;
    font-weight: 600;
  }
  input {
    display: block;
    width: 100%;
    margin-top: 4px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font: inherit;
  }
  button[type="submit"] {
    margin-top: 8px;
    border: none;
    border-radius: 10px;
    padding: 12px;
    background: linear-gradient(90deg, #ea580c, #f97316);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.7;
  }
  .err {
    color: #b91c1c;
    font-size: 14px;
  }
  .foot {
    margin-top: 16px;
    font-size: 13px;
  }
  a {
    color: #ea580c;
  }
</style>
