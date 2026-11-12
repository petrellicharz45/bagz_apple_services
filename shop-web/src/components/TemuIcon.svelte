<script>
  /**
   * Shop icon — renders Font Awesome 4.7 (loaded in index.html).
   * Keeps the original icon names so callers don't change.
   */
  export let name = "search";
  export let size = 16;
  export let color = "currentColor";
  /** Kept for API compatibility with the old SVG icons; not used by the font. */
  export let strokeWidth = 1.75;

  const FA = {
    truck: "truck",
    package: "cube",
    phone: "mobile",
    search: "search",
    bag: "shopping-bag",
    user: "user-o",
    headset: "headphones",
    cart: "shopping-cart",
    chevronRight: "chevron-right",
    chevronLeft: "chevron-left",
    chevronDown: "chevron-down",
    check: "check-circle-o",
    shield: "shield",
    lock: "lock",
    globe: "globe",
    message: "comment-o",
    arrowUp: "arrow-up",
    bolt: "bolt",
    grid: "th-large",
    home: "home",
    x: "times",
    share: "share-alt",
    tag: "tag",
    wallet: "credit-card",
    thumbUp: "thumbs-o-up",
    star: "star",
    sale: "percent",
    sparkles: "magic",
    layers: "clone",
    apple: "apple",
    android: "android",
    laptop: "laptop",
    tablet: "tablet",
    watch: "clock-o",
    plug: "plug",
    swap: "exchange",
    whatsapp: "whatsapp"
  };

  $: cls = FA[name] || name || "circle-o";
  $: void strokeWidth;
</script>

<i
  class="fa fa-{cls} shop-icon"
  style="font-size:{size}px;width:{size}px;height:{size}px;color:{color}"
  aria-hidden="true"
></i>

<style>
  .shop-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }
</style>
