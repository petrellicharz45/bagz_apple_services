import { writable, get } from "svelte/store";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRAND } from "./brand.js";

export const DEFAULT_LOGO = BRAND.logoWhite;
export const DEFAULT_FAVICON = "/favicon.png";

export const displaySettings = writable({
  shopLogoUrl: "",
  shopFaviconUrl: "",
  loaded: false
});

export function resolvedLogoUrl(settings) {
  const url = settings?.shopLogoUrl?.trim();
  return url && /^https?:\/\//i.test(url) ? url : DEFAULT_LOGO;
}

export function resolvedFaviconUrl(settings) {
  const url = settings?.shopFaviconUrl?.trim();
  return url && /^https?:\/\//i.test(url) ? url : DEFAULT_FAVICON;
}

function setLinkRel(rel, href, extra = {}) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!href) return;
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (extra.type) link.type = extra.type;
  if (extra.sizes) link.sizes = extra.sizes;
}

function applyWebManifestIcon(favicon) {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return;
  const manifest = {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: BRAND.colors.navy,
    categories: ["shopping", "business"],
    icons: [
      { src: favicon, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: favicon, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: favicon, sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  link.href = URL.createObjectURL(blob);
}

/** Apply favicon / PWA icon links in the document head. */
export function applyDisplayBranding(settings) {
  if (typeof document === "undefined") return;
  const favicon = resolvedFaviconUrl(settings);
  setLinkRel("icon", favicon, { type: "image/png", sizes: "192x192" });
  setLinkRel("apple-touch-icon", favicon);
}

export async function loadDisplaySettings() {
  if (!db) {
    displaySettings.update((s) => ({ ...s, loaded: true }));
    return get(displaySettings);
  }
  try {
    const snap = await getDoc(doc(db, "settings", "display"));
    const data = snap.exists() ? snap.data() : {};
    const next = {
      shopLogoUrl: typeof data.shopLogoUrl === "string" ? data.shopLogoUrl : "",
      shopFaviconUrl: typeof data.shopFaviconUrl === "string" ? data.shopFaviconUrl : "",
      loaded: true
    };
    displaySettings.set(next);
    applyDisplayBranding(next);
    return next;
  } catch {
    displaySettings.update((s) => ({ ...s, loaded: true }));
    return get(displaySettings);
  }
}
