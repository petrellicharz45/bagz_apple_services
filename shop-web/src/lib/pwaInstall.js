import { writable } from "svelte/store";

export function isRunningAsInstalledPwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export const pwaCanQuickInstall = writable(false);
export const pwaInstalling = writable(false);
export const isPwaInstalled = writable(
  typeof window !== "undefined" && isRunningAsInstalledPwa()
);

let deferredPrompt = null;

function refreshInstalledState() {
  isPwaInstalled.set(isRunningAsInstalledPwa());
}

export function initPwaInstallListeners() {
  if (typeof window === "undefined") return;

  refreshInstalledState();
  if (isRunningAsInstalledPwa()) {
    pwaCanQuickInstall.set(false);
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaCanQuickInstall.set(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    pwaCanQuickInstall.set(false);
    refreshInstalledState();
  });
}

/** Chrome / Edge / Android: native install sheet. */
export async function quickInstallPwa() {
  if (!deferredPrompt) {
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  if (!deferredPrompt) {
    return false;
  }
  pwaInstalling.set(true);
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    pwaCanQuickInstall.set(false);
    if (choice.outcome !== "accepted") {
      throw new Error("Install cancelled.");
    }
    return true;
  } finally {
    pwaInstalling.set(false);
  }
}
