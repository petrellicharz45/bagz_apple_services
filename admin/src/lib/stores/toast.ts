import { writable } from "svelte/store";

export type ToastState = {
  message: string;
  fading: boolean;
};

export const toastStore = writable<ToastState | null>(null);

let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** Green banner at top of admin — fades out automatically. */
export function showSuccessToast(message: string, visibleMs = 5500) {
  if (fadeTimer) clearTimeout(fadeTimer);
  if (clearTimer) clearTimeout(clearTimer);

  toastStore.set({ message, fading: false });

  fadeTimer = setTimeout(() => {
    toastStore.update((t) => (t ? { ...t, fading: true } : null));
    clearTimer = setTimeout(() => toastStore.set(null), 450);
  }, visibleMs);
}

export function showErrorToast(message: string, visibleMs = 7000) {
  if (fadeTimer) clearTimeout(fadeTimer);
  if (clearTimer) clearTimeout(clearTimer);

  toastStore.set({ message, fading: false });

  fadeTimer = setTimeout(() => {
    toastStore.update((t) => (t ? { ...t, fading: true } : null));
    clearTimer = setTimeout(() => toastStore.set(null), 450);
  }, visibleMs);
}
