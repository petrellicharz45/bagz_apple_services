<script>
  import { onMount, onDestroy, tick } from "svelte";
  import ProductCard from "./ProductCard.svelte";
  import {
    coverUrl,
    stockPhotoForProduct,
    formatUgx,
    priceParts,
    productShippingSnippet,
    soldLabel,
    stockLabel,
    productStock,
    ratingLabel,
    reviewCount,
    galleryImagesForProduct,
    adminSizes,
    productNeedsSize,
    urgencyLabel
  } from "../lib/catalog.js";
  import { productColorChoices } from "../lib/colorVariants.js";
  import { productAsPhoto } from "../lib/productPhotos.js";
  import { productSortTime } from "../lib/shopBrowse.js";
  import { addToCart } from "../lib/stores/cart.js";
  import { deliveryEstimateText } from "../lib/delivery.js";
  import { productShareLinks } from "../lib/productShare.js";
  import { nativeAppDownloadUrl } from "../lib/appLinks.js";
  import {
    ORDER_PHONE_DISPLAY,
    ORDER_PHONE_TEL
  } from "../lib/shopContact.js";
  import { deliveryFeeSettings } from "../lib/deliveryFees.js";
  import TemuIcon from "./TemuIcon.svelte";
  import PhotoViewer from "./PhotoViewer.svelte";
  import OptionPicker from "./OptionPicker.svelte";
  import {
    loadProductReviews,
    getMyRatingForProduct,
    submitProductReview
  } from "../lib/productReviews.js";

  export let product;
  /** Photo to show first (e.g. the named photo the customer searched for). */
  export let initialPhoto = 0;
  export let products = [];
  export let onBack = () => {};
  export let onOpenProduct = () => {};
  export let onAddToCart = () => {};
  /** When true, scroll to the review form (from Account → Write review). */
  export let focusReviewForm = false;

  const INITIAL_ROWS = 8;
  let viewportW = 390;
  let extraBatches = 0;

  function syncWidth() {
    viewportW = window.innerWidth;
  }

  onMount(() => {
    syncWidth();
    window.addEventListener("resize", syncWidth);
  });

  $: shippingLine = ($deliveryFeeSettings, productShippingSnippet(product));
  $: share = productShareLinks(product);
  $: displayRating = reviewCount(product) > 0 ? ratingLabel(product) : 0;
  onDestroy(() => window.removeEventListener("resize", syncWidth));

  $: gridCols =
    viewportW >= 900 ? 5 : viewportW >= 520 ? 3 : 2;
  $: batchSize = INITIAL_ROWS * gridCols;
  $: showLimit = batchSize * (1 + extraBatches);

  $: rankedRelated = rankRelated(products, product);
  $: visibleRelated = rankedRelated.slice(0, showLimit);
  $: canLoadMore = showLimit < rankedRelated.length;

  function rankRelated(list, current) {
    const cat = current?.category;
    return list
      .filter((p) => p.id !== current?.id)
      .sort((a, b) => {
        const aMatch = a.category === cat ? 0 : 1;
        const bMatch = b.category === cat ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return productSortTime(b) - productSortTime(a);
      });
  }

  function loadMore() {
    extraBatches += 1;
  }

  $: if (product?.id) extraBatches = 0;

  let activeImg = 0;
  let mainImgError = false;
  let size = "";
  let qty = 1;

  $: images = galleryImagesForProduct(product);
  /** Option photos (Temu-style) under the main image on mobile, beside it on desktop. */
  $: showPhotoOptions = images.length > 1;
  /** Admin photo names, aligned with `images` by enrichProduct. */
  $: photoNames = Array.isArray(product?.imageNames) ? product.imageNames : [];
  $: activePhotoName = (photoNames[activeImg] || "").trim();
  $: descriptionText = (product?.description || "").trim();
  let descOpen = false;
  let titleOpen = false;
  let reportOpen = false;
  let reportNote = "";
  let reportMsg = "";
  let reportSending = false;

  async function sendReport() {
    const message = reportNote.trim();
    if (message.length < 5) {
      reportMsg = "Write what is wrong with this product.";
      return;
    }
    reportSending = true;
    reportMsg = "";
    try {
      const res = await fetch(import.meta.env.DEV ? "/api/product-report" : "/api/product-report.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product?.id || "",
          productName: product?.name || "",
          message
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not send.");
      reportNote = "";
      reportOpen = false;
      reportMsg = "Sent. We will review this product.";
    } catch (e) {
      reportMsg = e.message || "Could not send.";
    } finally {
      reportSending = false;
    }
  }
  $: sizes = adminSizes(product);
  $: mustPickSize = productNeedsSize(product);
  /** Legacy admin colours — only used to label the order when a photo has no name. */
  $: colorOptions = productColorChoices(product);
  $: orderColor =
    activePhotoName ||
    colorOptions.find((o) => o.galleryIndex === activeImg)?.label ||
    colorOptions[0]?.label ||
    "Default";

  function showPhoto(i) {
    if (i < 0 || i >= images.length) return;
    activeImg = i;
    mainImgError = false;
  }

  // Swipe the big photo left / right to see the next / previous photo (finger or mouse).
  let swipeStartX = null;
  /** Set after a swipe so the click that follows does not open full screen. */
  let justSwiped = false;
  function onPointerDown(e) {
    swipeStartX = e.clientX;
    justSwiped = false;
  }
  function onPointerUp(e) {
    if (swipeStartX == null) return;
    const dx = e.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(dx) < 40) return;
    justSwiped = true;
    showPhoto(activeImg + (dx < 0 ? 1 : -1));
  }
  function openViewer() {
    if (justSwiped) {
      justSwiped = false;
      return;
    }
    viewerOpen = true;
  }
  $: prices = priceParts(product);
  $: shownPrice =
    prices?.salePending && prices.displayNow != null ? prices.displayNow : prices?.current;
  $: struckPrice =
    prices?.salePending && prices.displayOld != null ? prices.displayOld : prices?.old;
  $: urgency = urgencyLabel(product);
  $: deliveryEst = deliveryEstimateText(product);
  let lastProductId = "";
  let reviewList = [];
  let reviewsLoading = false;
  let myStars = 5;
  let myReviewText = "";
  let reviewSubmitting = false;
  let reviewError = "";
  let reviewSuccess = "";
  let reviewsSectionEl;

  async function refreshReviews() {
    if (!product?.id) return;
    reviewsLoading = true;
    reviewError = "";
    try {
      reviewList = await loadProductReviews(product.id);
      const mine = await getMyRatingForProduct(product.id);
      if (mine) {
        myStars = mine.rating;
        myReviewText = mine.text || "";
      } else {
        myStars = 5;
        myReviewText = "";
      }
    } catch (e) {
      reviewError = e.message || "Could not load reviews.";
    } finally {
      reviewsLoading = false;
    }
  }

  async function scrollToReviewForm() {
    await tick();
    reviewsSectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $: if (product?.id && product.id !== lastProductId) {
    lastProductId = product.id;
    mainImgError = false;
    reviewSuccess = "";
    refreshReviews();
  }

  let lastPhotoKey = "";
  $: if (product?.id && `${product.id}|${initialPhoto}` !== lastPhotoKey) {
    lastPhotoKey = `${product.id}|${initialPhoto}`;
    activeImg = initialPhoto > 0 && initialPhoto < images.length ? initialPhoto : 0;
    mainImgError = false;
  }

  $: if (focusReviewForm && product?.id) {
    scrollToReviewForm();
  }

  async function submitReview() {
    reviewError = "";
    reviewSuccess = "";
    reviewSubmitting = true;
    try {
      await submitProductReview(product, { rating: myStars, text: myReviewText });
      reviewSuccess = "Thank you! Your review is live on this product.";
      await refreshReviews();
    } catch (e) {
      reviewError = e.message || "Could not post review. Try again.";
    } finally {
      reviewSubmitting = false;
    }
  }

  function formatReviewDate(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString("en-UG", { dateStyle: "medium" });
    } catch {
      return "";
    }
  }

  function starsFor(n) {
    const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return "★".repeat(v) + "☆".repeat(5 - v);
  }
  $: mainImg = mainImgError
    ? stockPhotoForProduct(product, 800)
    : images[activeImg] || coverUrl(product) || stockPhotoForProduct(product, 800);

  let sizeWarn = false;

  function add() {
    if (mustPickSize && !sizeChosen) {
      sizeWarn = true;
      return;
    }
    addToCart(productAsPhoto(product, activeImg), qty, {
      size: size || sizes[0] || "",
      color: orderColor
    });
    sizeWarn = false;
  }

  // Change 3: full-screen photos + Temu-style options picker.
  let viewerOpen = false;
  let pickerOpen = false;
  /** True once the customer taps a size themselves (the page pre-selects the first one). */
  let sizeChosen = false;
  let pickerSize = "";
  // Reset only when a different product opens (not on every re-render of the same one).
  let viewerProductId = "";
  $: if ((product?.id || "") !== viewerProductId) {
    viewerProductId = product?.id || "";
    viewerOpen = false;
    pickerOpen = false;
    sizeChosen = false;
  }

  function pickSize(s) {
    size = s;
    sizeChosen = true;
    sizeWarn = false;
  }

  /** Full-screen Add to cart: ask for the size first (Temu) unless there is nothing to pick. */
  function addFromViewer(i) {
    showPhoto(i);
    viewerOpen = false;
    if (mustPickSize && !sizeChosen) {
      pickerSize = "";
      pickerOpen = true;
    } else {
      add();
    }
  }

  function confirmPicker() {
    pickSize(pickerSize || size);
    pickerOpen = false;
    add();
  }
</script>

{#if viewerOpen}
  <PhotoViewer
    {images}
    names={photoNames}
    bind:index={activeImg}
    title={product.name}
    onClose={() => (viewerOpen = false)}
    onAddToCart={addFromViewer}
  />
{/if}

{#if pickerOpen}
  <OptionPicker
    title={product.name}
    {images}
    names={photoNames}
    bind:photoIndex={activeImg}
    {sizes}
    bind:size={pickerSize}
    bind:qty
    price={shownPrice}
    wasPrice={struckPrice}
    discount={prices.discount}
    freeShipping={!!product.freeShipping}
    onClose={() => (pickerOpen = false)}
    onConfirm={confirmPicker}
  />
{/if}

<div class="pdp">
<nav class="crumbs pdp-crumbs">
  <button type="button" on:click={onBack}>Home</button>
  <span>›</span>
  <span>{product.category || "Shop"}</span>
  <span>›</span>
  <span class="dim">Product</span>
</nav>

<div class="layout">
  <div class="gallery pdp-gallery">
    <div
      class="main-img"
      on:pointerdown={onPointerDown}
      on:pointerup={onPointerUp}
      on:pointercancel={() => (swipeStartX = null)}
    >
      <!-- Tap / click the photo to open it full screen. -->
      <button
        type="button"
        class="zoom-btn"
        aria-label="Open photo full screen"
        on:click={openViewer}
      >
        <img
          src={mainImg}
          alt={product.name}
          draggable="false"
          on:error={() => {
            mainImgError = true;
          }}
        />
      </button>
      {#if images.length > 1}
        <span class="photo-counter">{activeImg + 1}/{images.length}</span>
      {/if}
    </div>
  </div>

  <div class="buy">
    <div class="buy-intro pdp-intro">
    <h1 class:clamped={!titleOpen}>{product.name}</h1>
    {#if (product.name || "").length > 80}
      <button type="button" class="read-more" on:click={() => (titleOpen = !titleOpen)}>
        {titleOpen ? "Show less" : "Read more"}
      </button>
    {/if}
    <p class="social">
      {#if soldLabel(product)}{soldLabel(product)} · {/if}<span class="stock-line" class:out={productStock(product) <= 0}>{stockLabel(product)}</span>
    </p>
    <div class="price-block">
      <span class="now">{formatUgx(shownPrice)}</span>
      {#if struckPrice}
        <del class="was" aria-label="Original price">{formatUgx(struckPrice)}</del>
      {/if}
      {#if prices.discount}
        <span class="pill off">{prices.discount}</span>
      {:else if prices.salePending}
        <span class="pill soon">{prices.pendingPercent}% off starts soon</span>
      {/if}
      {#if urgency}
        <span class="pill urgent">{urgency.toUpperCase()}</span>
      {/if}
    </div>

    {#if shippingLine}
      <p class="shipping-snippet">{shippingLine}</p>
    {/if}

    <p class="rating-row">
      <span class="stars" aria-hidden="true">{starsFor(displayRating)}</span>
      <strong>{displayRating} out of 5</strong>
      {#if reviewCount(product) > 0}
        <span>({reviewCount(product)} reviews)</span>
      {:else}
        <span class="muted">(No ratings available)</span>
      {/if}
    </p>
    {#if reviewCount(product) === 0}
      <p class="review-cta">Be the first to review below</p>
    {/if}

    <section class="description-block" aria-labelledby="product-desc-heading">
      <h2 id="product-desc-heading">Product description</h2>
      {#if descriptionText}
        <p class="description-text" class:clamped={!descOpen}>{descriptionText}</p>
        <button type="button" class="read-more" on:click={() => (descOpen = !descOpen)}>
          {descOpen ? "Show less" : "Read more"}
        </button>
      {/if}
      {#if activePhotoName}
        <p class="description-photo-name">{activePhotoName}</p>
      {/if}
      {#if !descriptionText && !activePhotoName}
        <p class="description-empty">No description yet.</p>
      {/if}
    </section>

    {#if sizes.length > 1}
      <div class="picker">
        <p class="label">Size: <strong>{size || ""}</strong></p>
        <div class="sizes">
          {#each sizes as s}
            <button type="button" class:active={size === s} on:click={() => pickSize(s)}>{s}</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="qty-row">
      <label for="qty">Qty</label>
      <select id="qty" bind:value={qty}>
        {#each [1, 2, 3, 4, 5] as n}
          <option value={n}>{n}</option>
        {/each}
      </select>
    </div>

    </div>

    {#if showPhotoOptions}
      <div class="picker pdp-colors">
        <div class="swatches swatches--images" role="tablist" aria-label="Product photos">
          {#each images as src, i}
            <!-- Desktop: hover shows the photo. Mobile: tap. Photos only, no words. -->
            <button
              type="button"
              role="tab"
              class="color-img-chip"
              class:active={i === activeImg}
              aria-selected={i === activeImg}
              aria-label={photoNames[i] || `Photo ${i + 1} of ${images.length}`}
              on:click={() => showPhoto(i)}
              on:mouseenter={() => showPhoto(i)}
              on:focus={() => showPhoto(i)}
            >
              <img
                {src}
                alt=""
                loading={i < 6 ? "eager" : "lazy"}
                decoding="async"
                on:error={(e) => {
                  const fallback = images[0] || coverUrl(product);
                  if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                }}
              />
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="buy-rest pdp-rest">
    <div class="promo-bar">
      <div class="promo-item">
        <span class="promo-icon promo-icon--quality" aria-hidden="true">
          <TemuIcon name="shield" size={17} color="#7c3aed" strokeWidth={2} />
        </span>
        <span class="promo-text">Quality assured</span>
      </div>
      {#if product.freeShipping}
        <div class="promo-item">
          <span class="promo-icon promo-icon--ship" aria-hidden="true">
            <TemuIcon name="truck" size={17} color="#169d4a" strokeWidth={2} />
          </span>
          <span class="promo-text">Free shipping</span>
        </div>
      {/if}
      <div class="promo-item">
        <span class="promo-icon promo-icon--fast" aria-hidden="true">
          <TemuIcon name="bolt" size={17} color="#2563eb" strokeWidth={2} />
        </span>
        <span class="promo-text">Fastest delivery · {deliveryEst}</span>
      </div>
    </div>
    <div class="select-wrap">
      {#if sizeWarn && mustPickSize && !sizeChosen}
        <p class="size-pop"><span class="point" aria-hidden="true">▲</span> Select a size</p>
      {/if}
      <button type="button" class="add-main" on:click={add}>{mustPickSize ? "Select" : "Add to cart"}</button>
    </div>
    <p class="app-note">Checkout on this site with mobile money — app optional for order history.</p>
    </div>
  </div>
</div>

<section class="product-footer pdp-footer" aria-label="Share and promotions">
  <section class="share-block" aria-labelledby="share-heading">
    <h2 id="share-heading">Share this product</h2>
    <div class="share-row">
      <a
        class="share-btn share-btn--wa"
        href={share.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      <a
        class="share-btn share-btn--fb"
        href={share.facebook}
        target="_blank"
        rel="noopener noreferrer"
      >
        Facebook
      </a>
      <a
        class="share-btn share-btn--tw"
        href={share.twitter}
        target="_blank"
        rel="noopener noreferrer"
      >
        Twitter
      </a>
    </div>
  </section>

  <section class="promotions-block" aria-labelledby="promo-heading">
    <h2 id="promo-heading">Promotions</h2>
    <ul class="promo-list">
      <li>
        <a href="/" on:click|preventDefault={() => onBack()}>Uganda&apos;s Best Prices | Shop Now</a>
      </li>
      <li>
        Exclusive Offers |
        <a href={`tel:${ORDER_PHONE_TEL}`}>Call {ORDER_PHONE_DISPLAY} To Order</a>
      </li>
      <li>
        <a href={nativeAppDownloadUrl()} target="_blank" rel="noopener noreferrer">
          Download the app for exclusive offers.
        </a>
      </li>
    </ul>
  </section>

  <section class="report-block" aria-labelledby="report-heading">
    <h2 id="report-heading">Report incorrect product information</h2>
    <button type="button" class="report-btn" on:click={() => (reportOpen = !reportOpen)}>
      {reportOpen ? "Close" : "Report here"}
    </button>
    {#if reportOpen}
      <form class="report-form" on:submit|preventDefault={sendReport}>
        <textarea bind:value={reportNote} rows="3" placeholder="What is wrong with this product?"></textarea>
        <button type="submit" disabled={reportSending}>{reportSending ? "Sending…" : "Send"}</button>
      </form>
    {/if}
    {#if reportMsg}
      <p class="report-msg">{reportMsg}</p>
    {/if}
  </section>
</section>

{#if visibleRelated.length}
  <section class="explore pdp-explore" aria-labelledby="explore-heading">
    <h2 id="explore-heading">Explore your interests</h2>
    <div class="related-grid">
      {#each visibleRelated as item, i (item.id)}
        <ProductCard
          product={item}
          index={i}
          onOpen={onOpenProduct}
          onAddToCart={onAddToCart}
        />
      {/each}
    </div>
    {#if canLoadMore}
      <button type="button" class="see-more" on:click={loadMore}>
        See more
        <TemuIcon name="chevronDown" size={18} color="#fff" strokeWidth={2.25} />
      </button>
    {/if}
  </section>
{/if}

<section class="reviews pdp-reviews" id="product-reviews" bind:this={reviewsSectionEl}>
  <h2>
    {#if reviewCount(product) > 0}
      {reviewCount(product)} review{reviewCount(product) === 1 ? "" : "s"} · {ratingLabel(product)} ★ average
    {:else}
      Customer reviews
    {/if}
  </h2>

  <form class="review-form" on:submit|preventDefault={submitReview}>
    <h3>Write a review</h3>
    <p class="form-hint">Your rating and comment appear on this product for other shoppers.</p>
    <label class="stars-picker">
      <span>Your rating</span>
      <div class="star-btns" role="group" aria-label="Star rating">
        {#each [1, 2, 3, 4, 5] as star}
          <button
            type="button"
            class:selected={myStars >= star}
            aria-label="{star} star{star === 1 ? '' : 's'}"
            on:click={() => (myStars = star)}>★</button
          >
        {/each}
      </div>
    </label>
    <label>
      Your comment (optional)
      <textarea
        bind:value={myReviewText}
        rows="4"
        maxlength="2000"
        placeholder="Quality, fit, delivery, would you recommend it?"
      ></textarea>
    </label>
    {#if reviewError}
      <p class="review-err">{reviewError}</p>
    {/if}
    {#if reviewSuccess}
      <p class="review-ok">{reviewSuccess}</p>
    {/if}
    <button type="submit" class="submit-review" disabled={reviewSubmitting}>
      {reviewSubmitting ? "Posting…" : "Post review"}
    </button>
  </form>

  {#if reviewsLoading}
    <p class="muted-load">Loading reviews…</p>
  {:else if reviewList.length === 0}
    <p class="muted-load">No reviews yet for this item.</p>
  {:else}
    <ul class="review-list">
      {#each reviewList as r (r.id)}
        <li class="review">
          <div class="review-head">
            <strong>{r.displayName}</strong>
            <span class="review-stars" aria-label="{r.rating} out of 5">{starsFor(r.rating)}</span>
            {#if formatReviewDate(r.createdAt)}
              <time>{formatReviewDate(r.createdAt)}</time>
            {/if}
          </div>
          {#if r.text}
            <p>{r.text}</p>
          {:else}
            <p class="muted-load">Rated {r.rating} out of 5 stars.</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
</div>

<style>
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: var(--text-xs);
    margin-bottom: 12px;
    color: var(--text-secondary);
  }
  .crumbs button {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    color: var(--text-primary);
    font-size: inherit;
    text-decoration: underline;
  }
  .dim {
    color: #999;
  }
  .layout {
    display: grid;
    gap: 20px;
    background: #fff;
    padding: 12px;
    border-radius: 8px;
  }
  @media (min-width: 900px) {
    .layout {
      /* Temu-style: the photo column is the larger one. */
      grid-template-columns: 1.15fr 1fr;
      gap: 32px;
      padding: 20px;
    }
  }
  .gallery {
    display: flex;
    align-items: stretch;
    gap: 10px;
    min-height: 0;
  }
  .main-img {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    aspect-ratio: 1;
    max-height: min(720px, 92vw);
  }
  .main-img img {
    width: 100%;
    height: 100%;
    max-height: min(720px, 92vw);
    /* Temu-style: photo fills the box edge to edge (full photo stays in the viewer). */
    object-fit: cover;
    border-radius: 8px;
    background: #fafafa;
  }
  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: zoom-in;
    touch-action: pan-y pinch-zoom;
    user-select: none;
    -webkit-user-select: none;
  }
  /* "1/18" photo counter (mobile only, like Temu). */
  .photo-counter {
    display: none;
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 2px 9px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 12px;
    line-height: 1.6;
    pointer-events: none;
  }
  @media (max-width: 899px) {
    /* Flatten grid so color swatches can sit directly under the main image */
    .layout {
      display: contents;
    }
    .buy {
      display: contents;
    }
    :global(.product-detail-page) .pdp-gallery {
      order: 1;
    }
    :global(.product-detail-page) .pdp-colors {
      order: 2;
    }
    :global(.product-detail-page) .pdp-crumbs {
      order: 4;
    }
    :global(.product-detail-page) .pdp-intro {
      order: 5;
    }
    :global(.product-detail-page) .pdp-rest {
      order: 6;
    }
    :global(.product-detail-page) .pdp-footer {
      order: 7;
    }
    :global(.product-detail-page) .pdp-explore {
      order: 8;
    }
    :global(.product-detail-page) .pdp-reviews {
      order: 9;
    }
    .pdp-colors {
      margin: 0;
      padding: 0 4px 8px;
      background: #fff;
      border-radius: 8px;
    }
    .pdp-intro,
    .pdp-rest {
      background: #fff;
      padding: 0 4px;
      border-radius: 8px;
    }
    .gallery {
      flex-direction: row;
      align-items: flex-start;
      gap: 0;
      width: 100%;
      margin: 0;
    }
    /* Phone: photo runs edge to edge, like Temu. Desktop keeps the padded frame. */
    .main-img {
      flex: 1;
      min-width: 0;
      width: 100%;
      max-width: none;
      max-height: none;
      border: none;
      border-radius: 0;
      aspect-ratio: 1;
    }
    .main-img img {
      width: 100%;
      height: 100%;
      max-height: none;
      border-radius: 0;
      background: #fff;
      object-fit: cover;
    }
    .photo-counter {
      display: block;
    }
  }
  .delivery {
    color: var(--trust-green);
    font-size: var(--text-xs);
    font-weight: 600;
    margin: 0 0 8px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 400;
    line-height: 1.45;
    color: #222;
  }
  h1.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .social {
    margin: 0 0 6px;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .stock-line {
    color: var(--trust-green);
    font-weight: 600;
  }
  .stock-line.out {
    color: #13344f;
  }
  .rating-row {
    margin: 0 0 12px;
    font-size: var(--text-xs);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .stars {
    color: #121212;
    letter-spacing: -1px;
  }
  .price-block {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
  }
  .now {
    font-size: 32px;
    font-weight: 800;
  }
  .was {
    font-size: var(--text-sm);
    color: #999;
    text-decoration: line-through;
    font-weight: 400;
  }
  .shipping-snippet {
    margin: 0 0 8px;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .product-footer {
    margin-top: 8px;
    margin-bottom: 24px;
    padding: 16px 0 0;
    border-top: 1px solid #eee;
    max-width: 960px;
  }
  .share-block,
  .promotions-block {
    margin-top: 16px;
    padding-top: 0;
  }
  .share-block:first-child {
    margin-top: 0;
  }
  .report-block h2,
  .report-btn {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
  }
  .report-block h2 {
    margin: 0 0 4px;
    color: #444;
  }
  .share-block h2,
  .promotions-block h2 {
    margin: 0 0 10px;
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .share-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid #ddd;
    color: #121212;
    background: #fff;
  }
  .share-btn--wa {
    border-color: #25d366;
    color: #128c3a;
  }
  .share-btn--fb {
    border-color: #1877f2;
    color: #1877f2;
  }
  .share-btn--tw {
    border-color: #1d9bf0;
    color: #1d9bf0;
  }
  .promo-list {
    margin: 0 0 10px;
    padding-left: 18px;
    font-size: var(--text-xs);
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .promo-list a {
    color: var(--header-orange, #1673c4);
    font-weight: 600;
    text-decoration: none;
  }
  .promo-list a:hover {
    text-decoration: underline;
  }
  .report-line {
    margin: 0;
    font-size: 11px;
  }
  .report-line a {
    color: #555;
    text-decoration: underline;
  }
  .rating-row .muted {
    color: #888;
  }
  .review-cta {
    margin: -4px 0 12px;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .pill {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .pill.off {
    background: #e8f5ec;
    color: var(--trust-green);
  }
  .pill.urgent {
    background: #eef7fc;
    color: var(--header-orange);
  }
  .pill.soon {
    background: #fef3c7;
    color: #92400e;
  }
  .promo-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 20px;
    background: #fff8f0;
    border: 1px solid #cbe8f7;
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .promo-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  a.promo-link {
    text-decoration: none;
    color: inherit;
  }
  .promo-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .promo-icon--quality {
    background: #ede9fe;
  }
  .promo-icon--ship {
    background: #e8f5ec;
  }
  .promo-icon--fast {
    background: #dbeafe;
  }
  .promo-text {
    font-size: var(--text-sm);
    font-weight: 600;
    color: #1b1512;
    line-height: 1.2;
  }
  .picker {
    margin-bottom: 14px;
  }
  .label {
    margin: 0 0 8px;
    font-size: var(--text-sm);
  }
  .swatches,
  .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatches--images {
    gap: 10px;
  }
  .color-img-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 84px;
    padding: 4px;
    border: 2px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
  }
  .color-img-chip img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
  }
  .color-img-chip:hover {
    border-color: #bbb;
  }
  .color-img-chip.active {
    border-color: #121212;
    box-shadow: 0 0 0 1px #121212;
  }
  .swatches button {
    border: 1px solid #ddd;
    background: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .swatches button.active {
    border: 2px solid #121212;
    font-weight: 600;
  }
  /* Temu-style size pills. */
  .sizes button {
    min-width: 56px;
    border: 1px solid #cfcfcf;
    background: #fff;
    padding: 8px 18px;
    border-radius: 999px;
    font-size: 15px;
    color: #222;
    cursor: pointer;
  }
  .sizes button:hover {
    border-color: #222;
  }
  .sizes button.active {
    border: 2px solid #121212;
    padding: 7px 17px;
    font-weight: 600;
  }
  .qty-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    font-size: var(--text-sm);
  }
  .qty-row select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #ddd;
  }
  .select-wrap {
    position: relative;
  }
  .size-pop {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    transform: translateX(-50%);
    margin: 0;
    padding: 8px 12px;
    background: #fff4e5;
    color: #0c2236;
    border: 1px solid #f59e0b;
    font-size: 13px;
    font-weight: 700;
    border-radius: 8px;
    white-space: nowrap;
    animation: size-pop 0.45s ease;
    z-index: 2;
  }
  .point {
    display: block;
    text-align: center;
    margin-top: 2px;
    font-size: 12px;
    animation: point-up 0.8s ease-in-out infinite;
  }
  @keyframes size-pop {
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes point-up {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .add-main {
    width: 100%;
    border: none;
    background: var(--temu-orange);
    color: #fff;
    font-weight: 700;
    font-size: var(--text-md);
    padding: 14px;
    border-radius: 999px;
    cursor: pointer;
  }
  .app-note {
    margin: 10px 0 0;
    font-size: 11px;
    color: #888;
  }
  .description-block {
    margin: 16px 0 18px;
    padding-top: 16px;
    border-top: 1px solid #eee;
  }
  .description-block h2 {
    margin: 0 0 10px;
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .description-text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--text-secondary);
    white-space: pre-wrap;
  }
  .description-text.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .read-more, .report-btn {
    margin-top: 6px;
    padding: 0;
    border: none;
    background: none;
    color: #13344f;
    font-weight: 700;
    cursor: pointer;
  }
  .report-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  .report-form textarea {
    width: 100%;
    border: 1px solid #e7e5e4;
    border-radius: 8px;
    padding: 8px;
  }
  .report-form button {
    align-self: flex-start;
    background: #13344f;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .report-msg { font-size: 13px; color: #44403c; }
  .description-photo-name {
    margin: 10px 0 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
  }
  .description-empty {
    margin: 0;
    font-size: var(--text-xs);
    color: #999;
    line-height: 1.5;
  }
  .explore {
    margin-top: 20px;
    padding: 0 0 8px;
  }
  .explore h2 {
    margin: 0 0 12px;
    font-size: var(--text-md);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--text-primary);
  }
  .related-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  @media (min-width: 520px) {
    .related-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
  }
  @media (min-width: 900px) {
    .related-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
  }
  @media (min-width: 1280px) {
    .related-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }
  }
  .related-grid :global(.img-wrap img) {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
  }
  .related-grid :global(.title) {
    font-size: 15px;
    line-height: 1.35;
    -webkit-line-clamp: 2;
    min-height: 2.7em;
  }
  .see-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    line-height: 1.2;
    width: 100%;
    max-width: 420px;
    margin: 20px auto 0;
    padding: 12px 24px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(180deg, #5bbde9 0%, #1673c4 100%);
    color: #fff;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(22, 115, 196, 0.35);
  }
  .no-reviews {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
  .review-form {
    margin: 16px 0 20px;
    padding: 16px;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .review-form h3 {
    margin: 0;
    font-size: 16px;
  }
  .form-hint {
    margin: 0;
    font-size: 13px;
    color: #666;
  }
  .stars-picker span {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .star-btns {
    display: flex;
    gap: 4px;
  }
  .star-btns button {
    border: none;
    background: none;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    color: #d1d5db;
    padding: 0 2px;
  }
  .star-btns button.selected {
    color: #f59e0b;
  }
  .review-form textarea {
    width: 100%;
    margin-top: 6px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font: inherit;
    resize: vertical;
    box-sizing: border-box;
  }
  .submit-review {
    align-self: flex-start;
    border: none;
    background: #1673c4;
    color: #fff;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 999px;
    cursor: pointer;
  }
  .submit-review:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  .review-err {
    margin: 0;
    color: #b91c1c;
    font-size: 13px;
  }
  .review-ok {
    margin: 0;
    padding: 10px 12px;
    background: #dcfce7;
    border: 1px solid #86efac;
    border-radius: 8px;
    color: #14532d;
    font-weight: 600;
    font-size: 14px;
  }
  .muted-load {
    font-size: 14px;
    color: #666;
  }
  .review-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .review-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .review-head time {
    font-size: 12px;
    color: #888;
  }
  .review-stars {
    color: #f59e0b;
    font-size: 14px;
    letter-spacing: 1px;
  }
  .reviews {
    margin-top: 20px;
    background: #fff;
    padding: 16px;
    border-radius: 8px;
  }
  .reviews h2 {
    margin: 0 0 8px;
    font-size: var(--text-md);
  }
  .verified {
    font-size: var(--text-xs);
    color: var(--trust-green);
    margin: 0 0 12px;
  }
  .review {
    border-top: 1px solid #eee;
    padding: 12px 0;
    font-size: var(--text-sm);
  }
  .review p {
    margin: 4px 0 0;
    color: var(--text-secondary);
  }
  /* Phone sizes (kept last so they override the desktop rules above). */
  @media (max-width: 899px) {
    h1 {
      font-size: 14px;
    }
    .now {
      font-size: 24px;
    }
    .color-img-chip {
      width: 60px;
    }
    .color-img-chip img {
      width: 50px;
      height: 50px;
    }
    .sizes button {
      min-width: 48px;
      font-size: 13px;
      padding: 7px 14px;
    }
    .sizes button.active {
      padding: 6px 13px;
    }
  }
</style>
