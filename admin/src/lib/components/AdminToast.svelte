<script lang="ts">
  import { toastStore } from "$lib/stores/toast";
</script>

{#if $toastStore}
  <div class="toast-bar" class:fading={$toastStore.fading} role="status" aria-live="polite">
    <span class="toast-icon" aria-hidden="true">✓</span>
    <span class="toast-text">{$toastStore.message}</span>
  </div>
{/if}

<style>
  .toast-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
    padding: 12px 20px;
    background: linear-gradient(90deg, #bbf7d0 0%, #dcfce7 50%, #bbf7d0 100%);
    border-bottom: 1px solid #86efac;
    color: #14532d;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(22, 101, 52, 0.12);
    transition:
      opacity 0.45s ease,
      transform 0.45s ease,
      max-height 0.45s ease,
      padding 0.45s ease;
    max-height: 80px;
    opacity: 1;
    transform: translateY(0);
  }
  .toast-bar.fading {
    opacity: 0;
    transform: translateY(-6px);
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border-bottom-width: 0;
    overflow: hidden;
  }
  .toast-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #16a34a;
    color: #fff;
    font-size: 13px;
    flex-shrink: 0;
  }
  .toast-text {
    text-align: center;
    line-height: 1.35;
  }
</style>
