<script>
  import { onMount, onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import { watchPopups, pickPopup, dismissPopup } from "../lib/promoPopups.js";

  /** Hide while the visitor is checking out or in a dialog-heavy view. */
  export let suppressed = false;

  let list = [];
  let current = null;
  let visible = false;
  let timer;
  let stop = () => {};
  let shownId = null;

  function schedule() {
    clearTimeout(timer);
    const next = pickPopup(list);
    if (!next) {
      visible = false;
      current = null;
      return;
    }
    if (visible && current?.id === next.id) {
      current = next; // admin edited the live pop-up
      return;
    }
    current = next;
    visible = false;
    timer = setTimeout(() => {
      shownId = next.id;
      visible = true;
    }, (next.delaySeconds ?? 3) * 1000);
  }

  onMount(() => {
    stop = watchPopups((items) => {
      list = items;
      schedule();
    });
  });
  onDestroy(() => {
    clearTimeout(timer);
    stop();
  });

  function close() {
    if (current) dismissPopup(current);
    visible = false;
    // Another live pop-up (lower in the admin list) may now be eligible next visit, not immediately.
    current = null;
  }

  function openLink() {
    if (!current?.link) return;
    const link = current.link;
    close();
    if (link.startsWith("/")) window.location.href = link;
    else window.open(link, "_blank", "noopener,noreferrer");
  }

  function onKey(e) {
    if (e.key === "Escape" && visible) close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if visible && current && !suppressed && shownId === current.id}
  <aside class="promo-popup" role="dialog" aria-label={current.title || "Promotion"} transition:fly={{ y: 40, duration: 260 }}>
    <button type="button" class="close" aria-label="Close promotion" on:click={close}>
      <i class="fa fa-times" aria-hidden="true"></i>
    </button>
    {#if current.link}
      <button type="button" class="art link" on:click={openLink} aria-label={current.title || "Open promotion"}>
        <img src={current.imageUrl} alt={current.title || ""} />
      </button>
    {:else}
      <div class="art">
        <img src={current.imageUrl} alt={current.title || ""} />
      </div>
    {/if}
  </aside>
{/if}

<style>
  .promo-popup {
    position: fixed;
    left: 20px;
    bottom: 20px;
    z-index: 900;
    width: min(340px, calc(100vw - 32px));
    border-radius: 14px;
    overflow: visible;
    box-shadow: 0 18px 48px rgba(12, 34, 54, 0.35);
    background: #0c2236;
  }
  .art {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    border-radius: 14px;
    overflow: hidden;
  }
  .art.link {
    cursor: pointer;
  }
  .art img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 70vh;
    object-fit: contain;
  }
  .close {
    position: absolute;
    top: -12px;
    right: -12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 0;
    background: #fff;
    color: #13344f;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1;
  }
  .close:hover {
    background: #eef7fc;
  }
  @media (max-width: 900px) {
    /* Sit above the phone bottom navigation bar. */
    .promo-popup {
      left: 0;
      right: 0;
      margin: 0 auto;
      bottom: calc(76px + env(safe-area-inset-bottom, 0px));
      width: min(300px, calc(100vw - 40px));
    }
    .close {
      top: -10px;
      right: -10px;
    }
  }
</style>
