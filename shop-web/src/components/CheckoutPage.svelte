<script>
  import { onMount, onDestroy } from "svelte";
  import ProductCard from "./ProductCard.svelte";
  import TemuIcon from "./TemuIcon.svelte";
  import MomoNetworkIcon from "./MomoNetworkIcon.svelte";
  import { cartItems, removeSelectedLines, addToCart } from "../lib/stores/cart.js";
  import { formatUgx, priceParts, coverUrl } from "../lib/catalog.js";
  import { newOrderId, startPesapalCheckout } from "../lib/payment.js";
  import { saveOrder, submitWebOrder, submitCodOrder } from "../lib/orders.js";
  import { emailNewOrder } from "../lib/orderEmail.js";
  import { getAuth } from "firebase/auth";
  import { app } from "../lib/firebase.js";
  import { BRAND } from "../lib/brand.js";
  import { deductStockForWebOrder } from "../lib/stockDeduct.js";
  import {
    readProfile,
    defaultAddress,
    saveProfile,
    readAddresses,
    parseAddressFields,
    upsertAddress,
    setDefaultAddress
  } from "../lib/accountStore.js";
  import { detectMobileNetwork, networkLabel } from "../lib/momoNetwork.js";
  import { fetchCurrentPlace } from "../lib/deliveryLocation.js";
  import { walletBalanceStore, debitWallet } from "../lib/wallet.js";
  import { processWalletTopUp } from "../lib/walletTopUp.js";
  import { deliveryEstimateText } from "../lib/delivery.js";
  import MoMoPinModal from "./MoMoPinModal.svelte";

  export let onBack = () => {};
  export let onSuccess = () => {};
  export let onGoShop = () => {};
  export let onOpenProduct = () => {};
  export let onOpenWallet = () => {};
  export let products = [];

  const MORE_ROWS = 8;
  const PIN_MODAL_MIN_MS = 2800;
  let viewportW = 390;

  function syncWidth() {
    viewportW = window.innerWidth;
  }

  let step = 1;
  let phone = "";
  let email = "";
  let customerEmailed = false;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let name = "";
  let areaLine = "";
  let cityLine = "";
  let landmark = "";
  let address = "";
  let locationCoords = null;
  let locating = false;
  let locationError = "";
  let paying = false;
  let showPinModal = false;
  let payMessage = "";
  let orderId = newOrderId();
  /** Online payment (Pesapal) needs the hosted PHP endpoint; until then only cash on delivery. */
  const ONLINE_PAYMENTS = import.meta.env.VITE_ONLINE_PAYMENTS === "true";
  /** Online methods all go through the Pesapal page; they show as "Coming soon" until enabled. */
  const PAY_METHODS = [
    { id: "cod", title: "Cash on delivery", sub: "Pay cash or Mobile Money when your order arrives", online: false },
    { id: "mtn", title: "MTN Mobile Money", sub: "Pay now with MTN MoMo", online: true },
    { id: "airtel", title: "Airtel Money", sub: "Pay now with Airtel Money", online: true },
    { id: "card", title: "Visa / Mastercard", sub: "Pay now by debit or credit card", online: true }
  ];
  let payMethod = "cod"; // "cod" | "mtn" | "airtel" | "card"
  let orderNote = "";
  // The wallet balance lives only in the shopper's browser, so it must not pay for orders.
  let useWallet = false;
  $: payChannel = payMethod === "card" ? "card" : "momo";
  let topUpAmount = 1000;
  let topUpBusy = false;
  let topUpPinOpen = false;
  let showCheckoutPreview = false;
  let savedAddresses = [];
  let selectedAddressId = "";
  let saveAddressForLater = true;
  let addressLabel = "Home";

  function refreshSavedAddresses() {
    savedAddresses = readAddresses();
  }

  function applySavedAddress(addr) {
    if (!addr) return;
    selectedAddressId = addr.id;
    const fields = parseAddressFields(addr);
    areaLine = fields.area;
    cityLine = fields.city;
    landmark = fields.landmark;
    addressLabel = addr.label || fields.area || "Home";
    setDefaultAddress(addr.id);
    refreshSavedAddresses();
    payMessage = "";
  }

  function onAddressFieldInput() {
    selectedAddressId = "";
  }

  function persistCurrentAddress() {
    if (!saveAddressForLater) return;
    if (!areaLine.trim() || !cityLine.trim()) return;
    const list = upsertAddress({
      label: addressLabel || areaLine.trim() || "Home",
      area: areaLine.trim(),
      city: cityLine.trim(),
      landmark: landmark.trim(),
      makeDefault: true
    });
    savedAddresses = list;
    const match = list.find(
      (a) =>
        a.area?.trim().toLowerCase() === areaLine.trim().toLowerCase() &&
        a.city?.trim().toLowerCase() === cityLine.trim().toLowerCase()
    );
    if (match) selectedAddressId = match.id;
  }

  onMount(() => {
    syncWidth();
    window.addEventListener("resize", syncWidth);
    refreshSavedAddresses();
    const p = readProfile();
    if (p.name) name = p.name;
    if (p.phone) phone = p.phone;
    if (p.email) email = p.email;
    else {
      // Signed-in shoppers: start from their account email.
      try {
        const u = getAuth(app).currentUser;
        if (u?.email) email = u.email;
      } catch {
        /* not signed in */
      }
    }
    const addr = defaultAddress();
    if (addr) applySavedAddress(addr);
    if (!cityLine) cityLine = "";
  });

  onDestroy(() => window.removeEventListener("resize", syncWidth));

  $: items = $cartItems.filter((x) => x.selected);
  $: total = items.reduce((s, l) => s + priceParts(l.product).current * l.qty, 0);
  $: gridCols =
    viewportW >= 900 ? 5 : viewportW >= 520 ? 3 : 2;
  $: moreLimit = MORE_ROWS * gridCols;
  $: cartIds = new Set(items.map((l) => l.productId));
  $: moreProducts = products.filter((p) => !cartIds.has(p.id)).slice(0, moreLimit);
  $: momoNetwork = detectMobileNetwork(phone);
  $: momoLabel = networkLabel(momoNetwork);
  $: walletBalance = $walletBalanceStore;
  $: cod = payMethod === "cod";
  $: walletApplied = useWallet && !cod ? Math.min(walletBalance, total) : 0;
  $: amountDue = Math.max(0, total - walletApplied);
  $: walletCoversAll = amountDue === 0 && walletApplied > 0;

  function composeAddress() {
    const parts = [areaLine.trim(), cityLine.trim(), landmark.trim()].filter(Boolean);
    return parts.join(", ");
  }

  function goToPayment() {
    address = composeAddress();
    if (!name.trim()) {
      payMessage = "Enter your full name.";
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      payMessage = "Enter your phone number so we can confirm your order.";
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      payMessage = "Enter your email address: we send your order confirmation and updates there.";
      return;
    }
    if (!areaLine.trim() || !cityLine.trim()) {
      payMessage = "Enter your area and city (e.g. Kabowa, Kampala).";
      return;
    }
    persistCurrentAddress();
    payMessage = "";
    step = 2;
  }

  async function useMyLocation() {
    locationError = "";
    locating = true;
    try {
      const place = await fetchCurrentPlace();
      locationCoords = { lat: place.lat, lng: place.lng };
      if (place.area && !areaLine.trim()) areaLine = place.area;
      if (place.city && !cityLine.trim()) cityLine = place.city;
      if (!landmark.trim()) landmark = `GPS: ${place.label.split(",").slice(0, 2).join(",")}`;
    } catch (e) {
      locationError =
        e?.message === "User denied Geolocation"
          ? "Location permission denied. Type your address manually."
          : e?.message || "Could not get location.";
    } finally {
      locating = false;
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function quickTopUp() {
    payMessage = "";
    if (payChannel === "card") {
      payMessage = "Card top-up is coming soon. Use MTN or Airtel Money.";
      return;
    }
    topUpBusy = true;
    topUpPinOpen = true;
    try {
      const method = momoNetwork || "mtn";
      const res = await processWalletTopUp({
        amount: topUpAmount,
        phone,
        method
      });
      if (res.ok) {
        payMessage = res.message;
      } else {
        payMessage = res.message;
      }
    } catch (e) {
      payMessage = e.message || "Top-up failed.";
    } finally {
      topUpPinOpen = false;
      topUpBusy = false;
    }
  }

  function validateBeforePay() {
    address = composeAddress();
    if (items.length === 0) {
      payMessage = "Select at least one item in your cart.";
      return false;
    }
    if (cod || amountDue > 0) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9) {
        payMessage = cod
          ? "Enter your phone number so we can confirm your order."
          : "Enter the mobile number to use for this payment.";
        return false;
      }
    }
    return true;
  }

  function openCheckoutPreview() {
    payMessage = "";
    if (!validateBeforePay()) return;
    showCheckoutPreview = true;
  }

  function closeCheckoutPreview() {
    if (!paying) showCheckoutPreview = false;
  }

  async function executePay() {
    if (!validateBeforePay()) {
      showCheckoutPreview = false;
      return;
    }
    showCheckoutPreview = false;
    paying = true;

    try {
      if (cod) {
        const payload = {
          orderId,
          total,
          walletApplied: 0,
          amountPaid: 0,
          amountDue: total,
          paymentMethod: "cod",
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          address: address.trim(),
          note: orderNote.trim(),
          location: locationCoords,
          items: items.map((l) => ({
            id: l.productId,
            name: l.product.name,
            category: l.product.category || "",
            qty: l.qty,
            price: priceParts(l.product).current,
            delivery: deliveryEstimateText(l.product),
            imageUrl: coverUrl(l.product) || "",
            size: l.size,
            color: l.color
          })),
          status: "cash_on_delivery",
          createdAt: Date.now()
        };
        // Admin (Firestore) and email are independent: either one is enough for staff to see it.
        const [saved, emailed] = await Promise.all([submitCodOrder(payload), emailNewOrder(payload)]);
        if (!saved && !emailed.shop) {
          throw new Error(
            "We could not send your order. Check your internet and try again, or call / WhatsApp us."
          );
        }
        const stored = { ...payload, sentToAdmin: saved };
        saveOrder(stored);
        saveProfile({ name: payload.name, phone: payload.phone, email: payload.email });
        persistCurrentAddress();
        removeSelectedLines();
        customerEmailed = emailed.customer;
        onSuccess(stored);
        payMessage = "";
        step = 3;
        return;
      }

      if (amountDue > 0) {
        const payload = {
          orderId,
          total,
          walletApplied,
          amountPaid: walletApplied,
          amountDue,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          items: items.map((l) => ({
            id: l.productId,
            name: l.product.name,
            qty: l.qty,
            price: priceParts(l.product).current,
            delivery: deliveryEstimateText(l.product),
            imageUrl: coverUrl(l.product) || "",
            size: l.size,
            color: l.color
          })),
          status: "awaiting_payment",
          createdAt: Date.now()
        };
        saveOrder(payload);
        await submitWebOrder(payload);
        const url = await startPesapalCheckout(payload);
        window.location.assign(url);
        return;
      }

      let momoResult = { ok: true, pending: false, message: "" };

      const momoConfirmed = amountDue <= 0 || (momoResult.ok && !momoResult.pending);
      const paid = walletCoversAll || momoConfirmed;

      if (paid && walletApplied > 0) {
        debitWallet(walletApplied, { orderId, note: `Order ${orderId}` });
      }

      const amountPaidNow = paid ? walletApplied + amountDue : walletApplied;
      const remainingDue = paid ? 0 : Math.max(0, total - amountPaidNow);

      const payload = {
        orderId,
        total,
        walletApplied: walletApplied,
        amountPaid: amountPaidNow,
        amountDue: remainingDue,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        items: items.map((l) => ({
          id: l.productId,
          name: l.product.name,
          qty: l.qty,
          price: priceParts(l.product).current,
          delivery: deliveryEstimateText(l.product),
          imageUrl: coverUrl(l.product) || "",
          size: l.size,
          color: l.color
        })),
        status: paid ? "paid" : "awaiting_payment",
        createdAt: Date.now(),
        ...(paid ? { paidAt: Date.now() } : {})
      };

      if (paid) {
        await deductStockForWebOrder(
          orderId,
          payload.items.map((i) => ({ id: i.id, qty: i.qty }))
        );
        saveProfile({ name: payload.name, phone: payload.phone });
        persistCurrentAddress();
        removeSelectedLines();
        showPinModal = false;
        onSuccess(payload);
        payMessage = "";
        step = 3;
      } else {
        showPinModal = false;
        saveOrder(payload);
        removeSelectedLines();
        payMessage =
          momoResult.message ||
          "Payment was not completed. Find this order under Your orders and tap Pay now.";
        saveProfile({ name: payload.name, phone: payload.phone });
        persistCurrentAddress();
        onSuccess(payload);
        step = 3;
      }
    } catch (e) {
      showPinModal = false;
      payMessage = e.message || "Payment error";
    } finally {
      paying = false;
    }
  }
</script>

<nav class="crumbs">
  <button type="button" on:click={onBack}>Home</button> › <button type="button" on:click={onBack}>Cart</button> ›
  Checkout
</nav>

<div class="layout">
  <section class="main">
    <h1>Checkout</h1>
    <ol class="steps">
      <li class:active={step >= 1}>Delivery</li>
      <li class:active={step >= 2}>Payment</li>
      <li class:active={step >= 3}>Confirm</li>
    </ol>

    {#if step === 1}
      <label>
        Full name
        <input bind:value={name} placeholder="e.g. Ssempijja Dickson" autocomplete="name" />
      </label>
      <label>
        Phone number
        <input bind:value={phone} type="tel" placeholder="e.g. 0772 123456" autocomplete="tel" />
      </label>
      <p class="hint phone-hint">We call this number to confirm your order and delivery time.</p>
      <label>
        Email address
        <input bind:value={email} type="email" placeholder="e.g. you@gmail.com" autocomplete="email" inputmode="email" />
      </label>
      <p class="hint phone-hint">Your order confirmation and delivery updates are sent here.</p>

      {#if savedAddresses.length > 0}
        <p class="field-label">Saved addresses — tap to use</p>
        <div class="saved-addr-grid">
          {#each savedAddresses as addr (addr.id)}
            <button
              type="button"
              class="saved-addr"
              class:selected={selectedAddressId === addr.id}
              on:click={() => applySavedAddress(addr)}
            >
              <span class="saved-addr-label">{addr.label}{addr.isDefault ? " · Default" : ""}</span>
              <span class="saved-addr-line">{addr.line}</span>
            </button>
          {/each}
        </div>
      {/if}

      <p class="field-label">{savedAddresses.length ? "Or enter / edit delivery" : "Delivery address"}</p>
      <div class="addr-grid">
        <label>
          Area / village
          <input
            bind:value={areaLine}
            placeholder="Kabowa"
            on:input={onAddressFieldInput}
          />
        </label>
        <label>
          City / district
          <input
            bind:value={cityLine}
            placeholder="Kampala"
            on:input={onAddressFieldInput}
          />
        </label>
      </div>
      <label>
        Landmark (optional)
        <input
          bind:value={landmark}
          placeholder="Near church, shop, or road name"
          on:input={onAddressFieldInput}
        />
      </label>
      <label class="save-addr-row">
        <input type="checkbox" bind:checked={saveAddressForLater} />
        <span>Save this address for future orders</span>
      </label>
      {#if saveAddressForLater}
        <label class="addr-label-field">
          Address label (optional)
          <input bind:value={addressLabel} placeholder="Home, Office, Shop…" />
        </label>
      {/if}
      <div class="loc-row">
        <button type="button" class="loc-btn" disabled={locating} on:click={useMyLocation}>
          {#if locating}
            <span class="mini-spin" aria-hidden="true" />
            Locating…
          {:else}
            <TemuIcon name="globe" size={18} color="#1673c4" />
            Use my live location
          {/if}
        </button>
        {#if locationCoords}
          <a
            class="map-link"
            href="https://www.google.com/maps?q={locationCoords.lat},{locationCoords.lng}"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on map
          </a>
        {/if}
      </div>
      {#if locationError}
        <p class="msg">{locationError}</p>
      {/if}
      {#if payMessage && step === 1}
        <p class="msg">{payMessage}</p>
      {/if}
      <div class="mobile-order-summary" aria-label="Order summary">
        <h2>Order summary</h2>
        {#each items as line}
          {@const prices = priceParts(line.product)}
          <div class="line">
            <img src={coverUrl(line.product) || ""} alt="" />
            <div>
              <p>{line.product.name}</p>
              <span>× {line.qty}</span>
            </div>
            <strong>{formatUgx(prices.current * line.qty)}</strong>
          </div>
        {/each}
        <div class="total-row">
          <span>Total</span>
          <strong>{formatUgx(total)}</strong>
        </div>
      </div>
      <button type="button" class="next" on:click={goToPayment}>Continue to payment</button>
    {:else if step === 2}
      <div class="deliver-card">
        <p class="deliver-title">Deliver to</p>
        <p class="deliver-line"><strong>{name}</strong></p>
        <p class="deliver-line">{composeAddress()}</p>
        {#if savedAddresses.length > 1}
          <p class="field-label compact">Switch saved address</p>
          <div class="saved-addr-grid compact">
            {#each savedAddresses as addr (addr.id)}
              <button
                type="button"
                class="saved-addr"
                class:selected={selectedAddressId === addr.id}
                on:click={() => applySavedAddress(addr)}
              >
                <span class="saved-addr-label">{addr.label}</span>
                <span class="saved-addr-line">{addr.line}</span>
              </button>
            {/each}
          </div>
        {/if}
        <button type="button" class="edit-addr" on:click={() => (step = 1)}>Edit address</button>
      </div>
      <p class="sum">Order total: <strong>{formatUgx(total)}</strong></p>

      <p class="field-label">How would you like to pay?</p>
      <div class="pay-methods" role="radiogroup" aria-label="Payment method">
        {#each PAY_METHODS as m (m.id)}
          {@const off = m.online && !ONLINE_PAYMENTS}
          <button
            type="button"
            role="radio"
            aria-checked={payMethod === m.id}
            aria-disabled={off}
            class="pay-method"
            class:sel={payMethod === m.id}
            class:off
            on:click={() => {
              if (off) {
                payMessage = `${m.title} is coming soon. Choose Cash on delivery for now.`;
                return;
              }
              payMethod = m.id;
              payMessage = "";
            }}
          >
            <span class="pm-logo">
              {#if m.id === "mtn" || m.id === "airtel"}
                <MomoNetworkIcon network={m.id} size={40} />
              {:else if m.id === "card"}
                <span class="card-logos"><i class="fa fa-cc-visa" aria-hidden="true"></i><i class="fa fa-cc-mastercard" aria-hidden="true"></i></span>
              {:else}
                <i class="fa fa-money" aria-hidden="true"></i>
              {/if}
            </span>
            <span class="pm-text">
              <strong>{m.title}</strong>
              <small>{m.sub}</small>
            </span>
            {#if off}
              <span class="soon">Coming soon</span>
            {:else}
              <span class="pm-radio" aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>

      {#if cod}
        <div class="cod-box">
          <p>
            <i class="fa fa-phone" aria-hidden="true"></i>
            <span>We'll call <strong>{phone || "you"}</strong> to confirm the order and delivery time.</span>
          </p>
          <p>
            <i class="fa fa-truck" aria-hidden="true"></i>
            <span>Same-day delivery in Kampala · upcountry 1–3 days. Check your item, then pay the rider in cash or by Mobile Money.</span>
          </p>
        </div>
        <label>
          Note for us (optional)
          <textarea bind:value={orderNote} rows="2" maxlength="500" placeholder="Best time to deliver, colour preference, swap / top-up details…"></textarea>
        </label>
      {:else if payChannel === "momo"}
        <label class="phone-label">
          {payMethod === "mtn" ? "MTN" : "Airtel"} number to pay from
          <div class="phone-wrap">
            <input bind:value={phone} type="tel" placeholder={payMethod === "mtn" ? "e.g. 0772 123456" : "e.g. 0752 123456"} />
            <MomoNetworkIcon network={payMethod} size={32} />
          </div>
        </label>
        {#if momoNetwork && momoNetwork !== payMethod}
          <p class="msg">This looks like a{momoNetwork === "airtel" ? "n Airtel" : "n MTN"} number. Check the number or choose {momoLabel}.</p>
        {/if}
        <p class="hint">You'll approve <strong>{formatUgx(total)}</strong> on your phone through Pesapal's secure page.</p>
      {:else}
        <p class="hint">
          <i class="fa fa-lock" aria-hidden="true"></i>
          You'll enter your card details on Pesapal's secure page. Bagz never sees or stores your card number.
        </p>
      {/if}

      {#if payMessage}
        <p class="msg">{payMessage}</p>
      {/if}
      <button type="button" class="pay" disabled={paying} on:click={openCheckoutPreview}>
        <TemuIcon name="wallet" size={20} color="#fff" strokeWidth={2} />
        {paying ? "Sending…" : cod ? "Place order" : `Pay ${formatUgx(total)}`}
      </button>
      <button type="button" class="back-step" on:click={() => (step = 1)}>Back</button>
    {:else}
      <div class="done">
        <h2>Order received</h2>
        <p>Reference: <strong>{orderId}</strong></p>
        {#if cod}
          <p>Thank you, {name.split(" ")[0]}! We'll call <strong>{phone}</strong> shortly to confirm, then deliver to {composeAddress()}.</p>
          <p>Pay <strong>{formatUgx(total)}</strong> in cash or Mobile Money when it arrives.</p>
          {#if customerEmailed}
            <p>We've emailed your order confirmation to <strong>{email}</strong>; updates will come there too.</p>
          {/if}
          <p class="hint">
            Questions? Call or WhatsApp
            <a href="https://wa.me/{BRAND.contact.whatsappE164}?text={encodeURIComponent(`Hello Bagz, about my order ${orderId}`)}" target="_blank" rel="noopener noreferrer">{BRAND.contact.phoneDisplay}</a>.
          </p>
        {:else if payMessage}
          <p>{payMessage}</p>
        {:else}
          <p>Thank you — we will deliver to {composeAddress()}.</p>
        {/if}
      </div>
    {/if}
  </section>

  <aside class="side">
    <h2>Order summary</h2>
    {#each items as line}
      {@const prices = priceParts(line.product)}
      <div class="line">
        <img src={coverUrl(line.product) || ""} alt="" />
        <div>
          <p>{line.product.name}</p>
          <span>× {line.qty}</span>
        </div>
        <strong>{formatUgx(prices.current * line.qty)}</strong>
      </div>
    {/each}
    {#if walletApplied > 0}
      <div class="total-row sub">
        <span>Wallet</span>
        <strong>− {formatUgx(walletApplied)}</strong>
      </div>
    {/if}
    <div class="total-row">
      <span>{cod ? "Pay on delivery" : amountDue > 0 ? "Due now" : "Total"}</span>
      <strong>{formatUgx(amountDue > 0 ? amountDue : total)}</strong>
    </div>
    <p class="lock"><i class="fa fa-lock" aria-hidden="true"></i> Secure checkout — Bagz Apple Services</p>
  </aside>
</div>

{#if moreProducts.length}
  <section class="more-products" aria-labelledby="more-products-heading">
    <div class="more-head">
      <h2 id="more-products-heading">More products</h2>
      <button type="button" class="proceed-shop" on:click={onGoShop}>Proceed to shopping</button>
    </div>
    <div class="more-grid">
      {#each moreProducts as item, i (item.id)}
        <ProductCard
          product={item}
          index={i}
          onOpen={onOpenProduct}
          onAddToCart={(p) => addToCart(p, 1)}
        />
      {/each}
    </div>
    <button type="button" class="proceed-shop wide" on:click={onGoShop}>Proceed to shopping</button>
  </section>
{/if}

{#if showCheckoutPreview}
  <div class="pay-backdrop" role="presentation" on:click={closeCheckoutPreview} on:keydown={() => {}} />
  <div class="pay-dialog" role="dialog" aria-labelledby="checkout-preview-title">
    <h2 id="checkout-preview-title">Order preview</h2>
    <p class="pay-meta muted">Order <strong>#{orderId}</strong> · {new Date().toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" })}</p>

    <dl class="pay-details">
      <div><dt>Customer</dt><dd>{name}</dd></div>
      <div><dt>Deliver to</dt><dd>{composeAddress()}</dd></div>
      {#if cod}
        <div><dt>Phone</dt><dd>{phone}</dd></div>
        <div><dt>Payment</dt><dd>Cash on delivery</dd></div>
      {:else}
        <div><dt>Payment</dt><dd>{PAY_METHODS.find((m) => m.id === payMethod)?.title}</dd></div>
        {#if payChannel === "momo"}<div><dt>Pay from</dt><dd>{phone}</dd></div>{/if}
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
        {#each items as line}
          {@const prices = priceParts(line.product)}
          {@const img = coverUrl(line.product)}
          <tr>
            <td class="product-cell">
              <div class="preview-line">
                {#if img}
                  <img class="preview-thumb" src={img} alt="" />
                {:else}
                  <span class="preview-thumb placeholder" aria-hidden="true" />
                {/if}
                <span class="preview-name">{line.product.name}</span>
              </div>
            </td>
            <td>{line.qty}</td>
            <td>{deliveryEstimateText(line.product)}</td>
            <td>{formatUgx(prices.current * line.qty)}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if walletApplied > 0}
      <p class="preview-wallet">Wallet applied: − {formatUgx(walletApplied)}</p>
    {/if}
    <div class="pay-total-row">
      <span>{cod ? "Pay on delivery" : walletCoversAll ? "Total" : "Due now"}</span>
      <strong>{formatUgx(walletCoversAll || cod ? total : amountDue)}</strong>
    </div>

    <div class="pay-actions">
      <button type="button" class="ghost-btn" disabled={paying} on:click={closeCheckoutPreview}>Back</button>
      <button type="button" class="pay confirm-pay" disabled={paying} on:click={executePay}>
        {paying ? "Sending…" : cod ? "Place order" : `Pay ${formatUgx(total)}`}
      </button>
    </div>
  </div>
{/if}

<MoMoPinModal
  open={showPinModal}
  {phone}
  amount={amountDue}
  network={momoNetwork}
  purpose="payment"
/>
<MoMoPinModal
  open={topUpPinOpen}
  {phone}
  amount={topUpAmount}
  network={momoNetwork}
  purpose="topup"
/>

<style>
  .crumbs {
    font-size: var(--text-sm);
    margin-bottom: 16px;
    color: var(--text-secondary);
  }
  .crumbs button {
    border: none;
    background: none;
    cursor: pointer;
    font: inherit;
    color: var(--text-primary);
    text-decoration: underline;
  }
  .layout {
    display: grid;
    gap: 20px;
  }
  .mobile-order-summary {
    display: block;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 14px;
    margin: 16px 0 12px;
  }
  .mobile-order-summary h2 {
    margin: 0 0 12px;
    font-size: var(--text-md);
  }
  @media (max-width: 899px) {
    .side {
      display: none;
    }
  }
  @media (min-width: 900px) {
    .layout {
      grid-template-columns: 1fr 300px;
    }
    .mobile-order-summary {
      display: none;
    }
  }
  .main,
  .side {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
  }
  h1 {
    margin: 0 0 12px;
    font-size: var(--text-lg);
  }
  .steps {
    display: flex;
    gap: 16px;
    list-style: none;
    padding: 0;
    margin: 0 0 20px;
    font-size: var(--text-xs);
    color: #999;
  }
  .steps li.active {
    color: var(--temu-orange);
    font-weight: 700;
  }
  .field-label {
    font-size: var(--text-sm);
    font-weight: 600;
    margin: 0 0 8px;
  }
  .phone-hint {
    margin: -8px 0 14px;
  }
  .pay-methods {
    display: grid;
    gap: 10px;
    margin-bottom: 14px;
  }
  .pay-method {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid #d6dde4;
    border-radius: 10px;
    background: #fff;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .pm-logo {
    width: 48px;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
  }
  .pm-logo > .fa {
    font-size: 26px;
    color: #13344f;
  }
  .card-logos {
    display: flex;
    gap: 3px;
    font-size: 22px;
  }
  .card-logos .fa-cc-visa {
    color: #1a1f71;
  }
  .card-logos .fa-cc-mastercard {
    color: #eb001b;
  }
  .pm-text {
    display: grid;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .pay-method small {
    color: #5b6670;
    font-size: var(--text-xs);
  }
  .pm-radio {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #b9c4ce;
    flex-shrink: 0;
  }
  .pay-method.sel {
    border-color: #1673c4;
    background: #eef6fd;
    box-shadow: 0 0 0 1px #1673c4 inset;
  }
  .pay-method.sel .pm-radio {
    border-color: #1673c4;
    background: radial-gradient(circle, #1673c4 0 45%, #fff 50%);
  }
  .pay-method.off {
    cursor: default;
    background: #fafbfc;
  }
  .pay-method.off .pm-logo,
  .pay-method.off .pm-text {
    opacity: 0.6;
  }
  .soon {
    font-size: 11px;
    font-weight: 700;
    color: #8a5a00;
    background: #fff4d6;
    border-radius: 999px;
    padding: 3px 8px;
    white-space: nowrap;
  }
  .cod-box {
    background: #f4f8fb;
    border: 1px solid #dbe6ef;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 14px;
    font-size: var(--text-sm);
  }
  .cod-box p {
    margin: 6px 0;
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .cod-box .fa {
    color: #1673c4;
    width: 16px;
    text-align: center;
  }
  .muted {
    color: #888;
    font-size: var(--text-xs);
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
    margin: 0 0 6px;
    font-size: var(--text-md);
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
    margin-bottom: 10px;
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
  .preview-wallet {
    margin: 0 0 8px;
    font-size: var(--text-sm);
    color: #169d4a;
  }
  .pay-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    font-size: var(--text-sm);
  }
  .pay-total-row strong {
    font-size: var(--text-md);
  }
  .pay-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ghost-btn {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 999px;
    padding: 10px 18px;
    font-weight: 700;
    cursor: pointer;
  }
  .confirm-pay {
    width: auto;
    margin-top: 0;
  }
  .field-label.compact {
    margin-top: 12px;
    margin-bottom: 6px;
    font-size: 12px;
  }
  .saved-addr-grid {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }
  .saved-addr-grid.compact {
    margin-bottom: 10px;
  }
  .saved-addr {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    border-radius: 10px;
    border: 2px solid #e8e8e8;
    background: #fafafa;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .saved-addr:hover {
    border-color: #9fd6f0;
    background: #eef7fc;
  }
  .saved-addr.selected {
    border-color: var(--temu-orange);
    background: #eef7fc;
    box-shadow: 0 0 0 1px rgba(43, 168, 224, 0.15);
  }
  .saved-addr-label {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .saved-addr-line {
    font-size: 12px;
    color: #666;
    line-height: 1.35;
  }
  .save-addr-row {
    display: flex !important;
    align-items: center;
    gap: 10px;
    margin: 4px 0 10px;
    font-size: 13px;
  }
  .save-addr-row input {
    width: auto;
    margin: 0;
  }
  .addr-label-field {
    margin-top: -4px;
  }
  label {
    display: block;
    font-size: var(--text-sm);
    margin-bottom: 14px;
  }
  input,
  textarea {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font: inherit;
    box-sizing: border-box;
  }
  .addr-grid {
    display: grid;
    gap: 0 12px;
  }
  @media (min-width: 520px) {
    .addr-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .loc-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .loc-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #cbe8f7;
    background: #eef7fc;
    color: #13344f;
    font-weight: 600;
    font-size: var(--text-sm);
    padding: 10px 14px;
    border-radius: 999px;
    cursor: pointer;
  }
  .loc-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .mini-spin {
    width: 16px;
    height: 16px;
    border: 2px solid #cbe8f7;
    border-top-color: #1673c4;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .map-link {
    font-size: var(--text-xs);
    color: #13344f;
    font-weight: 600;
  }
  .deliver-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .deliver-title {
    margin: 0 0 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #888;
  }
  .deliver-line {
    margin: 0 0 4px;
    font-size: var(--text-sm);
  }
  .edit-addr {
    margin-top: 8px;
    border: none;
    background: none;
    color: var(--temu-orange);
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .phone-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .phone-wrap input {
    margin-top: 0;
    flex: 1;
  }
  .network-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-xs);
    color: var(--trust-green);
    margin: -6px 0 12px;
  }
  .next,
  .pay {
    width: 100%;
    border: none;
    background: var(--temu-orange);
    color: #fff;
    font-weight: 700;
    padding: 14px;
    border-radius: 999px;
    cursor: pointer;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .pay:disabled {
    opacity: 0.7;
  }
  .back-step {
    margin-top: 10px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: var(--text-sm);
    color: #666;
  }
  .sum {
    font-size: var(--text-base);
    margin-bottom: 16px;
  }
  .hint,
  .msg {
    font-size: var(--text-xs);
    color: #666;
  }
  .msg {
    color: #1d4f7a;
  }
  .side h2 {
    margin: 0 0 12px;
    font-size: var(--text-md);
  }
  .line {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 8px;
    font-size: 11px;
    margin-bottom: 10px;
    align-items: start;
  }
  .line img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
    background: #f0f0f0;
  }
  .line p {
    margin: 0;
  }
  .wallet-box {
    background: #eef7fc;
    border: 1px solid #cbe8f7;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }
  .wallet-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    cursor: pointer;
    font-size: var(--text-sm);
  }
  .wallet-row input {
    width: auto;
    margin: 0;
  }
  .wallet-bal {
    display: block;
    font-size: 11px;
    color: #666;
    font-weight: 500;
  }
  .wallet-applied {
    margin: 8px 0 0;
    font-size: var(--text-xs);
    color: #169d4a;
    font-weight: 700;
  }
  .topup-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
  }
  .topup-inline input {
    width: 120px;
    margin: 0;
    padding: 8px 10px;
  }
  .ghost.small {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .link-btn {
    border: none;
    background: none;
    color: #13344f;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }
  .pay-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
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
  .card-fields label {
    display: block;
    margin-bottom: 10px;
    font-size: var(--text-xs);
    font-weight: 600;
  }
  .card-fields input {
    display: block;
    width: 100%;
    margin-top: 4px;
    box-sizing: border-box;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 16px;
  }
  .card-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid #eee;
    margin-top: 8px;
  }
  .total-row.sub {
    border-top: none;
    padding-top: 6px;
    margin-top: 4px;
    font-size: var(--text-sm);
    color: #666;
  }
  .lock {
    font-size: 11px;
    color: #666;
    margin-top: 12px;
  }
  .done h2 {
    margin: 0 0 8px;
  }
  .more-products {
    margin-top: 28px;
    padding-bottom: 16px;
  }
  .more-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .more-products h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .more-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  @media (min-width: 520px) {
    .more-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 900px) {
    .more-grid {
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
  }
  @media (min-width: 1280px) {
    .more-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  .proceed-shop {
    border: none;
    background: linear-gradient(180deg, #5bbde9 0%, #1673c4 100%);
    color: #fff;
    font-size: var(--text-sm);
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(22, 115, 196, 0.3);
  }
  .proceed-shop.wide {
    display: block;
    width: 100%;
    max-width: 420px;
    margin: 20px auto 0;
    padding: 14px 24px;
  }
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
    border: 4px solid #cbe8f7;
    border-top-color: #1673c4;
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
