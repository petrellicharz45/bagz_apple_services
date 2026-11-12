<script>
  import CategoryMenuPanel from "./CategoryMenuPanel.svelte";

  export let open = false;
  export let categories = [];
  export let products = [];
  export let browseGroups = null;
  export let categoryImages = {};
  export let onPick = () => {};
  export let onClose = () => {};
</script>

{#if open}
  <div class="mega-anchor" role="presentation">
    <CategoryMenuPanel
      {categories}
      {products}
      {browseGroups}
      {categoryImages}
      variant="mega"
      onPick={(sub) => {
        onPick(sub);
        onClose();
      }}
    />
  </div>
{/if}

<style>
  .mega-anchor {
    position: absolute;
    left: 0;
    top: 100%;
    z-index: 80;
    margin-top: 0;
    padding-top: 2px;
  }
</style>
