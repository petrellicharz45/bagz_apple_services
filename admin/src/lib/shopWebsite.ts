import { PUBLIC_SHOP_URL } from "$env/static/public";

/** Customer-facing shop base URL. */
export function shopWebsiteUrl(): string {
  const custom = (PUBLIC_SHOP_URL || "").trim();
  if (custom.startsWith("http")) return custom.replace(/\/$/, "");
  return "http://localhost:5180";
}

/**
 * URL that opens in the normal browser instead of an installed PWA window.
 * On Windows, localhost shop PWAs steal links to localhost — 127.0.0.1 avoids that in dev.
 */
export function shopWebsiteBrowserUrl(): string {
  try {
    const u = new URL(shopWebsiteUrl());
    if (u.hostname === "localhost") {
      u.hostname = "127.0.0.1";
    }
    u.searchParams.set("view", "browser");
    return u.toString();
  } catch {
    return shopWebsiteUrl();
  }
}

/** Open shop in a real browser tab (not the installed PWA app). */
export function openShopInBrowser(): void {
  const url = shopWebsiteBrowserUrl();
  window.open(url, "_blank", "noopener,noreferrer");
}
