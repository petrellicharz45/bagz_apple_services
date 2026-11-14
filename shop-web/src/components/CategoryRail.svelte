<script>
  export let categories = [];
  export let products = [];
  export let onPick = () => {};

  const icons = {
    iPhones: "📱",
    Samsung: "📱",
    "Google Pixel": "📱",
    MacBooks: "💻",
    iPads: "📲",
    Watches: "⌚",
    "AirPods & Audio": "🎧",
    Accessories: "🔌",
    All: "🔥"
  };

  function thumbFor(cat) {
    const p = products.find((x) => x.category === cat);
    return p?.cardImage || p?.images?.[0] || null;
  }
</script>

<div class="rail">
  {#each categories as cat}
    {@const thumb = thumbFor(cat)}
    <button type="button" class="cat" on:click={() => onPick(cat)}>
      <span class="circle">
        {#if thumb}
          <img src={thumb} alt="" />
        {:else}
          <span class="emoji">{icons[cat] || "🛍️"}</span>
        {/if}
      </span>
      <span class="label">{cat}</span>
    </button>
  {/each}
</div>

<style>
  .rail {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 10px 2px 12px;
    scrollbar-width: thin;
  }
  .cat {
    flex: 0 0 72px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
  }
  .circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    background: #fff;
    border: 1px solid #eee;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }
  .circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .emoji {
    font-size: 28px;
  }
  .label {
    display: block;
    margin-top: 6px;
    font-size: var(--text-xs);
    font-weight: 400;
    color: #333;
    text-align: center;
    line-height: 1.2;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
