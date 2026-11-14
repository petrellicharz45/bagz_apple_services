<script>
  /** Social profiles as real brand logos in round, brand-coloured badges. */
  import { SOCIAL_ICON_PATHS, SOCIAL_BRAND_BG, SOCIAL_BRAND_FG } from "../../../shared/socialIcons.js";

  /** @type {{ key: string, name?: string, label: string, url: string, icon?: string }[]} */
  export let links = [];
  /** Badge size in px. */
  export let size = 34;
  /** Show the platform name next to the logo. */
  export let showLabels = false;

  const BG = SOCIAL_BRAND_BG;
  const FG = SOCIAL_BRAND_FG;

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
        <span class="logo" class:outlined={BG[s.key] === "#000"} style="background:{BG[s.key] || '#1673c4'};color:{FG[s.key] || '#fff'}">
          {#if s.key === "tiktok"}
            <!-- TikTok's own look: white note with cyan and red offset edges. -->
            <svg viewBox="0 0 24 24" aria-hidden="true" class="tiktok">
              <path fill="#25f4ee" transform="translate(-0.7 -0.6)" d={SOCIAL_ICON_PATHS.tiktok} />
              <path fill="#fe2c55" transform="translate(0.7 0.6)" d={SOCIAL_ICON_PATHS.tiktok} />
              <path fill="#fff" d={SOCIAL_ICON_PATHS.tiktok} />
            </svg>
          {:else if SOCIAL_ICON_PATHS[s.key]}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={SOCIAL_ICON_PATHS[s.key]} /></svg>
          {:else}
            <i class="fa fa-{/^[a-z0-9-]+$/.test(s.icon || '') ? s.icon : 'link'}" aria-hidden="true"></i>
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
  .logo .fa {
    font-size: calc(var(--s) * 0.5);
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
