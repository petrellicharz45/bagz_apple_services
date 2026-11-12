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

  import { onMount, tick } from "svelte";

  let scroller;
  let canLeft = false;
  let canRight = false;

  /** Show each arrow only when there is more to see in that direction. */
  function updateArrows() {
    if (!scroller) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    canLeft = scroller.scrollLeft > 4;
    canRight = scroller.scrollLeft < max - 4;
  }

  function scrollBy(dx) {
    const step = Math.max(220, Math.round((scroller?.clientWidth || 600) * 0.7));
    scroller?.scrollBy({ left: dx > 0 ? step : -step, behavior: "smooth" });
  }

  onMount(() => {
    updateArrows();
    const ro = new ResizeObserver(updateArrows);
    if (scroller) ro.observe(scroller);
    return () => ro.disconnect();
  });

  // Re-check when the pill list changes (categories load from the database).
  $: pills, tick().then(updateArrows);

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
    {#if canLeft}
      <button type="button" class="scroll-btn" aria-label="Scroll categories left" on:click={() => scrollBy(-1)}>
        <TemuIcon name="chevronLeft" size={16} color="#13344f" />
      </button>
    {/if}
    <div class="pills" bind:this={scroller} role="tablist" on:scroll={updateArrows}>
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
    {#if canRight}
      <button type="button" class="scroll-btn" aria-label="Scroll categories right" on:click={() => scrollBy(1)}>
        <TemuIcon name="chevronRight" size={16} color="#13344f" />
      </button>
    {/if}
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
    color: #13344f;
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
    color: #13344f;
    line-height: 1.25;
    transition:
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }
  .pills button:hover {
    border-color: #2ba8e0;
  }
  .pills button.active {
    border: 2px solid #13344f;
    background: #13344f;
    color: #fff;
    font-weight: 700;
    padding: 9px 15px;
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
    border-color: #2ba8e0;
    background: #eef7fc;
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
