<script>
  import { resolveMenuGroups, thumbForSub, featuredSubImage, iconForMenuGroup } from "../lib/categoryMenu.js";
  import TemuIcon from "./TemuIcon.svelte";
  import { coverUrl, stockPhotoForCategory } from "../lib/catalog.js";

  export let categories = [];
  export let products = [];
  export let browseGroups = null;
  export let categoryImages = {};
  export let onPick = () => {};
  /** "mega" = desktop dropdown; "page" = full mobile categories tab */
  export let variant = "mega";

  let activeGroupId = "featured";

  $: groups = resolveMenuGroups(categories, browseGroups);
  $: activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];
  $: if (groups.length && !groups.some((g) => g.id === activeGroupId)) {
    activeGroupId = groups[0].id;
  }

  function selectGroup(id) {
    activeGroupId = id;
  }

  function pickSub(sub) {
    onPick(sub);
  }

  function thumbSrc(sub) {
    const url = thumbForSub(sub, products, categoryImages);
    if (url) return url;
    return featuredSubImage(sub?.label, products) || stockPhotoForCategory("Accessories", 200);
  }

  /** Broken admin image: try a product photo from that category, then a stock photo. */
  function onImgError(e, sub) {
    const img = e.currentTarget;
    const tried = (img.dataset.tried || "").split("|");
    const cat = sub?.filterCategory;
    const product = cat ? products.find((p) => p.category === cat && coverUrl(p)) : null;
    const candidates = [
      product ? coverUrl(product) : "",
      stockPhotoForCategory(cat || "Accessories", 200)
    ].filter(Boolean);
    const next = candidates.find((url) => !tried.includes(url) && url !== img.src);
    if (!next) return;
    img.dataset.tried = [...tried, next].join("|");
    img.src = next;
  }
</script>

<div class="panel variant-{variant}" role="dialog" aria-label="Browse categories">
  <aside class="sidebar">
    {#each groups as group (group.id)}
      <button
        type="button"
        class="side-item"
        class:active={group.id === activeGroupId}
        on:mouseenter={() => variant === "mega" && selectGroup(group.id)}
        on:focus={() => selectGroup(group.id)}
        on:click={() => selectGroup(group.id)}
      >
        <span class="side-icon" aria-hidden="true">
          <TemuIcon name={iconForMenuGroup(group)} size={18} color="currentColor" strokeWidth={1.85} />
        </span>
        <span class="side-label">{group.label}</span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
    {/each}
  </aside>

  <div class="content">
    <p class="content-title">{activeGroup?.label}</p>
    <div class="sub-grid">
      {#each activeGroup?.subs || [] as sub (sub.label)}
        <button type="button" class="sub" on:click={() => pickSub(sub)}>
          <span class="thumb-wrap">
            <img src={thumbSrc(sub)} alt="" loading="eager" decoding="async" on:error={(e) => onImgError(e, sub)} />
            {#if sub.hot}
              <span class="hot">HOT</span>
            {/if}
          </span>
          <span class="sub-label">{sub.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .panel {
    display: flex;
    background: #fff;
    color: #1b1512;
    text-align: left;
    min-height: 0;
  }
  .panel.variant-mega {
    width: min(920px, calc(100vw - 24px));
    max-height: min(70vh, 520px);
    border-radius: 0 0 8px 8px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
    overflow: hidden;
  }
  .panel.variant-page {
    flex: 1;
    min-height: calc(100vh - var(--mobile-header-offset) - 56px);
    border-radius: 8px;
    border: 1px solid #eee;
    overflow: hidden;
  }
  .sidebar {
    width: 200px;
    flex-shrink: 0;
    background: #f7f7f7;
    border-right: 1px solid #eee;
    overflow-y: auto;
    padding: 6px 0;
  }
  .panel.variant-page .sidebar {
    width: 132px;
    padding-left: 4px;
  }
  .side-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    border: none;
    background: transparent;
    padding: 11px 14px;
    font-size: 13px;
    font-weight: 500;
    color: #333;
    cursor: pointer;
    text-align: left;
  }
  .side-item:hover,
  .side-item.active {
    background: #fff;
    font-weight: 600;
    color: #1b1512;
  }
  .side-item.active .chev {
    opacity: 1;
  }
  .side-icon {
    flex-shrink: 0;
    width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ea580c;
  }
  .side-label {
    flex: 1;
    min-width: 0;
    white-space: normal;
    overflow: visible;
    line-height: 1.25;
  }
  .chev {
    opacity: 0.35;
    font-size: 16px;
    line-height: 1;
    margin-left: auto;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px 18px;
    min-width: 0;
  }
  .content-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 700;
    color: #1b1512;
  }
  .sub-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px 10px;
  }
  .panel.variant-page .sub-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 10px;
  }
  .sub {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }
  .thumb-wrap {
    position: relative;
    display: block;
    width: 72px;
    height: 72px;
    margin: 0 auto;
    border-radius: 50%;
    overflow: hidden;
    background: #f3f4f6;
    border: 1px solid #e8e8e8;
  }
  .panel.variant-page .thumb-wrap {
    width: 64px;
    height: 64px;
  }
  .thumb-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hot {
    position: absolute;
    top: 2px;
    right: 2px;
    background: linear-gradient(135deg, #fb923c, #ea580c);
    color: #fff;
    font-size: 8px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 3px;
    letter-spacing: 0.02em;
  }
  .sub-label {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.3;
    color: #333;
    text-align: center;
    white-space: normal;
    overflow: visible;
  }
  @media (max-width: 720px) {
    .panel.variant-mega .sub-grid {
      grid-template-columns: repeat(4, 1fr);
    }
    .panel.variant-page .sidebar {
      width: 132px;
    }
    .side-item {
      padding: 10px 8px 10px 10px;
      font-size: 12px;
      gap: 6px;
    }
    .side-icon {
      width: 20px;
    }
    .chev {
      display: none;
    }
  }
</style>
