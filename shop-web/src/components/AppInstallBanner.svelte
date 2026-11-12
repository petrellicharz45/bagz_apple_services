<script>
  import { onMount } from "svelte";
  import { dismissAppBanner, isAppBannerDismissed } from "../lib/appLinks.js";
  import AppDownloadActions from "./AppDownloadActions.svelte";
  import { pwaCanQuickInstall, isPwaInstalled } from "../lib/pwaInstall.js";
  import { displaySettings, resolvedLogoUrl } from "../lib/storeDisplay.js";

  export let variant = "mobile";

  $: bannerIconSrc = resolvedLogoUrl($displaySettings);

  let visible = true;

  onMount(() => {
    visible = !isAppBannerDismissed();
  });

  function close() {
    dismissAppBanner();
    visible = false;
  }
</script>

{#if visible}
  <div class="banner variant-{variant}" role="region" aria-label="Install Fancy Deals">
    <img class="icon" src={bannerIconSrc} alt="" width="36" height="36" />
    <div class="copy">
      <p class="title">
        <strong>Fancy Deals</strong>
        <span class="tagline">Shop like a millionaire</span>
      </p>
      <p class="sub">
        {#if $pwaCanQuickInstall && !$isPwaInstalled}
          Add to your home screen in one tap — or get the native app.
        {:else}
          Incredible deals in Uganda — app &amp; mobile shop
        {/if}
      </p>
    </div>
    <AppDownloadActions layout="banner" compact={variant === "desktop"} label="Get app" />
    <button type="button" class="close" aria-label="Dismiss app banner" on:click={close}>×</button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fff;
    border-bottom: 1px solid #e8e8e8;
    padding: 8px 10px 8px 12px;
    min-height: 52px;
    flex-wrap: wrap;
  }
  .variant-desktop {
    border-bottom: none;
    padding: 6px 12px;
    min-height: 0;
    flex: 1;
    max-width: 520px;
  }
  .variant-desktop .sub {
    display: none;
  }
  .variant-desktop .icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }
  .icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: contain;
    background: linear-gradient(180deg, var(--header-bar) 0%, var(--header-bar-deep) 100%);
    padding: 4px;
  }
  .copy {
    flex: 1;
    min-width: 120px;
  }
  .title {
    margin: 0;
    font-size: 12px;
    line-height: 1.25;
    color: #1b1512;
  }
  .title strong {
    font-weight: 800;
    margin-right: 6px;
  }
  .tagline {
    font-weight: 600;
    color: #444;
  }
  .sub {
    margin: 2px 0 0;
    font-size: 11px;
    line-height: 1.3;
    color: #666;
  }
  .close {
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: #999;
    font-size: 22px;
    line-height: 1;
    padding: 0 4px;
    cursor: pointer;
    margin-left: auto;
  }
  .variant-desktop .close {
    display: none;
  }
  @media (max-width: 400px) {
    .banner {
      padding-right: 8px;
    }
    .copy {
      min-width: 0;
      flex-basis: 40%;
    }
  }
</style>
