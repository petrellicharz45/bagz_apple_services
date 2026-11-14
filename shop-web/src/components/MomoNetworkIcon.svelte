<script>
  /** Mobile money network badge (MTN MoMo yellow / Airtel Money red). */
  export let network = null;
  export let size = 28;
</script>

{#if network === "mtn"}
  <span class="net mtn" style="width:{size}px;height:{size}px" title="MTN Mobile Money" aria-label="MTN Mobile Money">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="17" rx="15" ry="9.5" fill="none" stroke="#1a1a1a" stroke-width="2.4" />
      <text x="20" y="20.6" text-anchor="middle" font-size="10.5" font-weight="900" font-family="Arial, Helvetica, sans-serif" fill="#1a1a1a">MTN</text>
      <text x="20" y="35" text-anchor="middle" font-size="7.5" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="#1a1a1a">MoMo</text>
    </svg>
  </span>
{:else if network === "airtel"}
  <span class="net airtel" style="width:{size}px;height:{size}px" title="Airtel Money" aria-label="Airtel Money">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 6c-6 0-10 4.6-10 9.6 0 6.4 6.6 9.2 6.6 14.4 0 1.6-.8 2.8-2 3.6 5.8-.2 9.2-4.4 9.2-9 0-5.8-6.4-8.4-6.4-12.8 0-2.6 1.6-4.4 4-5.2-.4-.4-.9-.6-1.4-.6z" fill="#fff" />
      <text x="27.5" y="35" text-anchor="middle" font-size="7" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="#fff">airtel</text>
    </svg>
  </span>
{/if}

<style>
  .net {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }
  .net svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .mtn {
    background: #ffcb05;
  }
  .airtel {
    background: #e40000;
  }
</style>
