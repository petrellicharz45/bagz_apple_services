<script>
  import { formatUgx, priceParts, coverUrl } from "../lib/catalog.js";
  import { read as readHistory } from "../lib/browsingHistory.js";
  import { readMyReviewsIndex } from "../lib/productReviews.js";
  import {
    readOrders,
    formatOrderDate,
    fetchOrderStatuses,
    updateOrder,
    orderAmountDue,
    isOrderPayable,
    isOrderFullyPaid
  } from "../lib/orders.js";
  import { initiateMoMoPayment } from "../lib/payment.js";
  import { deductStockForWebOrder } from "../lib/stockDeduct.js";
  import { deliveryEstimateText } from "../lib/delivery.js";
  import { fileToAvatarDataUrl } from "../lib/avatarImage.js";
  import { authUser, registerShopper, loginShopper, logoutShopper, authErrorText } from "../lib/shopAuth.js";
  import {
    readProfile,
    saveProfile,
    readAddresses,
    addAddress,
    removeAddress,
    setDefaultAddress,
    COUPONS
  } from "../lib/accountStore.js";
  import TemuIcon from "./TemuIcon.svelte";
  import {
    walletBalanceStore,
    readWalletTransactions,
    syncWalletFromCloud,
    formatTxType
  } from "../lib/wallet.js";
  import { processWalletTopUp } from "../lib/walletTopUp.js";
  import { detectMobileNetwork } from "../lib/momoNetwork.js";
  import MomoNetworkIcon from "./MomoNetworkIcon.svelte";
  import MoMoPinModal from "./MoMoPinModal.svelte";
  import AppDownloadActions from "./AppDownloadActions.svelte";
  import { liveContact } from "../lib/shopContact.js";
  import { describeFulfillment } from "../lib/orderFulfillment.js";

  export let section = "hub";
  export let refreshKey = 0;
  export let products = [];
  export let onOpenProduct = () => {};
  export let onGoShop = () => {};
  export let onGoCart = () => {};
  export let onNavigateSection = () => {};
  export let onOpenHelp = () => {};

  let profile = readProfile();
  let addresses = [];
  let orders = [];
  let history = [];
  let addrLabel = "Home";
  let addrLine = "";
  let profileSaved = "";
  let authFirst = "";
  let authLast = "";
  let authEmail = "";
  let authPhone = "";
  let authPassword = "";
  let authBusy = false;
  let authMsg = "";
  let copiedCode = "";
  let avatarError = "";
  let avatarBusy = false;
  let walletTx = [];
  let topUpAmount = 1000;
  let topUpMethod = "mtn";
  let walletMsg = "";
  let walletErr = "";
  let walletSyncing = false;
  let topUpPhone = "";
  let topUpBusy = false;
  let topUpPinOpen = false;
  const PIN_MODAL_MIN_MS = 2800;
  let payPreviewOrder = null;
  let payPhone = "";
  let payError = "";
  let payBusy = false;
  let payPinOpen = false;
  $: payAmount = payPreviewOrder ? orderAmountDue(payPreviewOrder) : 0;
  $: payNetwork = detectMobileNetwork(payPhone);
  $: topUpNetwork = detectMobileNetwork(topUpPhone);
  $: if (section === "wallet" && !topUpPhone && profile.phone) {
    topUpPhone = profile.phone;
  }

  const titles = {
    hub: "Your account",
    orders: "Your orders",
    history: "Browsing history",
    reviews: "Your reviews",
    profile: "Your profile",
    coupons: "Coupon codes",
    wallet: "Credit balance",
    addresses: "Delivery addresses"
  };

  $: refreshKey, (orders = readOrders());
  let remoteOrders = {};
  async function refreshRemoteOrders() {
    remoteOrders = await fetchOrderStatuses(orders.map((o) => o.orderId));
  }
  function track(order) {
    return describeFulfillment(order, remoteOrders[order.orderId]);
  }
  $: if (section === "orders" || section === "hub") refreshRemoteOrders();
  $: refreshKey, (history = readHistory());
  $: refreshKey, (myReviews = readMyReviewsIndex());
  let myReviews = [];
  $: refreshKey, (addresses = readAddresses());
  $: title = titles[section] || "Your account";
  let walletVisited = false;
  $: if (section === "wallet") {
    walletTx = readWalletTransactions();
    if (!walletVisited) {
      walletVisited = true;
      refreshWallet();
    }
  } else {
    walletVisited = false;
  }

  async function refreshWallet() {
    walletSyncing = true;
    walletErr = "";
    try {
      await syncWalletFromCloud();
      walletTx = readWalletTransactions();
    } catch (e) {
      walletErr = e.message || "Could not refresh wallet.";
    } finally {
      walletSyncing = false;
    }
  }

  async function submitTopUp() {
    walletErr = "";
    walletMsg = "";
    if (topUpMethod === "card") {
      walletErr = "Card top-up is coming soon. Use MTN or Airtel Money.";
      return;
    }
    topUpBusy = true;
    topUpPinOpen = true;
    try {
      const res = await processWalletTopUp({
        amount: topUpAmount,
        phone: topUpPhone,
        method: topUpMethod
      });
      walletTx = readWalletTransactions();
      if (res.ok) {
        walletMsg = res.message;
        saveProfile({ ...profile, phone: topUpPhone.trim() });
        profile = readProfile();
      } else {
        walletErr = res.message;
      }
    } catch (e) {
      walletErr = e.message || "Top-up failed.";
    } finally {
      topUpPinOpen = false;
      topUpBusy = false;
    }
  }

  async function submitRegister() {
    authBusy = true;
    authMsg = "";
    try {
      await registerShopper({
        firstName: authFirst,
        lastName: authLast,
        email: authEmail,
        phone: authPhone,
        password: authPassword
      });
      profile = readProfile();
      onNavigateSection("hub");
    } catch (error) {
      authMsg = authErrorText(error);
    } finally {
      authBusy = false;
    }
  }

  async function submitLogin() {
    authBusy = true;
    authMsg = "";
    try {
      await loginShopper(authEmail, authPassword);
      profile = readProfile();
      onNavigateSection("hub");
    } catch (error) {
      authMsg = authErrorText(error);
    } finally {
      authBusy = false;
    }
  }

  async function submitLogout() {
    await logoutShopper();
    profile = readProfile();
  }

  function persistProfile() {
    profile = saveProfile(profile);
    profileSaved = "Saved.";
    setTimeout(() => (profileSaved = ""), 2000);
  }

  async function onAvatarPick(e) {
    avatarError = "";
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    avatarBusy = true;
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      profile = saveProfile({ ...profile, avatarUrl });
      profileSaved = "Photo updated.";
      setTimeout(() => (profileSaved = ""), 2000);
    } catch (err) {
      avatarError = err.message || "Could not use that image.";
    } finally {
      avatarBusy = false;
    }
  }

  function removeAvatar() {
    profile = saveProfile({ ...profile, avatarUrl: "" });
  }

  function submitAddress() {
    addresses = addAddress({ label: addrLabel, line: addrLine });
    addrLine = "";
  }

  async function copyCode(code) {
    copiedCode = code;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
    setTimeout(() => (copiedCode = ""), 2000);
  }

  function itemDelivery(item) {
    if (item?.delivery) return item.delivery;
    const p = products.find((x) => x.id === item.id);
    return deliveryEstimateText(p);
  }

  function itemImageUrl(item) {
    if (item?.imageUrl) return item.imageUrl;
    const p = products.find((x) => x.id === item.id);
    return p ? coverUrl(p) : "";
  }

  function openPayPreview(order) {
    payPreviewOrder = order;
    payError = "";
    payPhone = (order.phone || profile.phone || "").trim();
  }

  function closePayPreview() {
    if (payBusy) return;
    payPreviewOrder = null;
    payError = "";
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function confirmOrderPayment() {
    if (!payPreviewOrder || payBusy) return;
    const order = payPreviewOrder;
    const amount = orderAmountDue(order);
    payError = "";
    if (amount <= 0) {
      payError = "This order is already paid.";
      return;
    }
    const phone = payPhone.trim();
    if (phone.length < 9) {
      payError = "Enter your MTN or Airtel mobile money number.";
      return;
    }
    if (!payNetwork) {
      payError = "Use a valid MTN (077…) or Airtel (070/075…) Uganda number.";
      return;
    }

    payBusy = true;
    payPinOpen = true;
    const started = Date.now();
    try {
      const momoResult = await initiateMoMoPayment({
        phone,
        amount,
        orderId: order.orderId,
        items: order.items || []
      });
      const elapsed = Date.now() - started;
      if (elapsed < PIN_MODAL_MIN_MS) await sleep(PIN_MODAL_MIN_MS - elapsed);

      if (momoResult.ok && !momoResult.pending) {
        await deductStockForWebOrder(
          order.orderId,
          (order.items || []).map((i) => ({ id: i.id, qty: i.qty }))
        );
        const total = Number(order.total || 0);
        orders = updateOrder(order.orderId, {
          phone,
          amountPaid: total,
          amountDue: 0,
          status: "paid",
          paidAt: Date.now()
        });
        if (phone) {
          profile = saveProfile({ ...profile, phone });
        }
        payPreviewOrder = null;
      } else if (momoResult.pending) {
        orders = updateOrder(order.orderId, {
          phone,
          status: "awaiting_payment",
          lastPaymentAttemptAt: Date.now()
        });
        payError =
          momoResult.message ||
          "Waiting for approval on your phone. Pay now will stay until payment succeeds.";
      } else {
        payError = momoResult.message || "Payment was not completed. You can try Pay now again.";
      }
    } catch (e) {
      payError = e.message || "Payment failed.";
    } finally {
      payPinOpen = false;
      payBusy = false;
    }
  }
</script>

<h1>{title}</h1>

{#if section === "hub"}
  <div class="hub-profile" aria-hidden={false}>
    {#if profile.avatarUrl}
      <img class="hub-avatar" src={profile.avatarUrl} alt="" />
    {:else}
      <span class="hub-avatar fallback">
        <TemuIcon name="user" size={36} color="#9ca3af" strokeWidth={1.75} />
      </span>
    {/if}
  </div>
  <p class="lead">
    {#if $authUser}
      Signed in as {$authUser.email}
    {:else}
      Browsing as a guest. Log in when you want orders saved to your account.
    {/if}
  </p>
  <div class="auth-row">
    {#if $authUser}
      <button type="button" class="primary" on:click={submitLogout}>Log out</button>
    {:else}
      <button type="button" class="primary" on:click={() => onNavigateSection("login")}>Log in</button>
      <button type="button" class="primary" on:click={() => onNavigateSection("register")}>Create account</button>
    {/if}
  </div>
  <div class="hub-grid">
    <button type="button" class="hub-card" on:click={() => onNavigateSection("orders")}>
      <strong>Your orders</strong>
      <span>{orders.length} on this device</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onNavigateSection("history")}>
      <strong>Browsing history</strong>
      <span>{history.length} recent items</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onNavigateSection("profile")}>
      <strong>Your profile</strong>
      <span>Name, email, phone</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onNavigateSection("addresses")}>
      <strong>Addresses</strong>
      <span>{addresses.length} saved</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onNavigateSection("coupons")}>
      <strong>Coupon codes</strong>
      <span>{COUPONS.length} available</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onOpenHelp("about")}>
      <strong>About Bagz</strong>
      <span>Who we are</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onOpenHelp("shipping")}>
      <strong>Delivery and returns</strong>
      <span>Shipping and refunds</span>
    </button>
    <button type="button" class="hub-card" on:click={() => onOpenHelp("terms")}>
      <strong>Terms and privacy</strong>
      <span>How the shop works</span>
    </button>
    <div class="hub-card contact-card">
      <strong>Contact us</strong>
      {#if $liveContact.email}
        <a href={"mailto:" + $liveContact.email}>Email {$liveContact.email}</a>
      {/if}
      {#if $liveContact.whatsapp}
        <a href={"https://wa.me/" + $liveContact.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      {/if}
      {#if $liveContact.call}
        <a href={"tel:" + $liveContact.call}>Call {$liveContact.call}</a>
      {/if}
      {#each $liveContact.socials as social}
        <a href={social.url} target="_blank" rel="noopener noreferrer"><i class="fa fa-{social.icon} fa-fw" aria-hidden="true"></i> {social.label}</a>
      {/each}
    </div>
    <button type="button" class="hub-card wallet-hub" on:click={() => onNavigateSection("wallet")}>
      <span class="hub-ico"><TemuIcon name="wallet" size={20} color="#1673c4" /></span>
      <strong>My Wallet</strong>
      <span>{formatUgx($walletBalanceStore)} available</span>
    </button>
    <div class="hub-card">
      <strong>Install app</strong>
      <span>Add Bagz to your home screen</span>
      <AppDownloadActions layout="footer" />
    </div>
  </div>
{:else if section === "orders"}
  {#if orders.length === 0}
    <p class="lead">No orders yet on this browser.</p>
    <div class="actions">
      <button type="button" class="primary" on:click={onGoShop}>Start shopping</button>
      <button type="button" class="ghost" on:click={onGoCart}>View cart</button>
    </div>
  {:else}
    <ul class="order-list">
      {#each orders as order (order.orderId)}
        <li class="order-card">
          <div class="order-head">
            <span class="ref">#{order.orderId}</span>
            <span class="muted">{formatOrderDate(order.createdAt)}</span>
          </div>
          <p class="status-tag">{isOrderFullyPaid(order) ? "Paid" : "Awaiting payment"}</p>
          <p class="status-tag">
            {track(order).label}
            {#if track(order).when}· {track(order).when}{/if}
          </p>
          {#if track(order).window}<p class="muted">{track(order).window}</p>{/if}
          <p class="total">{formatUgx(order.total || 0)}</p>
          {#if !isOrderFullyPaid(order) && orderAmountDue(order) > 0 && orderAmountDue(order) < Number(order.total || 0)}
            <p class="muted due-hint">Due: {formatUgx(orderAmountDue(order))}</p>
          {/if}
          <ul class="mini-lines">
            {#each (order.items || []).slice(0, 4) as item}
              {@const img = itemImageUrl(item)}
              <li class="mini-line">
                {#if img}
                  <img class="mini-thumb" src={img} alt="" />
                {:else}
                  <span class="mini-thumb placeholder" aria-hidden="true" />
                {/if}
                <span class="mini-label">{item.name} × {item.qty}</span>
              </li>
            {/each}
          </ul>
          {#if isOrderPayable(order)}
            <button type="button" class="pay-now" on:click={() => openPayPreview(order)}>
              Pay now
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{:else if section === "history"}
  {#if history.length === 0}
    <p class="lead">Items you view will show up here.</p>
    <button type="button" class="primary" on:click={onGoShop}>Browse deals</button>
  {:else}
    <ul class="hist-list">
      {#each history as item (item.id)}
        {@const prices = priceParts(item)}
        <li>
          <button type="button" class="hist-row" on:click={() => onOpenProduct(item)}>
            <img
              src={coverUrl(item) || `https://picsum.photos/seed/${item.id}/80/80`}
              alt=""
            />
            <span class="hist-name">{item.name}</span>
            <span class="hist-price">{formatUgx(prices.current)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{:else if section === "reviews"}
  <p class="lead">Pick a product, rate it with stars, and add a comment — it shows on that product page.</p>
  {#if myReviews.length}
    <h3 class="subhead">Your posted reviews</h3>
    <ul class="hist-list">
      {#each myReviews as row (row.productId)}
        <li>
          <button
            type="button"
            class="review-row"
            on:click={() => {
              const p = history.find((h) => h.id === row.productId) || {
                id: row.productId,
                name: row.productName
              };
              onOpenProduct(p, { review: true });
            }}
          >
            <span>{row.productName || "Product"}</span>
            <span class="linkish">★ {row.rating} · View ›</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <h3 class="subhead">Write a new review</h3>
  {#if history.length === 0}
    <button type="button" class="primary" on:click={onGoShop}>Browse products to review</button>
  {:else}
    <ul class="hist-list">
      {#each history.slice(0, 12) as item (item.id)}
        <li>
          <button
            type="button"
            class="review-row"
            on:click={() => onOpenProduct(item, { review: true })}
          >
            <span>{item.name}</span>
            <span class="linkish">Write review ›</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{:else if section === "login"}
  <form class="form" on:submit|preventDefault={submitLogin}>
    <label>Email<input type="email" bind:value={authEmail} required /></label>
    <label>Password<input type="password" bind:value={authPassword} required minlength="6" /></label>
    <button type="submit" class="primary" disabled={authBusy}>{authBusy ? "Please wait…" : "Log in"}</button>
    {#if authMsg}<p class="ok">{authMsg}</p>{/if}
    <button type="button" class="linkish" on:click={() => onNavigateSection("register")}>Create account</button>
  </form>
{:else if section === "register"}
  <form class="form" on:submit|preventDefault={submitRegister}>
    <label>First name<input bind:value={authFirst} required /></label>
    <label>Last name<input bind:value={authLast} required /></label>
    <label>Email<input type="email" bind:value={authEmail} required /></label>
    <label>Phone<input type="tel" bind:value={authPhone} placeholder="077…" /></label>
    <label>Password<input type="password" bind:value={authPassword} required minlength="6" /></label>
    <button type="submit" class="primary" disabled={authBusy}>{authBusy ? "Please wait…" : "Create account"}</button>
    {#if authMsg}<p class="ok">{authMsg}</p>{/if}
    <button type="button" class="linkish" on:click={() => onNavigateSection("login")}>Already have an account? Log in</button>
  </form>
{:else if section === "profile"}
  <button type="button" class="wallet-strip" on:click={() => onNavigateSection("wallet")}>
    <TemuIcon name="wallet" size={28} color="#fff" />
    <div>
      <strong>My Wallet</strong>
      <span>{formatUgx($walletBalanceStore)} · Refunds &amp; top-ups</span>
    </div>
    <span class="chev">›</span>
  </button>
  <form class="form" on:submit|preventDefault={persistProfile}>
    <div class="avatar-block">
      <div class="avatar-preview">
        {#if profile.avatarUrl}
          <img src={profile.avatarUrl} alt="" />
        {:else}
          <span class="avatar-placeholder">Photo</span>
        {/if}
      </div>
      <div class="avatar-actions">
        <p class="muted">Profile photo (saved on this device)</p>
        <label class="upload-label">
          Choose photo
          <input
            type="file"
            accept="image/*"
            on:change={onAvatarPick}
            disabled={avatarBusy}
          />
          {#if avatarBusy}<span>Uploading…</span>{/if}
        </label>
        {#if profile.avatarUrl}
          <button type="button" class="ghost small" on:click={removeAvatar}>Remove photo</button>
        {/if}
        {#if avatarError}
          <p class="avatar-err">{avatarError}</p>
        {/if}
      </div>
    </div>
    <label>
      Full name
      <input bind:value={profile.name} placeholder="Used at checkout" />
    </label>
    <label>
      Email
      <input type="email" bind:value={profile.email} placeholder="Order updates" />
    </label>
    <label>
      Payment phone
      <input type="tel" bind:value={profile.phone} placeholder="077…" />
    </label>
    <button type="submit" class="primary">Save profile</button>
    {#if profileSaved}
      <p class="ok">{profileSaved}</p>
    {/if}
  </form>
{:else if section === "coupons"}
  <ul class="coupon-list">
    {#each COUPONS as c}
      <li class="coupon">
        <div>
          <strong>{c.title}</strong>
          <p class="muted">{c.detail}</p>
        </div>
        <button type="button" class="code" on:click={() => copyCode(c.code)}>
          {copiedCode === c.code ? "Copied" : c.code}
        </button>
      </li>
    {/each}
  </ul>
{:else if section === "wallet"}
  <div class="wallet-hero">
    <TemuIcon name="wallet" size={36} color="#fff" />
    <p class="wallet-label">Available balance</p>
    <p class="balance">{formatUgx($walletBalanceStore)}</p>
  </div>
  <p class="lead">
    Refunds for returns or out-of-stock items (once approved) are credited here automatically or by our team.
    Use your balance at checkout or top up below.
  </p>
  <button type="button" class="ghost small" disabled={walletSyncing} on:click={refreshWallet}>
    {walletSyncing ? "Syncing…" : "Refresh from account"}
  </button>
  <form class="form topup-form" on:submit|preventDefault={submitTopUp}>
    <h2 class="subhead">Top up wallet</h2>
    <label>
      Amount (UGX)
      <input type="number" min="1000" step="500" bind:value={topUpAmount} />
    </label>
    <p class="muted">Pay with</p>
    <div class="pay-chips">
      <button
        type="button"
        class:sel={topUpMethod === "mtn"}
        on:click={() => (topUpMethod = "mtn")}
      >
        MTN Mobile Money
      </button>
      <button
        type="button"
        class:sel={topUpMethod === "airtel"}
        on:click={() => (topUpMethod = "airtel")}
      >
        Airtel Money
      </button>
      <button
        type="button"
        class:sel={topUpMethod === "card"}
        on:click={() => (topUpMethod = "card")}
      >
        Card
      </button>
    </div>
    <label>
      Payment phone number
      <div class="phone-topup">
        <input type="tel" bind:value={topUpPhone} placeholder="e.g. 077… or 075…" />
        <MomoNetworkIcon network={topUpNetwork} size={32} />
      </div>
    </label>
    <p class="muted small-hint">You will get a prompt on this phone — enter your PIN to approve the deposit.</p>
    <button type="submit" class="primary" disabled={topUpBusy}>
      {topUpBusy ? "Waiting for PIN…" : "Confirm top-up"}
    </button>
  </form>
  <MoMoPinModal
    open={topUpPinOpen}
    phone={topUpPhone}
    amount={topUpAmount}
    network={topUpNetwork}
    purpose="topup"
  />
  {#if walletMsg}
    <p class="ok">{walletMsg}</p>
  {/if}
  {#if walletErr}
    <p class="avatar-err">{walletErr}</p>
  {/if}
  <h2 class="subhead">Transaction history</h2>
  {#if walletTx.length === 0}
    <p class="muted block">No transactions yet.</p>
  {:else}
    <ul class="tx-list">
      {#each walletTx as tx (tx.id)}
        <li>
          <div>
            <strong>{formatTxType(tx.type)}</strong>
            <span class="muted">{new Date(tx.createdAt).toLocaleString("en-UG")}</span>
            {#if tx.note}
              <p class="tx-note">{tx.note}</p>
            {/if}
          </div>
          <span class:pos={tx.amount > 0} class:neg={tx.amount < 0}>
            {tx.amount > 0 ? "+" : ""}{formatUgx(Math.abs(tx.amount))}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="actions">
    <button type="button" class="ghost" on:click={() => onNavigateSection("orders")}>View orders</button>
    <button type="button" class="primary" on:click={onGoShop}>Shop with wallet</button>
  </div>
{:else if section === "addresses"}
  <form class="form" on:submit|preventDefault={submitAddress}>
    <label>
      Label
      <input bind:value={addrLabel} placeholder="Home, Office…" />
    </label>
    <label>
      Address
      <textarea bind:value={addrLine} rows="3" placeholder="Area, street, landmark — Uganda" />
    </label>
    <button type="submit" class="primary" disabled={!addrLine.trim()}>Add address</button>
  </form>
  {#if addresses.length === 0}
    <p class="muted block">Saved addresses auto-fill at checkout.</p>
  {:else}
    <ul class="addr-list">
      {#each addresses as addr (addr.id)}
        <li class:default={addr.isDefault}>
          <div>
            <strong>{addr.label}</strong>
            {#if addr.isDefault}
              <span class="badge">Default</span>
            {/if}
            <p>{addr.line}</p>
          </div>
          <div class="addr-actions">
            {#if !addr.isDefault}
              <button type="button" class="ghost small" on:click={() => (addresses = setDefaultAddress(addr.id))}>
                Set default
              </button>
            {/if}
            <button type="button" class="ghost small danger" on:click={() => (addresses = removeAddress(addr.id))}>
              Remove
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

{#if section !== "hub"}
  <button type="button" class="back-section" on:click={() => onNavigateSection("hub")}>
    <i class="fa fa-arrow-left" aria-hidden="true"></i> All account sections
  </button>
{/if}

{#if payPreviewOrder}
  <div class="pay-backdrop" role="presentation" on:click={closePayPreview} on:keydown={() => {}} />
  <div class="pay-dialog" role="dialog" aria-labelledby="pay-preview-title">
    <h2 id="pay-preview-title">Order preview</h2>
    <p class="pay-ref muted">#{payPreviewOrder.orderId}</p>
    <p class="pay-meta muted">Placed {formatOrderDate(payPreviewOrder.createdAt)}</p>

    <dl class="pay-details">
      {#if payPreviewOrder.name}
        <div><dt>Customer</dt><dd>{payPreviewOrder.name}</dd></div>
      {/if}
      {#if payPreviewOrder.address}
        <div><dt>Deliver to</dt><dd>{payPreviewOrder.address}</dd></div>
      {/if}
    </dl>

    <table class="pay-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Delivery</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        {#each payPreviewOrder.items || [] as item}
          {@const img = itemImageUrl(item)}
          <tr>
            <td class="product-cell">
              <div class="preview-line">
                {#if img}
                  <img class="preview-thumb" src={img} alt="" />
                {:else}
                  <span class="preview-thumb placeholder" aria-hidden="true" />
                {/if}
                <span class="preview-name">{item.name}</span>
              </div>
            </td>
            <td>{item.qty}</td>
            <td>{itemDelivery(item)}</td>
            <td>{formatUgx((item.price || 0) * (item.qty || 1))}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="pay-total-row">
      <span>Total due now</span>
      <strong>{formatUgx(payAmount)}</strong>
    </div>

    <label class="pay-phone">
      Mobile money number
      <div class="phone-wrap">
        <input type="tel" bind:value={payPhone} placeholder="e.g. 0772123456" />
        <MomoNetworkIcon network={payNetwork} size={32} />
      </div>
    </label>

    {#if payError}
      <p class="pay-err">{payError}</p>
    {/if}

    <div class="pay-actions">
      <button type="button" class="ghost" disabled={payBusy} on:click={closePayPreview}>Cancel</button>
      <button type="button" class="primary" disabled={payBusy} on:click={confirmOrderPayment}>
        {payBusy ? "Processing…" : "Confirm payment"}
      </button>
    </div>
  </div>
{/if}

<MoMoPinModal
  open={payPinOpen}
  phone={payPhone}
  amount={payAmount}
  network={payNetwork}
  purpose="payment"
/>

<style>
  h1 {
    font-size: var(--text-lg);
    margin: 0 0 12px;
  }
  .hub-profile {
    display: flex;
    justify-content: center;
    margin: 4px 0 14px;
  }
  .hub-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #cbe8f7;
    background: #f3f4f6;
  }
  .hub-avatar.fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
  }
  .lead {
    margin: 0 0 16px;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
  .auth-row {
    display: flex;
    gap: 8px;
    margin: 0 0 16px;
  }
  .muted {
    color: #888;
    font-size: var(--text-xs);
  }
  .block {
    margin-top: 16px;
  }
  .ok {
    color: #169d4a;
    font-size: var(--text-sm);
    margin: 8px 0 0;
  }
  .hub-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  .hub-card {
    text-align: left;
    border: 1px solid #eee;
    background: #fafafa;
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .contact-card {
    cursor: default;
  }
  .contact-card a {
    color: #1673c4;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }
  .hub-card:hover {
    border-color: var(--temu-orange);
    background: #fff;
  }
  .hub-card span {
    font-size: var(--text-xs);
    color: #666;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .primary,
  .ghost {
    border-radius: 999px;
    padding: 10px 18px;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }
  .primary {
    border: none;
    background: var(--temu-orange);
    color: #fff;
  }
  .ghost {
    border: 1px solid #ddd;
    background: #fff;
    color: #333;
  }
  .ghost.small {
    padding: 6px 10px;
    font-size: 11px;
  }
  .ghost.danger {
    color: #b91c1c;
    border-color: #fecaca;
  }
  .order-list,
  .hist-list,
  .addr-list,
  .coupon-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .order-card {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
  }
  .order-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: var(--text-xs);
  }
  .ref {
    font-weight: 700;
  }
  .status-tag {
    margin: 8px 0 4px;
    font-size: var(--text-xs);
    color: var(--temu-orange);
    font-weight: 700;
  }
  .total {
    margin: 0 0 8px;
    font-weight: 800;
  }
  .due-hint {
    margin: -4px 0 8px;
  }
  .mini-lines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mini-line {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mini-thumb {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
    background: #f3f4f6;
    border: 1px solid #eee;
  }
  .mini-thumb.placeholder {
    display: inline-block;
  }
  .mini-label {
    font-size: var(--text-xs);
    color: #555;
    line-height: 1.3;
  }
  .pay-now {
    margin-top: 12px;
    width: 100%;
    border: none;
    border-radius: 999px;
    padding: 10px 16px;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(90deg, #5bbde9, #1673c4);
    color: #fff;
  }
  .pay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 180;
  }
  .pay-dialog {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 190;
    width: min(520px, calc(100vw - 24px));
    max-height: min(90vh, 720px);
    overflow: auto;
    background: #fff;
    border-radius: 14px;
    padding: 20px 18px 18px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  }
  .pay-dialog h2 {
    margin: 0 0 4px;
    font-size: var(--text-md);
  }
  .pay-ref {
    margin: 0;
    font-weight: 700;
  }
  .pay-meta {
    margin: 0 0 14px;
  }
  .pay-details {
    margin: 0 0 14px;
    font-size: var(--text-sm);
  }
  .pay-details div {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 8px;
    margin-bottom: 6px;
  }
  .pay-details dt {
    margin: 0;
    color: #888;
    font-weight: 600;
  }
  .pay-details dd {
    margin: 0;
  }
  .pay-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs);
    margin-bottom: 14px;
  }
  .pay-table th,
  .pay-table td {
    border-bottom: 1px solid #eee;
    padding: 8px 6px;
    text-align: left;
    vertical-align: top;
  }
  .pay-table th {
    color: #888;
    font-weight: 700;
  }
  .product-cell {
    min-width: 140px;
  }
  .preview-line {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .preview-thumb {
    width: 52px;
    height: 52px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    background: #f3f4f6;
    border: 1px solid #eee;
  }
  .preview-thumb.placeholder {
    display: inline-block;
  }
  .preview-name {
    font-weight: 600;
    line-height: 1.3;
  }
  .pay-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    font-size: var(--text-sm);
  }
  .pay-total-row strong {
    font-size: var(--text-md);
  }
  .pay-phone {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    margin-bottom: 12px;
  }
  .pay-phone input {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font: inherit;
    box-sizing: border-box;
  }
  .phone-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .phone-wrap input {
    flex: 1;
    margin-top: 0;
  }
  .pay-err {
    color: #b91c1c;
    font-size: var(--text-sm);
    margin: 0 0 10px;
  }
  .pay-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .hist-row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 10px;
    align-items: center;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 10px 4px;
    cursor: pointer;
    border-radius: 6px;
  }
  .hist-row:hover {
    background: #f5f5f5;
  }
  .hist-row img {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
  }
  .hist-name {
    font-size: var(--text-sm);
    line-height: 1.3;
  }
  .hist-price {
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .review-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    border: none;
    background: #fafafa;
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    text-align: left;
    font-size: var(--text-sm);
  }
  .linkish {
    color: var(--temu-orange);
    font-weight: 700;
    white-space: nowrap;
  }
  .avatar-block {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #eee;
  }
  .avatar-preview {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    overflow: hidden;
    background: #f3f4f6;
    border: 2px solid #e5e7eb;
    flex-shrink: 0;
    display: grid;
    place-items: center;
  }
  .avatar-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-placeholder {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 600;
  }
  .avatar-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .upload-label {
    display: inline-block;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--temu-orange);
    cursor: pointer;
  }
  .upload-label input {
    display: none;
  }
  .avatar-err {
    color: #b91c1c;
    font-size: var(--text-xs);
    margin: 0;
  }
  .form label {
    display: block;
    font-size: var(--text-sm);
    margin-bottom: 12px;
  }
  .form input,
  .form textarea {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font: inherit;
  }
  .wallet-hub {
    position: relative;
  }
  .hub-ico {
    margin-bottom: 4px;
  }
  .wallet-strip {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    border: none;
    background: linear-gradient(135deg, #1673c4, #13344f);
    color: #fff;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 18px;
    cursor: pointer;
    text-align: left;
  }
  .wallet-strip strong {
    display: block;
    font-size: var(--text-sm);
  }
  .wallet-strip span {
    font-size: var(--text-xs);
    opacity: 0.9;
  }
  .wallet-strip .chev {
    margin-left: auto;
    font-size: 20px;
    opacity: 0.85;
  }
  .wallet-hero {
    background: linear-gradient(135deg, #1b1512, #3d2919);
    color: #fff;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 14px;
  }
  .wallet-label {
    margin: 10px 0 0;
    font-size: var(--text-xs);
    opacity: 0.75;
  }
  .balance {
    font-size: 32px;
    font-weight: 900;
    margin: 4px 0 0;
  }
  .subhead {
    font-size: var(--text-sm);
    margin: 20px 0 10px;
  }
  .topup-form {
    margin-top: 12px;
  }
  .phone-topup {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .phone-topup input {
    flex: 1;
    margin-top: 0;
  }
  .small-hint {
    margin: -4px 0 12px;
  }
  .pay-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .pay-chips button {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 999px;
    padding: 8px 14px;
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
  }
  .pay-chips button.sel {
    border-color: var(--temu-orange);
    background: #eef7fc;
    color: #13344f;
  }
  .tx-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .tx-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #eee;
    font-size: var(--text-sm);
  }
  .tx-list .muted {
    display: block;
    margin-top: 2px;
  }
  .tx-note {
    margin: 4px 0 0;
    font-size: 11px;
    color: #666;
  }
  .tx-list .pos {
    color: #169d4a;
    font-weight: 800;
  }
  .tx-list .neg {
    color: #333;
    font-weight: 800;
  }
  .coupon {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid #eee;
  }
  .code {
    border: 2px dashed var(--temu-orange);
    background: #eef7fc;
    color: #0c2236;
    font-weight: 800;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .addr-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid #eee;
  }
  .addr-list li.default {
    background: #fffbeb;
    margin: 0 -8px;
    padding: 14px 8px;
    border-radius: 8px;
  }
  .badge {
    font-size: 10px;
    background: var(--temu-orange);
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 6px;
  }
  .addr-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .back-section {
    margin-top: 20px;
    border: none;
    background: none;
    color: var(--temu-orange);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-size: var(--text-sm);
  }
</style>
