<script lang="ts">
  import {
    nearestColorName,
    normalizeHex,
    parseHexList,
    resolveHexFromColorPhrase,
    resolveNamedHex
  } from "$lib/colorDisplay";

  export let value = "";
  /** Same order as hex swatches — shown on shop & admin. */
  export let labels: string[] = [];

  let picker = "#F97316";
  let nameInput = "";
  let nameError = "";

  $: hexList = parseHexList(value);

  $: {
    if (labels.length > hexList.length) {
      labels = labels.slice(0, hexList.length);
    } else if (labels.length < hexList.length) {
      const added = hexList.slice(labels.length).map((h) => nearestColorName(h));
      labels = [...labels, ...added];
    }
  }

  $: previewHex = resolveHexFromColorPhrase(nameInput) || normalizeHex(picker);

  function capitalizeLabel(text: string) {
    return text
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  function addColor(hex: string, label: string) {
    const next = normalizeHex(hex);
    const lab = (label.trim() || nearestColorName(next)).toLowerCase();
    if (labels.some((l) => l.toLowerCase() === lab)) {
      nameError = "That color name is already added.";
      return;
    }
    value = [...hexList, next].join(", ");
    labels = [...labels, label.trim() || nearestColorName(next)];
    nameError = "";
  }

  function addFromPicker() {
    addColor(picker, nearestColorName(picker));
  }

  function addFromName() {
    const typed = nameInput.trim();
    if (!typed) {
      nameError = "Type a color name or hex code.";
      return;
    }
    const fromName = resolveHexFromColorPhrase(typed);
    const hex = fromName || normalizeHex(picker);
    addColor(hex, capitalizeLabel(typed));
    picker = hex;
    nameInput = "";
  }

  function removeAt(index: number) {
    value = hexList.filter((_, i) => i !== index).join(", ");
    labels = labels.filter((_, i) => i !== index);
  }
</script>

<div class="color-picker-field">
  <div class="picker-row">
    <input type="color" bind:value={picker} aria-label="Pick a color" />
    <button type="button" class="add-btn" on:click={addFromPicker}>Add Color</button>
  </div>

  <div class="name-row">
    {#if previewHex}
      <span class="live-chip" style="background: {previewHex}"></span>
    {/if}
    <input
      type="text"
      bind:value={nameInput}
      placeholder="Type any name, e.g. golden rose or black"
      on:keydown={(e) => e.key === "Enter" && (e.preventDefault(), addFromName())}
    />
    <button type="button" class="add-btn" on:click={addFromName}>Add Color</button>
  </div>
  {#if nameInput.trim() && previewHex}
    <p class="hint">
      Preview: {capitalizeLabel(nameInput)} → {previewHex}
      {#if !resolveHexFromColorPhrase(nameInput)}
        · pick a swatch on the left for custom names we do not recognize
      {/if}
    </p>
  {/if}
  {#if nameError}
    <p class="error">{nameError}</p>
  {/if}

  {#if hexList.length}
    <div class="swatches">
      {#each hexList as hex, i}
        <button
          type="button"
          class="swatch"
          title="Remove {labels[i] || hex}"
          on:click={() => removeAt(i)}
        >
          <span class="chip" style="background: {hex}"></span>
          <span class="label">{labels[i] || nearestColorName(hex)}</span>
          <span class="hex-muted">{hex}</span>
          <span class="remove">×</span>
        </button>
      {/each}
    </div>
  {:else}
    <p class="hint">Use the picker or type any color name (e.g. golden rose, champagne).</p>
  {/if}
</div>

<style>
  .color-picker-field {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }
  .picker-row,
  .name-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  input[type="color"] {
    width: 52px;
    height: 40px;
    padding: 0;
    border: 1px solid #dbe3ef;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
  }
  input[type="text"] {
    flex: 1;
    margin: 0;
  }
  .add-btn {
    border: none;
    background: #0f2744;
    color: #fff;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .live-chip {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.12);
    flex: none;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #e5eaf1;
    background: #fff;
    border-radius: 999px;
    padding: 6px 10px 6px 6px;
    cursor: pointer;
  }
  .chip {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.12);
    flex: none;
  }
  .label {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
  }
  .hex-muted {
    font-size: 11px;
    color: #9ca3af;
  }
  .remove {
    color: #9ca3af;
    font-size: 16px;
    line-height: 1;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: #b91c1c;
  }
</style>
