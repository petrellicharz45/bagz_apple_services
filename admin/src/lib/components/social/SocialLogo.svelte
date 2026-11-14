<script lang="ts">
  /** Round badge: the platform's real logo, or the chosen Font Awesome icon for "Other" links. */
  import { SOCIAL_ICON_PATHS, SOCIAL_BRAND_BG, SOCIAL_BRAND_FG } from "../../../../../shared/socialIcons.js";

  export let platform = "other";
  export let icon = "";
  export let size = 30;

  $: path = (SOCIAL_ICON_PATHS as Record<string, string>)[platform];
  $: bg = (SOCIAL_BRAND_BG as Record<string, string>)[platform] || "#1673c4";
  $: fg = (SOCIAL_BRAND_FG as Record<string, string>)[platform] || "#fff";
  $: faName = /^[a-z0-9-]+$/.test(icon) ? icon : "link";
</script>

<span class="logo" class:ring={bg === "#000"} style="--s:{size}px;background:{bg};color:{fg}">
  {#if platform === "tiktok" && path}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#25f4ee" transform="translate(-0.7 -0.6)" d={path} />
      <path fill="#fe2c55" transform="translate(0.7 0.6)" d={path} />
      <path fill="#fff" d={path} />
    </svg>
  {:else if path}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={path} /></svg>
  {:else}
    <i class="fa fa-{faName}" aria-hidden="true"></i>
  {/if}
</span>

<style>
  .logo {
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .logo.ring {
    box-shadow: 0 0 0 1.5px #cbd5e1;
  }
  svg {
    width: 55%;
    height: 55%;
  }
  .fa {
    font-size: calc(var(--s) * 0.5);
  }
</style>
