<script>
  import { onMount, onDestroy } from "svelte";
  import { BRAND } from "../lib/brand.js";
  import { watchHomeBanners } from "../lib/homeBanners.js";

  export let onShop = () => {};

  /** Uploaded image banners (Admin → Home Banners). Empty → built-in slides below. */
  let imageBanners = [];
  let touchX = null;
  let paused = false;

  /** Built-in fallback slides, shown only when no admin banner is active. */
  const slides = [
    {
      eyebrow: "Brand new · Sealed",
      title: "The latest iPhone is here",
      sub: "iPhone 18 Pro, Pro Max & iPhone Duo — 100% authentic, with warranty.",
      cta: "Shop iPhones",
      image: "/brand/products/apple-iphone-18-pro-2up-geo-260909-inline-jpg-large.jpg",
      alt: "iPhone 18 Pro"
    },
    {
      eyebrow: "Swap & Top Up",
      title: "Trade in your old phone",
      sub: "Bring your current device, top up the difference and walk out with a new one. T&Cs apply.",
      cta: "Shop now",
      image: "/brand/products/apple-iphone-duo.jpg",
      alt: "iPhone Duo"
    },
    {
      eyebrow: "Visit us in Kampala",
      title: BRAND.tagline,
      sub: "Ntinda (Emessa Complex) & Wilson Street (Zainab Plaza). Same-day delivery in Kampala.",
      cta: "Shop now",
      image: "/brand/store/bagz-store.jpg",
      alt: "Bagz Apple Services store"
    }
  ];

  let index = 0;
  let timer;

  $: count = imageBanners.length || slides.length;
  $: slide = slides[index % slides.length];

  function go(next) {
    index = (next + count) % count;
  }

  let stopWatching = () => {};

  onMount(() => {
    timer = setInterval(() => {
      if (!paused && !document.hidden) go(index + 1);
    }, 6000);
    // Live: banners added/edited/hidden in Admin appear without reloading the page.
    stopWatching = watchHomeBanners((list) => {
      const currentId = imageBanners[index]?.id;
      imageBanners = list;
      const keep = list.findIndex((b) => b.id === currentId);
      index = keep >= 0 ? keep : 0;
    });
  });
  onDestroy(() => {
    clearInterval(timer);
    stopWatching();
  });

  function openBanner(banner) {
    const link = banner?.link || "";
    if (!link) return onShop();
    if (link.startsWith("/")) {
      window.location.href = link;
    } else {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  }

  function onTouchStart(e) {
    touchX = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchX = null;
  }
</script>

{#if imageBanners.length}
  <section
    class="img-hero"
    aria-label="Promotions"
    aria-roledescription="carousel"
    on:pointerenter={(e) => (paused = e.pointerType === "mouse")}
    on:pointerleave={() => (paused = false)}
    on:touchstart|passive={onTouchStart}
    on:touchend={onTouchEnd}
  >
    <div class="track" style="transform: translateX(-{index * 100}%)">
      {#each imageBanners as banner, i (banner.id)}
        <button
          type="button"
          class="slide"
          aria-label={banner.caption || `Promotion ${i + 1}`}
          aria-hidden={i !== index}
          tabindex={i === index ? 0 : -1}
          on:click={() => openBanner(banner)}
        >
          <picture>
            {#if banner.mobileImageUrl}
              <source media="(max-width: 700px)" srcset={banner.mobileImageUrl} />
            {/if}
            <img
              src={banner.imageUrl}
              alt={banner.caption || ""}
              loading="eager"
              decoding="async"
              fetchpriority={i === 0 ? "high" : "low"}
            />
          </picture>
        </button>
      {/each}
    </div>

    {#if imageBanners.length > 1}
      <button type="button" class="nav prev" aria-label="Previous banner" on:click={() => go(index - 1)}>
        <i class="fa fa-chevron-left" aria-hidden="true"></i>
      </button>
      <button type="button" class="nav next" aria-label="Next banner" on:click={() => go(index + 1)}>
        <i class="fa fa-chevron-right" aria-hidden="true"></i>
      </button>
      <div class="dots">
        {#each imageBanners as _, i}
          <button type="button" class:active={i === index} aria-label="Banner {i + 1}" on:click={() => go(i)} />
        {/each}
      </div>
    {/if}
  </section>
{:else}
<section class="hero" aria-label="Promotions">
  <div class="glow" aria-hidden="true" />

  <div class="hero-inner">
    <div class="copy">
      <p class="eyebrow">{slide.eyebrow}</p>
      <h2>{slide.title}</h2>
      <p class="sub">{slide.sub}</p>
      <button type="button" class="cta" on:click={onShop}>{slide.cta} ›</button>
    </div>
    <div class="media">
      {#key index}
        <img src={slide.image} alt={slide.alt} loading={index === 0 ? "eager" : "lazy"} />
      {/key}
    </div>
  </div>

  <div class="dots">
    {#each slides as _, i}
      <button
        type="button"
        class:active={i === index}
        aria-label="Slide {i + 1}"
        on:click={() => (index = i)}
      />
    {/each}
  </div>
</section>
{/if}

<style>
  /* ---------- uploaded image banners ---------- */
  .img-hero {
    position: relative;
    overflow: hidden;
    background: #0c2236;
  }
  .track {
    display: flex;
    transition: transform 0.55s ease;
  }
  .slide {
    flex: 0 0 100%;
    padding: 0;
    margin: 0;
    border: 0;
    background: none;
    cursor: pointer;
    display: block;
  }
  .slide picture,
  .slide img {
    display: block;
    width: 100%;
  }
  /* Designed banners carry their own text — never crop them; show at natural ratio. */
  .slide img {
    height: auto;
  }
  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 0;
    background: rgba(255, 255, 255, 0.85);
    color: #13344f;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    z-index: 2;
  }
  .nav:hover {
    background: #fff;
  }
  .nav.prev {
    left: 14px;
  }
  .nav.next {
    right: 14px;
  }
  @media (max-width: 700px) {
    .nav {
      display: none;
    }
  }

  /* ---------- built-in fallback slides ---------- */
  .hero {
    position: relative;
    background: linear-gradient(120deg, #0c2236 0%, #13344f 55%, #1a4a70 100%);
    color: #fff;
    overflow: hidden;
    padding: 28px 20px 40px;
  }
  .glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 45% 70% at 78% 50%, rgba(43, 168, 224, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 30% 40% at 10% 100%, rgba(43, 168, 224, 0.18) 0%, transparent 70%);
  }
  .hero-inner {
    position: relative;
    z-index: 1;
    max-width: var(--page-max);
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    align-items: center;
    gap: 24px;
    min-height: clamp(200px, 26vw, 300px);
  }
  .hero-inner > * {
    min-width: 0;
  }
  .eyebrow {
    margin: 0;
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #2ba8e0;
  }
  h2 {
    margin: 8px 0 10px;
    font-size: clamp(26px, 4vw, 44px);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .sub {
    margin: 0 0 18px;
    max-width: 46ch;
    font-size: clamp(13px, 1.4vw, 16px);
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.82);
  }
  .cta {
    border: none;
    background: #2ba8e0;
    color: #0c2236;
    font-size: 14px;
    font-weight: 800;
    padding: 11px 26px;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .cta:hover {
    background: #fff;
    transform: translateY(-1px);
  }
  .media {
    justify-self: end;
    width: 100%;
    max-width: 460px;
    aspect-ratio: 4 / 3;
    border-radius: 18px;
    overflow: hidden;
    background: #0c2236;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  }
  .media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    animation: fade 0.5s ease;
  }
  @keyframes fade {
    from {
      opacity: 0;
      transform: scale(1.03);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .dots {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    z-index: 2;
  }
  .dots button {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: none;
    padding: 0;
    background: rgba(255, 255, 255, 0.35);
    cursor: pointer;
  }
  .dots button.active {
    background: #fff;
    width: 18px;
    border-radius: 999px;
  }
  @media (max-width: 900px) {
    .hero {
      padding: 16px 14px 30px;
    }
    .hero-inner {
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      min-height: 150px;
    }
    h2 {
      font-size: clamp(18px, 5.4vw, 26px);
      margin: 4px 0 6px;
    }
    .sub {
      font-size: 12px;
      margin-bottom: 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .eyebrow {
      font-size: 10px;
    }
    .cta {
      padding: 8px 16px;
      font-size: 12px;
    }
    .media {
      border-radius: 12px;
      aspect-ratio: 1 / 1;
    }
  }
</style>
