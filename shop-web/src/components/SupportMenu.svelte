<script>
  import TemuIcon from "./TemuIcon.svelte";

  export let onNavigate = () => {};

  const items = [
    { id: "support", label: "Support center & FAQ", icon: "headset" },
    { id: "safety", label: "Safety centre", icon: "shield" },
    { id: "chat", label: "Chat with Bagz on WhatsApp", icon: "message" },
    { id: "protection", label: "Warranty & authenticity", icon: "bag" },
    { id: "privacy", label: "Privacy policy", icon: "lock" },
    { id: "terms", label: "Terms of use", icon: "message" }
  ];
</script>

<div class="menu">
  {#each items as item}
    <button type="button" class="row" on:click={() => onNavigate(item.id)}>
      <span class="ico-wrap">
        <TemuIcon name={item.icon} size={20} color="#555" />
      </span>
      {item.label}
    </button>
  {/each}
</div>

<style>
  .menu {
    min-width: 280px;
    padding: 8px 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 12px 18px;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .row:hover {
    background: #f5f5f5;
  }
  .ico-wrap {
    width: 28px;
    display: flex;
    justify-content: center;
  }
</style>
