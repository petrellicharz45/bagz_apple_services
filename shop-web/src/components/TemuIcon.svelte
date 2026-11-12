<script>
  /** Temu-style line icons — fixed viewBox, stroke-based */
  export let name = "search";
  export let size = 16;
  export let strokeWidth = 1.75;
  export let color = "currentColor";

  const paths = {
    truck:
      "M3 6h11v8H3V6zm11 2h3l2 3v3h-5V8zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    package: "M4 8l8-4 8 4v8l-8 4-8-4V8zm8-4v8m0-8L4 8m8 0l8 0",
    phone: "M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zm4 14h.01",
    search: "M11 4a7 7 0 104.95 11.95L20 20l-1.5 1.5-4.05-4.05A7 7 0 0011 4z",
    bag:
      "M6 7V5a4 4 0 118 0v2h3v12H3V7h3zm2 0h8V5a2 2 0 10-4 0v2",
    user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 1 0 8zm-7 9a7 7 0 0 1 14 0",
    headset: "M4 10v4a4 4 0 004 4h1v-6H6a2 2 0 00-2 2zm16 0v4a4 4 0 01-4 4h-1v-6h3a2 2 0 002-2zM8 10h8a4 4 0 014 4v2h-2v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2H4v-2a4 4 0 014-4z",
    cart: "M6 6h14l-1.5 9h-11L6 6zm3 15a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm9 0a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z",
    chevronRight: "M9 6l6 6-6 6",
    chevronLeft: "M15 6l-6 6 6 6",
    check: "M5 12l4 4 10-10",
    shield: "M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z",
    lock: "M7 11V8a5 5 0 0110 0v3h1v9H6v-9h1zm2 0h6V8a3 3 0 00-6 0v3",
    globe: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9m0-18c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9M3 12h18",
    message: "M4 5h16v10H7l-3 3V5z",
    arrowUp: "M12 5v14M5 12l7-7 7 7",
    bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
    grid: "M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3V14zm11 0h7v7h-7V14z",
    home: "M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z",
    x: "M6 6l12 12M18 6L6 18",
    share: "M12 15V3m0 0L8 7m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7",
    tag: "M7 4h6l4 4v11H7V4zm6 0v4h4",
    wallet:
      "M3 7h18v12H3V7zm2 0V5a2 2 0 012-2h10a2 2 0 012 2v2M16 13a2 2 0 100-4 2 2 0 000 4z",
    thumbUp:
      "M7 10v9M7 10l-3.5-3.5a1.5 1.5 0 112.1 2.1L7 9m0 1l3-2.5a1.5 1.5 0 112.1 2.1L9 10",
    star: "M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 17.8 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3z",
    sale:
      "M8 4h8l2 4v10a2 2 0 01-2 2H8a2 2 0 01-2-2V8l2-4zm4 6v4m0 2h.01",
    sparkles: "M12 3v2m0 14v2M5 12H3m18 0h-2M7 7l-1.5-1.5M18.5 18.5L17 17M7 17l-1.5 1.5M18.5 5.5L17 7",
    chevronDown: "M6 9l6 6 6-6",
    layers: "M12 4l9 4.5v2L12 15 3 10.5v-2L12 4zm0 7l9-4.5M12 11L3 6.5"
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class="temu-icon"
>
  <path d={paths[name] || paths.search} />
</svg>

<style>
  .temu-icon {
    display: block;
    flex-shrink: 0;
  }
</style>
