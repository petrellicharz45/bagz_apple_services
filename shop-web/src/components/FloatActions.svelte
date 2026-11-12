<script>
  import TemuIcon from "./TemuIcon.svelte";

  export let onFeedback = () => {};

  function toTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<div class="floats">
  <button type="button" class="fab" aria-label="Feedback" on:click={onFeedback}>
    <TemuIcon name="message" size={20} color="#555" />
    <span>Feedback</span>
  </button>
  <button type="button" class="fab icon-only" aria-label="Back to top" on:click={toTop}>
    <TemuIcon name="arrowUp" size={20} color="#555" />
  </button>
</div>

<style>
  .floats {
    position: fixed;
    right: 12px;
    bottom: 88px;
    z-index: 35;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  @media (max-width: 900px) {
    .floats {
      display: none;
    }
  }
  @media (min-width: 901px) {
    .floats {
      bottom: 24px;
    }
  }
  .fab {
    border: 1px solid #e5e5e5;
    background: #fff;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: var(--text-xs);
    color: #555;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 52px;
  }
  .fab.icon-only {
    padding: 10px;
  }
  .fab span {
    font-size: 10px;
    font-weight: 500;
  }
</style>
