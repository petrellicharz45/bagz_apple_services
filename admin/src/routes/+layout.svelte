<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { userStore, adminStore, loadingStore, firebaseErrorStore } from "$lib/stores/auth";
  import AdminShell from "$lib/components/AdminShell.svelte";
  import "$lib/styles/admin.css";

  $: ready = browser && !$loadingStore && !$firebaseErrorStore;
  $: needsLogin = !$userStore || !$adminStore;
  $: pathname = $page.url.pathname;
  $: onLoginPage = pathname === "/login";
  $: onInvitePage = pathname.startsWith("/invite/");

  $: if (ready) {
    if (onInvitePage) {
      /* public accept-invite flow */
    } else if (needsLogin && !onLoginPage) {
      void goto("/login");
    } else if (!needsLogin && onLoginPage) {
      void goto("/");
    }
  }
</script>

{#if $firebaseErrorStore}
  <div class="boot-error">
    <h1>Admin failed to start</h1>
    <p>{$firebaseErrorStore}</p>
  </div>
{:else if $loadingStore}
  <div class="boot-loading">Loading admin dashboard…</div>
{:else if onLoginPage || needsLogin}
  <slot />
{:else}
  <AdminShell>
    <slot />
  </AdminShell>
{/if}

<style>
  .boot-error,
  .boot-loading {
    max-width: 560px;
    margin: 80px auto;
    padding: 24px;
    font-family: Inter, system-ui, sans-serif;
  }
  .boot-error {
    border: 1px solid #fecaca;
    background: #fef2f2;
    border-radius: 12px;
  }
</style>
