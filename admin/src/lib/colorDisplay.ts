/** Shared palette + friendly names (picker, shop, admin). */
export const NAMED_HEX: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#FF0000",
  green: "#008000",
  blue: "#0000FF",
  yellow: "#FFFF00",
  orange: "#FFA500",
  purple: "#800080",
  pink: "#FFC0CB",
  brown: "#A52A2A",
  gray: "#808080",
  grey: "#808080",
  navy: "#000080",
  teal: "#008080",
  cyan: "#00FFFF",
  magenta: "#FF00FF",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00FF00",
  aqua: "#00FFFF",
  silver: "#C0C0C0",
  gold: "#FFD700",
  beige: "#F5F5DC",
  ivory: "#FFFFF0",
  khaki: "#F0E68C",
  coral: "#FF7F50",
  salmon: "#FA8072",
  crimson: "#DC143C",
  tomato: "#FF6347",
  indigo: "#4B0082",
  violet: "#EE82EE",
  lavender: "#E6E6FA",
  turquoise: "#40E0D0",
  chocolate: "#D2691E",
  tan: "#D2B48C",
  wheat: "#F5DEB3",
  snow: "#FFFAFA",
  cream: "#FFFDD0",
  burgundy: "#800020",
  mustard: "#FFDB58",
  peach: "#FFDAB9",
  mint: "#98FF98",
  charcoal: "#36454F",
  offwhite: "#FAF9F6",
  rosegold: "#B76E79",
  goldenrose: "#E8B4B8",
  goldenyellow: "#FFDF00",
  champagne: "#F7E7CE",
  rose: "#E8B4B8",
  skyblue: "#87CEEB",
  lightblue: "#ADD8E6"
};

const HEX_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAMED_HEX).map(([name, hex]) => [hex.toUpperCase(), titleCase(name)])
);

function titleCase(word: string) {
  return word.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** Closest palette name for any hex (color picker). */
export function nearestColorName(hex: string): string {
  const key = normalizeHex(hex);
  if (HEX_TO_NAME[key]) return HEX_TO_NAME[key];
  const rgb = hexToRgb(key);
  let best = "Custom";
  let bestD = Infinity;
  for (const [name, h] of Object.entries(NAMED_HEX)) {
    const d = colorDistance(rgb, hexToRgb(h));
    if (d < bestD) {
      bestD = d;
      best = titleCase(name.replace(/([a-z])([A-Z])/g, "$1 $2"));
    }
  }
  return best;
}

export function resolveNamedHex(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const compact = text.toLowerCase().replace(/\s+/g, "");
  if (NAMED_HEX[compact]) return normalizeHex(NAMED_HEX[compact]);
  const hex = text.startsWith("#") ? text : `#${text}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return normalizeHex(hex);
  return null;
}

/** Multi-word names: "golden yellow", "rose gold", "light blue". */
export function resolveHexFromColorPhrase(raw: string): string | null {
  const direct = resolveNamedHex(raw);
  if (direct) return direct;

  const words = raw
    .toLowerCase()
    .trim()
    .split(/[\s,/+-]+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  if (!words.length) return null;

  const compact = words.join("");
  if (NAMED_HEX[compact]) return normalizeHex(NAMED_HEX[compact]);

  if (words.includes("yellow") && (words.includes("golden") || words.includes("gold"))) {
    return normalizeHex(NAMED_HEX.goldenyellow);
  }
  if (words.includes("rose") && (words.includes("golden") || words.includes("gold"))) {
    return normalizeHex(NAMED_HEX.goldenrose);
  }
  if (words.includes("rose") && words.includes("gold")) {
    return normalizeHex(NAMED_HEX.rosegold);
  }

  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (NAMED_HEX[w]) return normalizeHex(NAMED_HEX[w]);
  }

  for (const w of words) {
    if (NAMED_HEX[w]) return normalizeHex(NAMED_HEX[w]);
  }

  return null;
}

export function colorIntToHex(c: number): string {
  const hex = (c >>> 0).toString(16).padStart(8, "0").substring(2);
  return `#${hex.toUpperCase()}`;
}

export function normalizeHex(hex: string): string {
  const t = hex.trim();
  const withHash = t.startsWith("#") ? t : `#${t}`;
  return withHash.toUpperCase();
}

export function colorHexLabel(hex: string, customLabel?: string): string {
  if (customLabel?.trim()) return customLabel.trim();
  const key = normalizeHex(hex);
  return HEX_TO_NAME[key] || nearestColorName(key);
}

export function colorIntLabel(c: number, customLabel?: string): string {
  return colorHexLabel(colorIntToHex(c), customLabel);
}

export function parseHexList(colorsStr: string): string[] {
  if (!colorsStr?.trim()) return [];
  return colorsStr
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^#?[0-9A-Fa-f]{6}$/.test(item.replace("#", "")))
    .map((item) => normalizeHex(item.startsWith("#") ? item : `#${item}`));
}

/** One gallery index per color; defaults to 0, 1, 2… when unset. */
export function normalizeColorImageIndices(
  colorCount: number,
  imageCount: number,
  existing?: number[] | null
): number[] {
  if (colorCount <= 0) return [];
  const maxIdx = Math.max(0, imageCount - 1);
  const out: number[] = [];
  for (let i = 0; i < colorCount; i++) {
    const prev = existing?.[i];
    if (
      typeof prev === "number" &&
      Number.isFinite(prev) &&
      imageCount > 0 &&
      prev >= 0 &&
      prev < imageCount
    ) {
      out.push(prev);
    } else if (imageCount > 0) {
      out.push(Math.min(i, maxIdx));
    } else {
      out.push(0);
    }
  }
  return out;
}
