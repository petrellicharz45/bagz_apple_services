<script>
  import TemuIcon from "./TemuIcon.svelte";
  import { browsePillActive } from "../lib/shopBrowse.js";

  /** @type {{ id: string, label: string, category: string, group: string | null }[]} */
  export let pills = [];
  export let activeCategory = "All";
  export let activeGroup = null;
  export let browseMode = "recommended";
  export let onPick = () => {};
  export let hideTitle = false;

  let scroller;

  function scrollBy(dx) {
    scroller?.scrollBy({ left: dx, behavior: "smooth" });
  }

  function isActive(pill) {
    return browsePillActive(pill, {
      category: activeCategory,
      group: activeGroup,
      browseMode
    });
  }
</script>

<section class="explore" aria-label="Explore your interests">
  {#if !hideTitle}
    <h2 class="explore-title">Explore your interests</h2>
  {/if}
  <div class="wrap">
    <div class="pills" bind:this={scroller} role="tablist">
      {#each pills as pill (pill.id)}
        <button
          type="button"
          role="tab"
          aria-selected={isActive(pill)}
          class:active={isActive(pill)}
          on:click={() =>
            onPick({
              category: pill.category,
              group: pill.group,
              browseMode: pill.browseMode || "recommended"
            })}
        >
          {pill.label}
        </button>
      {/each}
    </div>
    <button type="button" class="scroll-btn" aria-label="Scroll categories" on:click={() => scrollBy(220)}>
      <TemuIcon name="chevronRight" size={18} color="#121212" strokeWidth={2} />
    </button>
  </div>
</section>

<style>
  .explore {
    margin: 12px 0 8px;
    padding: 0;
  }
  .explore-title {
    font-size: 15px;
    font-weight: 800;
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1b1512;
    line-height: 1.2;
  }
  @media (max-width: 900px) {
    .explore {
      margin: 10px 0 6px;
    }
    .explore-title {
      font-size: 13px;
      margin-bottom: 10px;
    }
  }
  .wrap {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .pills {
    flex: 1;
    display: flex;
    align-items: stretch;
    gap: 10px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px 4px 4px 0;
    -webkit-overflow-scrolling: touch;
  }
  .pills::-webkit-scrollbar {
    display: none;
  }
  .pills button {
    flex-shrink: 0;
    border: 1px solid #c8c8c8;
    background: #fff;
    border-radius: 6px;
    padding: 10px 16px;
    min-height: 40px;
    font-size: 13px;
    font-weight: 400;
    cursor: pointer;
    white-space: nowrap;
    color: #1b1512;
    line-height: 1.25;
    transition:
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }
  .pills button:hover {
    border-color: #999;
  }
  .pills button.active {
    border: 2px solid #121212;
    font-weight: 700;
    padding: 9px 15px;
    box-shadow: 0 0 0 1px #121212;
  }
  .scroll-btn {
    flex-shrink: 0;
    align-self: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid #d8d8d8;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }
  .scroll-btn:hover {
    border-color: #aaa;
  }
  @media (max-width: 900px) {
    .pills {
      gap: 8px;
    }
    .pills button {
      padding: 8px 12px;
      font-size: 12px;
      min-height: 36px;
      border-radius: 5px;
    }
    .pills button.active {
      padding: 7px 11px;
    }
    .scroll-btn {
      width: 34px;
      height: 34px;
    }
  }
</style>
