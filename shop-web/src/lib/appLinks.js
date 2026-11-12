/** Android app — Play Store listing (set VITE_PLAY_STORE_URL when live). */
const DEFAULT_PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.bagzappleservices.com";

export function playStoreUrl() {
  const custom = import.meta.env.VITE_PLAY_STORE_URL;
  if (typeof custom === "string" && custom.trim().startsWith("http")) {
    return custom.trim();
  }
  return DEFAULT_PLAY_STORE;
}

/** iOS App Store — set VITE_APP_STORE_URL when the iOS app is live. */
export function appStoreUrl() {
  const custom = import.meta.env.VITE_APP_STORE_URL;
  if (typeof custom === "string" && custom.trim().startsWith("http")) {
    return custom.trim();
  }
  return "";
}

export function hasAppStoreLink() {
  return Boolean(appStoreUrl());
}

/** Best store link for this device (App Store on iPhone/iPad when configured). */
export function nativeAppDownloadUrl() {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) {
      const ios = appStoreUrl();
      if (ios) return ios;
    }
  }
  return playStoreUrl();
}

const BANNER_DISMISS_KEY = "bagz_app_banner_dismissed";

export function isAppBannerDismissed() {
  try {
    localStorage.removeItem(BANNER_DISMISS_KEY);
    return sessionStorage.getItem(BANNER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissAppBanner() {
  try {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}
