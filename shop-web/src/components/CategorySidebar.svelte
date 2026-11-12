<script>
  import TemuIcon from "./TemuIcon.svelte";
  import { iconForMenuGroup } from "../lib/categoryMenu.js";

  /** Menu groups from categoryMenu.js ({ id, label, subs: [{ label, filterCategory, query, imageUrl }] }). */
  export let groups = [];
  export let onPick = () => {};

  let openId = null;
  let closeTimer;

  // The sidebar lists real categories; "Featured" shortcuts live in the header already.
  $: items = (groups || []).filter((g) => g && g.id !== "featured" && g.label);

  function open(id) {
    clearTimeout(closeTimer);
    openId = id;
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => (openId = null), 160);
  }
  function pickCategory(group) {
    openId = null;
    const first = group.subs?.[0];
    const filterCategory = first?.filterCategory || group.label;
    onPick({ label: `Shop ${filterCategory}`, filterCategory });
  }
  function pickSub(sub) {
    openId = null;
    onPick(sub);
  }
  function onKey(e, group) {
    if (e.key === "ArrowRight") open(group.id);
    if (e.key === "Escape") openId = null;
  }

  $: openGroup = items.find((g) => g.id === openId) || null;
</script>

{#if items.length}
  <nav class="cat-sidebar" aria-label="Shop by category" on:mouseleave={scheduleClose}>
    <ul>
      {#each items as group (group.id)}
        <li>
          <button
            type="button"
            class="cat-row"
            class:open={openId === group.id}
            aria-expanded={openId === group.id}
            aria-haspopup="true"
            on:mouseenter={() => open(group.id)}
            on:focus={() => open(group.id)}
            on:keydown={(e) => onKey(e, group)}
            on:click={() => pickCategory(group)}
          >
            <TemuIcon name={iconForMenuGroup(group)} size={16} color="currentColor" />
            <span class="label">{group.label}</span>
            <TemuIcon name="chevronRight" size={11} color="#94a3b8" />
          </button>
        </li>
      {/each}
    </ul>

    {#if openGroup}
      <div class="flyout" role="menu" on:mouseenter={() => open(openGroup.id)} on:mouseleave={scheduleClose}>
        <div class="flyout-head">
          <strong>{openGroup.label}</strong>
          <button type="button" class="see-all" on:click={() => pickCategory(openGroup)}>
            See all <TemuIcon name="chevronRight" size={11} color="currentColor" />
          </button>
        </div>
        <div class="sub-grid">
          {#each openGroup.subs || [] as sub (sub.label)}
            <button type="button" class="sub" role="menuitem" on:click={() => pickSub(sub)}>
              <span class="thumb">
                {#if sub.imageUrl}
                  <img src={sub.imageUrl} alt="" loading="lazy" />
                {:else}
                  <TemuIcon name={iconForMenuGroup(openGroup)} size={20} color="#1673c4" />
                {/if}
              </span>
              <span class="sub-label">{sub.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </nav>
{/if}

<style>
  .cat-sidebar {
    position: relative;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(19, 52, 80, 0.08);
    padding: 6px 0;
    height: 100%;
    z-index: 20;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 100%;
    overflow-y: auto;
  }
  .cat-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    border: 0;
    background: none;
    cursor: pointer;
    font-size: 13px;
    color: #13344f;
    text-align: left;
  }
  .cat-row .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cat-row:hover,
  .cat-row.open,
  .cat-row:focus-visible {
    background: #eef7fc;
    color: #1673c4;
    outline: none;
  }
  .flyout {
    position: absolute;
    top: 0;
    left: calc(100% + 6px);
    width: min(620px, 60vw);
    min-height: 100%;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(12, 34, 54, 0.22);
    padding: 16px 18px;
  }
  .flyout-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .flyout-head strong {
    font-size: 15px;
    color: #13344f;
  }
  .see-all {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    background: none;
    color: #1673c4;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .sub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px 10px;
  }
  .sub {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border: 0;
    background: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 10px;
    color: #13344f;
  }
  .sub:hover {
    background: #f3f8fc;
    color: #1673c4;
  }
  .thumb {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #eef7fc;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sub-label {
    font-size: 12px;
    text-align: center;
    line-height: 1.25;
  }
</style>
