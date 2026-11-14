import { BRAND } from "./brand.js";

/**
 * True when the shop runs bundled inside the Bagz Android app
 * (served by the WebView from https://appassets.androidplatform.net).
 */
export const IN_BUNDLED_APP =
  typeof location !== "undefined" && location.hostname === "appassets.androidplatform.net";

/** "/api/x.php" → same site on the web; the hosted site when running inside the app. */
export function apiUrl(path) {
  return IN_BUNDLED_APP ? `${BRAND.siteUrl.replace(/\/$/, "")}${path}` : path;
}
