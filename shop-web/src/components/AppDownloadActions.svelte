<script>
  import {
    pwaInstalling,
    quickInstallPwa,
    isPwaInstalled
  } from "../lib/pwaInstall.js";
  export let layout = "banner";
  export let compact = false;
  export let label = "Install app";

  let installError = "";
  let helpOpen = false;

  $: iphone = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  async function onQuickInstall() {
    installError = "";
    helpOpen = false;
    try {
      const ok = await quickInstallPwa();
      if (!ok) helpOpen = true;
    } catch (e) {
      installError = e.message || "Could not install.";
    }
  }
</script>

<div class="actions layout-{layout}" class:compact>
  {#if $isPwaInstalled}
    <span class="installed-pill">App installed</span>
  {:else}
    <button type="button" class="btn quick" disabled={$pwaInstalling} on:click={onQuickInstall}>
      {$pwaInstalling ? "Installing…" : label}
    </button>
  {/if}
  {#if helpOpen}
    <div class="help" role="dialog" aria-label="Install Bagz">
      <p>
        {#if iphone}
          In Safari, tap Share, then <strong>Add to Home Screen</strong>.
        {:else}
          In Chrome, open the menu and tap <strong>Install app</strong>.
        {/if}
      </p>
      <button type="button" class="btn" on:click={() => (helpOpen = false)}>Close</button>
    </div>
  {/if}
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .layout-banner {
    position: relative;
    flex-shrink: 0;
  }
  .layout-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 6px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }
  .help {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    width: 220px;
    margin: 0;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    font-size: 13px;
    line-height: 1.4;
    color: #1b1512;
    max-width: 280px;
  }
  .help p {
    margin: 0 0 8px;
  }
  .quick {
    background: linear-gradient(180deg, #5bbde9 0%, #1673c4 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(22, 115, 196, 0.35);
  }
  .quick:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .store {
    background: #1a1a1a;
    color: #fff;
  }
  .store.get-app {
    background: #1a73e8;
  }
  .installed-pill {
    font-size: 11px;
    font-weight: 700;
    color: #15803d;
    background: #dcfce7;
    padding: 6px 10px;
    border-radius: 999px;
  }
  .install-err {
    margin: 4px 0 0;
    font-size: 11px;
    color: #b91c1c;
    max-width: 280px;
    line-height: 1.3;
  }
  .layout-footer .btn {
    width: 100%;
    max-width: 240px;
    min-height: 40px;
    font-size: 13px;
  }
</style>
