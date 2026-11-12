<script>
  import { formatUgx, priceParts, coverUrl } from "../lib/catalog.js";
  import { read as readHistory } from "../lib/browsingHistory.js";
  import { profileStore } from "../lib/accountStore.js";
  import { authUser, logoutShopper } from "../lib/shopAuth.js";
  import { profileInitials } from "../lib/avatarImage.js";
  import TemuIcon from "./TemuIcon.svelte";

  export let onNavigate = () => {};
  export let onOpenProduct = () => {};

  $: history = readHistory();

  const links = [
    { id: "orders", label: "Your orders", icon: "package" },
    { id: "reviews", label: "Your reviews", icon: "message" },
    { id: "profile", label: "Your profile", icon: "user" },
    { id: "coupons", label: "Coupon codes", icon: "tag" },
    { id: "wallet", label: "My Wallet", icon: "wallet" },
    { id: "addresses", label: "Addresses", icon: "globe" }
  ];
</script>

<div class="menu">
  <div class="col history">
    <button type="button" class="head" on:click={() => onNavigate("history")}>
      Browsing history ›
    </button>
    {#if history.length === 0}
      <p class="empty">No recent items yet.</p>
    {:else}
      {#each history.slice(0, 5) as item}
        {@const prices = priceParts(item)}
        <button type="button" class="hist-row" on:click={() => onOpenProduct(item)}>
          <img
            src={coverUrl(item) || `https://picsum.photos/seed/${item.id}/80/80`}
            alt=""
          />
          <span class="hist-name">{item.name}</span>
          <span class="hist-price">{formatUgx(prices.current)}</span>
        </button>
      {/each}
    {/if}
  </div>
  <div class="col account">
    <p class="user">
      <span class="avatar">
        {#if $profileStore.avatarUrl}
          <img src={$profileStore.avatarUrl} alt="" />
        {:else}
          {profileInitials($profileStore.name)}
        {/if}
      </span>
      {$authUser?.email || $profileStore.name?.trim() || "Guest"}
    </p>
    {#if $authUser}
      <button type="button" class="link" on:click={() => logoutShopper()}>Log out</button>
    {:else}
      <button type="button" class="link" on:click={() => onNavigate("login")}>Log in</button>
      <button type="button" class="link" on:click={() => onNavigate("register")}>Create account</button>
    {/if}
    {#each links as link}
      <button type="button" class="link" on:click={() => onNavigate(link.id)}>
        <TemuIcon name={link.icon} size={18} color="#555" />
        {link.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .menu {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    min-width: min(520px, 92vw);
    max-height: 420px;
  }
  .col {
    padding: 14px 16px;
    overflow: auto;
  }
  .history {
    border-right: 1px solid #eee;
    background: #fafafa;
  }
  .head {
    border: none;
    background: none;
    font-weight: 700;
    font-size: var(--text-sm);
    margin-bottom: 10px;
    cursor: pointer;
    padding: 0;
  }
  .empty {
    font-size: var(--text-xs);
    color: #888;
  }
  .hist-row {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 8px;
    align-items: center;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 8px 4px;
    cursor: pointer;
    border-radius: 6px;
  }
  .hist-row:hover {
    background: #fff;
  }
  .hist-row img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
  }
  .hist-name {
    font-size: 11px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hist-price {
    font-size: 11px;
    font-weight: 700;
  }
  .user {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: var(--text-sm);
    margin: 0 0 12px;
  }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--temu-orange);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 12px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 10px 4px;
    font-size: var(--text-sm);
    cursor: pointer;
    border-radius: 6px;
  }
  .link:hover {
    background: #f5f5f5;
  }
  @media (max-width: 640px) {
    .menu {
      grid-template-columns: 1fr;
    }
    .history {
      border-right: none;
      border-bottom: 1px solid #eee;
    }
  }
</style>
