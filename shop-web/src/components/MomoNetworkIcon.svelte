<script>
  export let network = null;
  export let size = 28;
</script>

{#if network === "mtn"}
  <span class="net mtn" style="width:{size}px;height:{size}px" title="MTN Mobile Money" aria-label="MTN">
    <span class="t">MTN</span>
  </span>
{:else if network === "airtel"}
  <span class="net airtel" style="width:{size}px;height:{size}px" title="Airtel Money" aria-label="Airtel">
    <span class="t">AT</span>
  </span>
{/if}

<style>
  .net {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    flex-shrink: 0;
    font-weight: 800;
    font-size: 9px;
    letter-spacing: -0.02em;
    color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }
  .mtn {
    background: linear-gradient(145deg, #ffcc00, #e8a800);
    color: #1a1a1a;
  }
  .airtel {
    background: linear-gradient(145deg, #e40000, #b80000);
  }
  .t {
    line-height: 1;
  }
</style>
