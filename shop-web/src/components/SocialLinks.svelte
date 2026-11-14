<script>
  /** Social profiles as real brand logos in round, brand-coloured badges. */
  import { SOCIAL_ICON_PATHS } from "../lib/socialIcons.js";

  /** @type {{ key: string, name?: string, label: string, url: string }[]} */
  export let links = [];
  /** Badge size in px. */
  export let size = 34;
  /** Show the platform name next to the logo. */
  export let showLabels = false;

  const BG = {
    instagram: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
    facebook: "#1877f2",
    x: "#000",
    tiktok: "#000",
    whatsapp: "#25d366",
    snapchat: "#fffc00",
    youtube: "#ff0000",
    telegram: "#26a5e4",
    linkedin: "#0a66c2"
  };
  const FG = { snapchat: "#000" };

  $: shown = links.filter((l) => l && l.url);
</script>

{#if shown.length}
  <span class="social" style="--s:{size}px">
    {#each shown as s (s.url)}
      <a
        class="badge"
        class:labelled={showLabels}
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Bagz on ${s.name || s.label}`}
        aria-label={`Bagz on ${s.name || s.label}`}
      >
        <span class="logo" class:outlined={s.key === "x" || s.key === "tiktok"} style="background:{BG[s.key] || '#1673c4'};color:{FG[s.key] || '#fff'}">
          {#if SOCIAL_ICON_PATHS[s.key]}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={SOCIAL_ICON_PATHS[s.key]} /></svg>
          {:else}
            <i class="fa fa-link" aria-hidden="true"></i>
          {/if}
        </span>
        {#if showLabels}<span class="name">{s.name || s.label}</span>{/if}
      </a>
    {/each}
  </span>
{/if}

<style>
  .social {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    text-decoration: none;
    color: inherit;
    transition: transform 0.15s ease;
  }
  .badge.labelled {
    margin-right: 8px;
  }
  .badge:hover {
    transform: translateY(-2px);
  }
  .badge:focus-visible {
    outline: 2px solid #2ba8e0;
    outline-offset: 3px;
    border-radius: 999px;
  }
  .logo {
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  /* Black logos need a ring to stand out on the dark bars. */
  .logo.outlined {
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  .logo svg {
    width: 55%;
    height: 55%;
    display: block;
  }
  .name {
    font-weight: 600;
    font-size: 13px;
  }
</style>
