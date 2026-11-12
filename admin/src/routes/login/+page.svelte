<script lang="ts">
  import { signInWithEmailAndPassword, signOut } from "firebase/auth";
  import { auth } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import { deriveAdminFlag } from "$lib/stores/auth";

  let email = "";
  let password = "";
  let errorMsg = "";
  let loading = false;
  let showPassword = false;

  async function handleLogin() {
    errorMsg = "";
    loading = true;
    try {
      if (!auth) {
        throw new Error("Firebase Auth is not available. Check admin/.env and restart the dev server.");
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdTokenResult(true);
      const signedInEmail = userCredential.user.email ?? email;
      const isAdmin = deriveAdminFlag(token.claims, signedInEmail);

      if (!isAdmin) {
        await signOut(auth);
        errorMsg = "This account is not an admin. Ask an existing admin to grant you access.";
      } else {
        goto("/");
      }
    } catch (e: any) {
      errorMsg = friendlyAuthError(e);
    } finally {
      loading = false;
    }
  }

  function friendlyAuthError(e: any): string {
    const code = String(e?.code || "");
    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/invalid-email"
    ) {
      return "Wrong email or password. Please try again.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Please wait a moment and try again.";
    }
    if (code === "auth/network-request-failed") {
      return "Network problem. Check your internet connection and try again.";
    }
    if (e?.message?.includes("Firebase Auth is not available")) {
      return e.message;
    }
    return "Could not sign in. Please try again.";
  }
</script>

<svelte:head>
  <title>Sign in — Bagz Admin</title>
</svelte:head>

<div class="page">
  <div class="stage">
    <aside class="hero">
      <div class="hero-copy">
        <div class="brand-row">
          <img
            class="brand-logo"
            src="/brand/bagz-logo-white.png"
            alt="Bagz Apple Services"
            width="220"
            height="52"
          />
          <p class="brand-tagline">Authentic Genuine Gadget Store</p>
        </div>

        <h1>Bagz <em>Admin</em></h1>
        <p class="lead">
          Manage iPhones, Pixel, Samsung, Mac and accessories — stock, orders,
          swaps and customers for Kampala's trusted Apple &amp; tech hub.
        </p>

        <ul>
          <li>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 016 0v3z"/></svg>
            Secure access
          </li>
          <li>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 7h11v7h2.5L20 11h3v7h-2a2 2 0 11-4 0H9a2 2 0 11-4 0H3V7zm2 11a1 1 0 100-2 1 1 0 000 2zm12 0a1 1 0 100-2 1 1 0 000 2z"/></svg>
            Same-day delivery
          </li>
          <li>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a7 7 0 00-7 7v2H4v6h4v-6H7v-2a5 5 0 0110 0v2h-1v6h4v-6h-1v-2a7 7 0 00-7-7z"/></svg>
            Swap &amp; top-up
          </li>
        </ul>

        <p class="script">Authentic.<br />Genuine.</p>
      </div>

      <svg class="wave" viewBox="0 0 800 320" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stop-color="#0c2236" />
            <stop offset="35%" stop-color="#135fa3" />
            <stop offset="100%" stop-color="#9fd6f0" />
          </linearGradient>
        </defs>
        <path d="M0 188C120 48 230 250 410 150C560 70 690 40 800 92V320H0Z" fill="url(#waveGrad)" />
      </svg>
    </aside>

    <section class="form-wrap">
      <div class="card">
        <p class="eyebrow">Secure access</p>
        <h2>Sign in to continue</h2>
        {#if errorMsg}
          <div class="error">{errorMsg}</div>
        {/if}
        <form on:submit|preventDefault={handleLogin}>
          <label>
            Email
            <span class="field">
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zm8 7l8-5H4l8 5z"/></svg>
              <input type="email" bind:value={email} required autocomplete="username" />
            </span>
          </label>
          <label>
            Password
            <span class="field">
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm3 8H9V7a3 3 0 016 0v3z"/></svg>
              {#if showPassword}
                <input type="text" bind:value={password} required autocomplete="current-password" />
              {:else}
                <input type="password" bind:value={password} required autocomplete="current-password" />
              {/if}
              <button type="button" class="toggle" on:click={() => (showPassword = !showPassword)} aria-label="Toggle password">
                {#if showPassword}
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 6c5 0 9 4.5 10 6-1 1.5-5 6-10 6S3 13.5 2 12c1-1.5 5-6 10-6zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
                {:else}
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4l17 17-1.4 1.4L14.6 18C13.8 18.3 12.9 18.5 12 18.5 7 18.5 3 14 2 12c.4-.6 1.4-1.9 2.8-3.2L1.6 5.4 3 4zm6.1 6.1A4 4 0 0116 13.9l-2.1-2.1a1.5 1.5 0 00-1.7-1.7L9.1 10.1zM12 7.5c5 0 9 4.5 10 6-.3.5-1 1.4-1.9 2.4l-1.5-1.5c.9-.8 1.6-1.6 1.9-2C19.4 11 16 9 12 9c-.6 0-1.2.1-1.8.2L8.7 7.7C9.7 7.6 10.8 7.5 12 7.5z"/></svg>
                {/if}
              </button>
            </span>
          </label>
          <button class="submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Log in →"}
          </button>
        </form>
      </div>
    </section>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 28px 16px;
    background: #eef3f8;
  }
  .stage {
    width: min(1100px, 100%);
    min-height: 640px;
    display: grid;
    grid-template-columns: 1.12fr 0.88fr;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 28px 70px rgba(15, 39, 68, 0.18);
    background: #fff;
  }
  .hero {
    position: relative;
    color: #fff;
    padding: 38px 34px 48px;
    overflow: hidden;
    background: linear-gradient(165deg, #061224 0%, #0b2748 58%, #123056 100%);
  }
  .wave {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 42%;
    z-index: 0;
    pointer-events: none;
  }
  .hero-copy {
    position: relative;
    z-index: 2;
    max-width: 370px;
  }
  .brand-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 34px;
  }
  .brand-logo {
    width: min(100%, 220px);
    height: auto;
    max-height: 56px;
    object-fit: contain;
    object-position: left center;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.28));
  }
  .brand-tagline {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #9fd6f0;
  }
  h1 {
    margin: 0 0 14px;
    font-size: 46px;
    line-height: 1;
    letter-spacing: -0.03em;
  }
  h1 em {
    font-style: normal;
    color: #2ba8e0;
  }
  .lead {
    margin: 0;
    color: #dbe7f5;
    line-height: 1.55;
    font-size: 15px;
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0;
    margin: 22px 0 28px;
    list-style: none;
    max-width: 340px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(8, 20, 40, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 6px 12px 6px 6px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  li svg {
    width: 14px;
    height: 14px;
    color: #fff;
    background: #135fa3;
    border-radius: 50%;
    padding: 5px;
    box-sizing: content-box;
  }
  .script {
    margin: 0;
    font-family: "Great Vibes", Georgia, cursive;
    font-size: 36px;
    line-height: 1.05;
    color: #7cc8ec;
    text-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
  }
  .form-wrap {
    display: grid;
    place-items: center;
    padding: 36px 28px;
    background: linear-gradient(180deg, #f6f9fc, #eef3f8);
  }
  .card {
    width: min(390px, 100%);
    background: #fff;
    border-radius: 18px;
    padding: 32px 28px 28px;
    box-shadow: 0 18px 44px rgba(15, 39, 68, 0.1);
  }
  .eyebrow {
    margin: 0;
    color: #1673c4;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h2 {
    margin: 8px 0 20px;
    font-size: 26px;
    color: #0f2744;
  }
  .error {
    background: #fef2f2;
    color: #b91c1c;
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 12px;
    font-size: 14px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: transparent;
    border: 0;
    padding: 0;
    box-shadow: none;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
    border: 1px solid #e8eef5;
    background: #f8fafc;
    border-radius: 12px;
    padding: 0 12px;
  }
  .field svg {
    width: 18px;
    height: 18px;
    color: #94a3b8;
    flex: none;
  }
  .field input {
    border: 0;
    background: transparent;
    margin: 0;
    padding: 12px 0;
  }
  .toggle {
    border: 0;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 4px;
  }
  .toggle svg {
    width: 18px;
    height: 18px;
  }
  .submit {
    margin-top: 6px;
    border: 0;
    border-radius: 12px;
    padding: 13px;
    font-weight: 800;
    color: #fff;
    cursor: pointer;
    background: linear-gradient(90deg, #2ba8e0, #135fa3);
    box-shadow: 0 10px 18px rgba(19, 95, 163, 0.28);
  }
  .submit:disabled {
    opacity: 0.65;
  }
  @media (max-width: 860px) {
    .stage {
      grid-template-columns: 1fr;
    }
    .form-wrap {
      order: -1;
    }
    .hero {
      min-height: 280px;
    }
  }
</style>
