<script>
  import MomoNetworkIcon from "./MomoNetworkIcon.svelte";
  import { formatUgx } from "../lib/catalog.js";
  import { networkLabel } from "../lib/momoNetwork.js";

  export let open = false;
  export let phone = "";
  export let amount = 0;
  export let network = null;
  export let purpose = "payment";
</script>

{#if open}
  <div class="pin-backdrop" role="presentation" />
  <div class="pin-modal" role="alertdialog" aria-labelledby="pin-title" aria-live="polite">
    <div class="pin-spin" aria-hidden="true" />
    <MomoNetworkIcon {network} size={40} />
    <h2 id="pin-title">Enter your PIN on your phone</h2>
    <p>
      {#if purpose === "topup"}
        Approve the wallet top-up of <strong>{formatUgx(amount)}</strong> on
        <strong>{networkLabel(network)}</strong> for <strong>{phone}</strong>.
      {:else}
        Approve <strong>{formatUgx(amount)}</strong> on <strong>{networkLabel(network)}</strong> for
        <strong>{phone}</strong>.
      {/if}
    </p>
    <p class="pin-sub">Open the payment prompt on your phone and enter your PIN. Do not share your PIN with anyone.</p>
  </div>
{/if}

<style>
  .pin-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 200;
  }
  .pin-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 210;
    width: min(360px, calc(100vw - 32px));
    background: #fff;
    border-radius: 16px;
    padding: 28px 22px;
    text-align: center;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  }
  .pin-spin {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    border: 4px solid #fed7aa;
    border-top-color: #ea580c;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  .pin-modal h2 {
    margin: 12px 0 8px;
    font-size: var(--text-md);
  }
  .pin-modal p {
    margin: 0 0 8px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.45;
  }
  .pin-sub {
    font-size: var(--text-xs) !important;
    color: #888 !important;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
