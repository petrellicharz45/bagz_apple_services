import { doc, getDoc } from "firebase/firestore/lite";
import { db } from "./firebase.js";
import { storageKey } from "./brand.js";

/** Promotional pop-ups managed in Admin → Pop-ups (Firestore settings/popups.items). */

const DISMISS_KEY = storageKey("popup_dismissed_v1");
const SESSION_KEY = storageKey("popup_dismissed_session_v1");
const DAY = 24 * 60 * 60 * 1000;

function readJson(store, key) {
  try {
    return JSON.parse(store.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}
function writeJson(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage blocked: the pop-up just shows again next time */
  }
}

/** Has this visitor closed the pop-up recently enough that it should stay hidden? */
export function isDismissed(popup) {
  if (typeof window === "undefined") return false;
  if (readJson(sessionStorage, SESSION_KEY)[popup.id]) return true;
  const at = readJson(localStorage, DISMISS_KEY)[popup.id];
  if (!at) return false;
  const reshow = popup.reshow || "1d";
  if (reshow === "never") return true;
  if (reshow === "session") return false;
  const wait = reshow === "7d" ? 7 * DAY : DAY;
  return Date.now() - at < wait;
}

export function dismissPopup(popup) {
  if (typeof window === "undefined" || !popup) return;
  const session = readJson(sessionStorage, SESSION_KEY);
  session[popup.id] = true;
  writeJson(sessionStorage, SESSION_KEY, session);
  const all = readJson(localStorage, DISMISS_KEY);
  all[popup.id] = Date.now();
  writeJson(localStorage, DISMISS_KEY, all);
}

function cleanPopups(data) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  return items
    .filter((p) => p && p.active !== false && /^https:\/\//i.test(String(p.imageUrl || "")))
    .map((p, i) => ({
      id: String(p.id || i),
      imageUrl: String(p.imageUrl),
      title: String(p.title || ""),
      link: String(p.link || ""),
      startAt: typeof p.startAt === "number" ? p.startAt : null,
      endAt: typeof p.endAt === "number" ? p.endAt : null,
      reshow: ["session", "1d", "7d", "never"].includes(p.reshow) ? p.reshow : "1d",
      delaySeconds: Number.isFinite(p.delaySeconds) ? Math.max(0, Math.min(60, p.delaySeconds)) : 3
    }));
}

/** First pop-up that is live right now and not dismissed by this visitor. */
export function pickPopup(list, now = Date.now()) {
  return (
    list.find((p) => (!p.startAt || now >= p.startAt) && (!p.endAt || now < p.endAt) && !isDismissed(p)) || null
  );
}

/** Active pop-ups, loaded once (the shop uses Firestore "lite", which has no live listeners). */
export function watchPopups(onChange) {
  if (!db) return () => {};
  let stopped = false;
  getDoc(doc(db, "settings", "popups"))
    .then((snap) => !stopped && onChange(cleanPopups(snap.exists() ? snap.data() : null)))
    .catch(() => {});
  return () => {
    stopped = true;
  };
}
