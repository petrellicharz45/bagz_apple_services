<script>
  import "../lib/supportContent.css";

  export let title = "";
  export let onBack = () => {};
</script>

<button type="button" class="back" on:click={onBack}><i class="fa fa-arrow-left" aria-hidden="true"></i> Back to shop</button>
<h1>{title}</h1>
<div class="body info-body">
  <slot />
</div>

<style>
  .back {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 999px;
    padding: 8px 14px;
    margin-bottom: 12px;
    cursor: pointer;
    font-size: var(--text-sm);
  }
  h1 {
    font-size: var(--text-lg);
    margin: 0 0 16px;
  }
  .body {
    background: #fff;
    padding: 16px;
    border-radius: 8px;
    font-size: var(--text-base);
    line-height: 1.5;
    color: var(--text-secondary);
  }
</style>
