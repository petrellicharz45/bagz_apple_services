<script>
  import TemuIcon from "./TemuIcon.svelte";
  import { popularChips, buildSuggestions, countMatchingProducts } from "../lib/search.js";

  export let query = "";
  export let products = [];
  export let open = false;
  export let onPickQuery = () => {};
  export let onPickProduct = () => {};
  export let onSearch = () => {};

  $: chips = popularChips(products);
  $: trimmed = query.trim();
  $: matchCount = countMatchingProducts(products, trimmed);
  $: suggestions = buildSuggestions(query, products);
  $: showPopular = open && !trimmed;
  $: showMatches = open && trimmed;
</script>

{#if open}
  <div class="panel" role="listbox" aria-label="Search suggestions">
    {#if showPopular}
      <p class="heading">Popular right now</p>
      <div class="chips">
        {#each chips as chip}
          <button
            type="button"
            class="chip"
            on:mousedown|preventDefault={() => onPickQuery(chip.query)}
          >
            {#if chip.thumb}
              <img src={chip.thumb} alt="" />
            {:else}
              <span class="ph" />
            {/if}
            <span class="flame">🔥</span>
            <span>{chip.query}</span>
          </button>
        {/each}
      </div>
    {:else if showMatches}
      {#if matchCount === 0}
        <p class="not-found">Sorry, item not found 😢</p>
      {:else}
        {#each suggestions as s}
          <button
            type="button"
            class="row"
            on:mousedown|preventDefault={() =>
              s.product ? onPickProduct(s.product) : onPickQuery(s.label)}
          >
            {#if s.thumb}
              <img class="row-thumb" src={s.thumb} alt="" />
            {:else}
              <TemuIcon name="search" size={16} color="#999" />
            {/if}
            <span class="text">
              {#if s.bold}
                {s.before}<strong>{s.bold}</strong>{s.after}
              {:else}
                {s.label}
              {/if}
            </span>
          </button>
        {/each}
        <button type="button" class="see-all" on:mousedown|preventDefault={onSearch}>
          See all {matchCount} result{matchCount === 1 ? "" : "s"} for “{trimmed}”
        </button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .panel {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 8px);
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.15);
    padding: 12px 12px 14px;
    z-index: 60;
    max-height: min(420px, 70vh);
    overflow: auto;
  }
  .heading {
    margin: 0 0 10px;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #e8e8e8;
    background: #fff;
    border-radius: 999px;
    padding: 4px 12px 4px 4px;
    font-size: var(--text-sm);
    cursor: pointer;
    max-width: 100%;
  }
  .chip img,
  .ph {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    background: #f0f0f0;
    flex-shrink: 0;
  }
  .flame {
    font-size: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 10px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: var(--text-base);
  }
  .row:hover {
    background: #f5f5f5;
  }
  .row-thumb {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
    background: #f0f0f0;
  }
  .text strong {
    font-weight: 700;
  }
  .see-all {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 12px 10px;
    border: none;
    border-top: 1px solid #eee;
    background: #fafafa;
    color: var(--header-bar);
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
    border-radius: 0 0 6px 6px;
    text-align: left;
  }
  .see-all:hover {
    background: #f3f4f6;
  }
  .not-found {
    margin: 4px 6px 8px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }
</style>
