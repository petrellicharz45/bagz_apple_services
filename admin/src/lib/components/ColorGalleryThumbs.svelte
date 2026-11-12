<script lang="ts">
  import { colorIntLabel, colorIntToHex, normalizeColorImageIndices } from "$lib/colorDisplay";

  export let colors: number[] = [];
  export let colorLabels: string[] = [];
  export let imageUrls: string[] = [];
  export let indices: number[] = [];

  $: {
    const next = normalizeColorImageIndices(colors.length, imageUrls.length, indices);
    if (JSON.stringify(next) !== JSON.stringify(indices)) indices = next;
  }

  function setIndex(ci: number, value: number) {
    const next = [...indices];
    next[ci] = value;
    indices = next;
  }
</script>

{#if colors.length > 0}
  <div class="thumb-map">
    <p class="hint">
      Shop shows a <strong>small photo</strong> for each color (not a color circle). Pick which gallery
      photo matches each color.
    </p>
    {#each colors as c, ci}
      <div class="row">
        <span class="name">{colorIntLabel(c, colorLabels[ci])}</span>
        <span class="hex muted">{colorIntToHex(c)}</span>
        {#if imageUrls.length > 0}
          <select
            value={indices[ci]}
            on:change={(e) => setIndex(ci, parseInt(e.currentTarget.value, 10) || 0)}
          >
            {#each imageUrls as url, pi}
              <option value={pi}>Photo {pi + 1}{pi === 0 ? " (main)" : ""}</option>
            {/each}
          </select>
          <img class="preview" src={imageUrls[indices[ci]]} alt="" />
        {:else}
          <span class="muted">Add product photos first.</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .thumb-map {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: #475569;
    line-height: 1.45;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .name {
    font-weight: 600;
    min-width: 72px;
    text-transform: capitalize;
  }
  .hex.muted,
  .muted {
    color: #64748b;
    font-size: 12px;
  }
  select {
    min-width: 140px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
  }
  .preview {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
</style>
