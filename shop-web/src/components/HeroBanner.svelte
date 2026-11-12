<script>
  import { onMount, onDestroy } from "svelte";

  export let onShop = () => {};

  const slides = [
    {
      eyebrow: ["EARLY", "MEGA SALE"],
      line1: "UP TO",
      line2: "70% OFF",
      cta: "Shop now"
    },
    {
      eyebrow: ["FANCY DEALS", "UGANDA"],
      line1: "FREE",
      line2: "DELIVERY",
      cta: "Shop now"
    }
  ];

  let index = 0;
  let timer;

  onMount(() => {
    timer = setInterval(() => {
      index = (index + 1) % slides.length;
    }, 7000);
  });
  onDestroy(() => clearInterval(timer));

  $: slide = slides[index];
</script>

<section class="hero" aria-label="Promotions">
  <div class="stage" aria-hidden="true" />
  <div class="floor-glow" aria-hidden="true" />
  <div class="vignette" aria-hidden="true" />
  <div class="spotlight" aria-hidden="true" />
  <div class="curtain left" aria-hidden="true" />
  <div class="curtain right" aria-hidden="true" />

  <div class="bags" aria-hidden="true">
    <div class="bag left">
      <span class="handle" />
      <span class="body">FD</span>
    </div>
    <div class="bag right">
      <span class="handle" />
      <span class="body">FD</span>
    </div>
  </div>

  {#each Array(18) as _, i}
    <span
      class="spark"
      style="--left: {18 + i * 4.2}%; --top: {20 + (i % 6) * 8}%; --delay: {-i * 0.15}s"
      aria-hidden="true"
    />
  {/each}
  {#each Array(14) as _, i}
    <span
      class="confetti"
      style="--left: {25 + i * 4.5}%; --top: {10 + (i % 5) * 12}%; --rot: {i * 28}deg; --delay: {-i * 0.35}s"
      aria-hidden="true"
    />
  {/each}

  <div class="hero-inner">
    <p class="eyebrow">
      <span class="gold">{slide.eyebrow[0]}</span>
      <span class="white">{slide.eyebrow[1]}</span>
    </p>
    <p class="line1">{slide.line1}</p>
    <h2>{slide.line2}</h2>
    <button type="button" class="cta" on:click={onShop}>{slide.cta} ›</button>
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

<style>
  .hero {
    position: relative;
    min-height: clamp(200px, 28vw, 300px);
    background: #0a0504;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 36px 20px 44px;
    overflow: hidden;
  }
  .stage {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% 100%, #3d1a12 0%, transparent 55%),
      linear-gradient(180deg, #0c0605 0%, #1a0d0a 38%, #241108 72%, #1a0a06 100%);
  }
  .floor-glow {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 28%;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(249, 115, 22, 0.12) 45%,
      rgba(251, 191, 36, 0.22) 100%
    );
  }
  .vignette {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: radial-gradient(
      ellipse 70% 85% at 50% 45%,
      transparent 35%,
      rgba(0, 0, 0, 0.55) 100%
    );
  }
  .spotlight {
    position: absolute;
    left: 50%;
    bottom: -20%;
    width: 90%;
    height: 85%;
    transform: translateX(-50%);
    background: radial-gradient(
      ellipse 50% 75% at 50% 85%,
      rgba(255, 200, 120, 0.35) 0%,
      rgba(249, 115, 22, 0.5) 18%,
      rgba(120, 40, 15, 0.15) 42%,
      transparent 72%
    );
    pointer-events: none;
    z-index: 1;
  }
  .curtain {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 26%;
    z-index: 2;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        95deg,
        rgba(0, 0, 0, 0) 0,
        rgba(0, 0, 0, 0.12) 12px,
        rgba(255, 255, 255, 0.04) 24px
      ),
      linear-gradient(90deg, #1a0206 0%, #4a0a14 28%, #6b1228 48%, #8b1a35 62%, transparent 92%);
    box-shadow: inset -8px 0 24px rgba(0, 0, 0, 0.5);
  }
  .curtain.left {
    left: 0;
  }
  .curtain.right {
    right: 0;
    transform: scaleX(-1);
  }
  .bags {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }
  .bag {
    position: absolute;
    top: 22%;
    width: clamp(56px, 8vw, 88px);
    height: clamp(64px, 9vw, 100px);
    animation: bag-float 5s ease-in-out infinite;
  }
  .bag.left {
    left: 14%;
    animation-delay: 0s;
  }
  .bag.right {
    right: 12%;
    animation-delay: 1.4s;
    transform: rotate(8deg);
  }
  .bag .handle {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 42%;
    height: 14px;
    border: 4px solid #9a3412;
    border-bottom: none;
    border-radius: 12px 12px 0 0;
    z-index: 2;
  }
  .bag .body {
    position: absolute;
    inset: 16px 0 0;
    background: linear-gradient(145deg, #fb923c 0%, #ea580c 45%, #c2410c 100%);
    border-radius: 10px 10px 6px 6px;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: clamp(14px, 2vw, 22px);
    color: #fff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
    box-shadow:
      0 12px 28px rgba(0, 0, 0, 0.45),
      inset 0 2px 0 rgba(255, 255, 255, 0.25);
  }
  @keyframes bag-float {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-14px) rotate(2deg);
    }
  }
  .bag.right {
    animation-name: bag-float-r;
  }
  @keyframes bag-float-r {
    0%,
    100% {
      transform: translateY(0) rotate(8deg);
    }
    50% {
      transform: translateY(-12px) rotate(5deg);
    }
  }
  .spark {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #fde68a;
    border-radius: 50%;
    left: var(--left);
    top: var(--top);
    z-index: 3;
    opacity: 0.85;
    animation: twinkle 2.5s ease-in-out infinite;
    animation-delay: var(--delay);
    box-shadow: 0 0 6px #fbbf24;
  }
  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
  .confetti {
    position: absolute;
    width: 8px;
    height: 5px;
    background: #fbbf24;
    left: var(--left);
    top: var(--top);
    z-index: 3;
    opacity: 0.75;
    transform: rotate(var(--rot));
    animation: fall 6s linear infinite;
    animation-delay: var(--delay);
  }
  .confetti:nth-child(odd) {
    background: #fb923c;
    width: 6px;
    height: 6px;
    border-radius: 1px;
  }
  @keyframes fall {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 0;
    }
    15% {
      opacity: 0.9;
    }
    100% {
      transform: translateY(160px) rotate(360deg);
      opacity: 0;
    }
  }
  .hero-inner {
    position: relative;
    z-index: 5;
    max-width: 640px;
    padding: 0 8px;
  }
  .eyebrow {
    margin: 0;
    font-size: clamp(11px, 1.8vw, 14px);
    font-weight: 800;
    letter-spacing: 0.12em;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35em;
  }
  .eyebrow .gold {
    color: #fbbf24;
  }
  .eyebrow .white {
    color: #fff;
  }
  .line1 {
    margin: 10px 0 0;
    font-size: clamp(20px, 3.5vw, 32px);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
  .hero h2 {
    margin: 2px 0 20px;
    font-size: clamp(36px, 7vw, 58px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -0.02em;
    text-shadow:
      0 4px 20px rgba(0, 0, 0, 0.5),
      0 0 40px rgba(249, 115, 22, 0.15);
  }
  .cta {
    border: none;
    background: linear-gradient(180deg, #fde047 0%, #f59e0b 55%, #d97706 100%);
    color: #1a0a04;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 11px 32px;
    border-radius: 6px;
    cursor: pointer;
    box-shadow:
      0 4px 0 #b45309,
      0 8px 24px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .cta:hover {
    transform: translateY(-1px);
    box-shadow:
      0 5px 0 #b45309,
      0 10px 28px rgba(0, 0, 0, 0.45);
  }
  .dots {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    z-index: 6;
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
      min-height: 118px;
      padding: 14px 12px 22px;
    }
    .hero h2 {
      font-size: clamp(26px, 8vw, 34px);
      margin-bottom: 10px;
    }
    .line1 {
      margin-top: 4px;
      font-size: 13px;
    }
    .eyebrow {
      font-size: 10px;
    }
    .cta {
      padding: 8px 22px;
      font-size: 12px;
      box-shadow: 0 3px 0 #b45309, 0 6px 16px rgba(0, 0, 0, 0.35);
    }
    .bags {
      opacity: 0.55;
      transform: scale(0.55);
      transform-origin: center bottom;
    }
    .spark,
    .confetti {
      opacity: 0.45;
      transform: scale(0.7);
    }
    .curtain {
      width: 14%;
      opacity: 0.85;
    }
    .spotlight {
      height: 70%;
    }
  }
  @media (max-width: 640px) {
    .bag.left {
      left: 4%;
    }
    .bag.right {
      right: 4%;
      opacity: 0.85;
    }
  }
</style>
