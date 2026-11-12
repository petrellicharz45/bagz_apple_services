import "./app.css";
import App from "./App.svelte";
import { initPwaInstallListeners } from "./lib/pwaInstall.js";
import { loadDisplaySettings } from "./lib/storeDisplay.js";
import { loadDeliveryFeeSettings } from "./lib/deliveryFees.js";
import { loadLiveContact } from "./lib/shopContact.js";
import "./lib/shopAuth.js";

initPwaInstallListeners();
loadDisplaySettings();
loadDeliveryFeeSettings();
loadLiveContact();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const mount = document.getElementById("app");
// Pages are prerendered with plain HTML for search engines (scripts/prerender-seo.mjs);
// the app replaces that content once it starts.
if (mount) mount.innerHTML = "";
let app;
try {
  app = new App({ target: mount });
} catch (e) {
  console.error(e);
  if (mount) {
    mount.innerHTML =
      '<p style="padding:24px;font-family:system-ui">Shop failed to start. Hard refresh (Ctrl+Shift+R) or clear site data for this host.</p>';
  }
  throw e;
}

export default app;
