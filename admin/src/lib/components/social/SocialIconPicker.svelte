<script lang="ts">
  /**
   * Searchable dropdown: pick a platform (shown with its real logo) or, for any other link,
   * any Font Awesome 4.7 icon. Binds `platform` and `icon` (icon is only used when platform is "other").
   */
  import { onMount } from "svelte";
  import { SOCIAL_PLATFORMS } from "$lib/social";
  import { FA_ICONS } from "$lib/faIcons";
  import SocialLogo from "./SocialLogo.svelte";

  export let platform = "instagram";
  export let icon = "";

  let open = false;
  let query = "";
  let root: HTMLDivElement;
  let searchInput: HTMLInputElement;

  const MAX_ICONS = 120;
  const platformKeys = Object.keys(SOCIAL_PLATFORMS).filter((k) => k !== "other");

  $: q = query.trim().toLowerCase();
  $: platformHits = platformKeys.filter(
    (k) => !q || k.includes(q) || SOCIAL_PLATFORMS[k].label.toLowerCase().includes(q)
  );
  $: iconMatches = q ? FA_ICONS.filter((n) => n.includes(q.replace(/\s+/g, "-"))) : FA_ICONS;
  $: iconHits = iconMatches.slice(0, MAX_ICONS);

  $: currentLabel =
    platform === "other" ? `Other · ${icon || "link"} icon` : SOCIAL_PLATFORMS[platform]?.label || "Choose";

  async function toggle() {
    open = !open;
    if (open) {
      query = "";
      await Promise.resolve();
      searchInput?.focus();
    }
  }

  function pickPlatform(key: string) {
    platform = key;
    icon = "";
    open = false;
  }

  function pickIcon(name: string) {
    platform = "other";
    icon = name;
    open = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") open = false;
    if (e.key === "Enter") {
      e.preventDefault();
      if (platformHits.length) pickPlatform(platformHits[0]);
      else if (iconHits.length) pickIcon(iconHits[0]);
    }
  }

  onMount(() => {
    const close = (e: MouseEvent) => {
      if (open && root && !root.contains(e.target as Node)) open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  });
</script>

<div class="picker" bind:this={root}>
  <button type="button" class="current" aria-haspopup="listbox" aria-expanded={open} on:click={toggle}>
    <SocialLogo {platform} {icon} size={28} />
    <span class="cur-label">{currentLabel}</span>
    <i class="fa fa-chevron-down caret" aria-hidden="true"></i>
  </button>

  {#if open}
    <div class="menu">
      <div class="search">
        <i class="fa fa-search" aria-hidden="true"></i>
        <input
          bind:this={searchInput}
          bind:value={query}
          on:keydown={onKey}
          type="search"
          placeholder="Search: instagram, globe, shopping, phone…"
          aria-label="Search platforms and icons"
        />
      </div>

      {#if platformHits.length}
        <p class="group">Platforms <span>real logo on the shop</span></p>
        <div class="platforms" role="listbox" aria-label="Platforms">
          {#each platformHits as key}
            <button
              type="button"
              role="option"
              aria-selected={platform === key}
              class="plat"
              class:sel={platform === key}
              on:click={() => pickPlatform(key)}
            >
              <SocialLogo platform={key} size={26} />
              {SOCIAL_PLATFORMS[key].label}
            </button>
          {/each}
        </div>
      {/if}

      <p class="group">
        Other icons <span>for any other link (website, Google Maps, WhatsApp channel…) · {iconMatches.length} found</span>
      </p>
      {#if iconHits.length}
        <div class="icons" role="listbox" aria-label="Icons">
          {#each iconHits as name (name)}
            <button
              type="button"
              role="option"
              aria-selected={platform === "other" && icon === name}
              class="ico"
              class:sel={platform === "other" && icon === name}
              title={name}
              on:click={() => pickIcon(name)}
            >
              <i class="fa fa-{name}" aria-hidden="true"></i>
              <span>{name}</span>
            </button>
          {/each}
        </div>
        {#if iconMatches.length > MAX_ICONS}
          <p class="more">Showing {MAX_ICONS} of {iconMatches.length}. Type more to narrow it down.</p>
        {/if}
      {:else}
        <p class="more">No icon matches “{query}”.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    font-weight: 400;
  }
  .current {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }
  .cur-label {
    flex: 1;
    font-weight: 600;
    color: #13344f;
  }
  .caret {
    color: #6b7280;
  }
  .menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: 420px;
    overflow: auto;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
    padding: 10px;
  }
  .search {
    position: sticky;
    top: -10px;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 8px;
    color: #6b7280;
  }
  .search input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font: inherit;
  }
  .group {
    margin: 8px 0 6px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #13344f;
  }
  .group span {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: #6b7280;
    margin-left: 4px;
  }
  .platforms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
  }
  .plat {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }
  .icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px;
  }
  .ico {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 8px 4px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font: inherit;
    color: #13344f;
  }
  .ico .fa {
    font-size: 20px;
  }
  .ico span {
    font-size: 10.5px;
    color: #6b7280;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .plat:hover,
  .ico:hover {
    border-color: #1673c4;
    background: #f0f7fd;
  }
  .sel {
    border-color: #1673c4;
    background: #e0f1fa;
    box-shadow: inset 0 0 0 1px #1673c4;
  }
  .more {
    font-size: 12px;
    color: #6b7280;
    margin: 8px 0 0;
  }
</style>
