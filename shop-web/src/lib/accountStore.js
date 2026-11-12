import { writable } from "svelte/store";

const PROFILE_KEY = "bagz_profile_v1";
const ADDR_KEY = "bagz_addresses_v1";

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  avatarUrl: ""
};

export const profileStore = writable(readProfile());

export function readProfile() {
  try {
    return { ...defaultProfile, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveProfile(profile) {
  try {
    const next = { ...readProfile(), ...profile };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    profileStore.set(next);
    return next;
  } catch {
    return readProfile();
  }
}

export function readAddresses() {
  try {
    return JSON.parse(localStorage.getItem(ADDR_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveAddresses(list) {
  try {
    localStorage.setItem(ADDR_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function formatAddressLine({ area, city, landmark, line } = {}) {
  const built = (line || "").trim();
  if (built) return built;
  return [area, city, landmark]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function parseAddressFields(addr) {
  if (!addr) return { area: "", city: "", landmark: "" };
  if (addr.area || addr.city) {
    return {
      area: (addr.area || "").trim(),
      city: (addr.city || "").trim(),
      landmark: (addr.landmark || "").trim()
    };
  }
  const parts = (addr.line || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    area: parts[0] || "",
    city: parts[1] || "",
    landmark: parts.slice(2).join(", ")
  };
}

export function addAddress({ label, line, area, city, landmark, makeDefault = true }) {
  const fields = parseAddressFields({ line, area, city, landmark });
  const trimmed = formatAddressLine({ ...fields, line });
  if (!trimmed) return readAddresses();
  const list = readAddresses();
  const entry = {
    id: `addr_${Date.now()}`,
    label: (label || fields.area || "Home").trim() || "Home",
    line: trimmed,
    area: fields.area,
    city: fields.city,
    landmark: fields.landmark,
    isDefault: makeDefault || list.length === 0
  };
  if (entry.isDefault) {
    list.forEach((a) => {
      a.isDefault = false;
    });
  }
  list.unshift(entry);
  saveAddresses(list);
  return list;
}

/** Save or update an address from checkout (dedupes by area + city + landmark). */
export function upsertAddress({ label, line, area, city, landmark, makeDefault = true }) {
  const fields = parseAddressFields({ line, area, city, landmark });
  const trimmed = formatAddressLine(fields);
  if (!trimmed) return readAddresses();
  const list = readAddresses();
  const norm = (s) => (s || "").trim().toLowerCase();
  const existing = list.find(
    (a) =>
      norm(a.area) === norm(fields.area) &&
      norm(a.city) === norm(fields.city) &&
      norm(a.landmark) === norm(fields.landmark)
  );
  if (existing) {
    existing.line = trimmed;
    existing.area = fields.area;
    existing.city = fields.city;
    existing.landmark = fields.landmark;
    if (label?.trim()) existing.label = label.trim();
    if (makeDefault) {
      list.forEach((a) => {
        a.isDefault = a.id === existing.id;
      });
    }
    saveAddresses(list);
    return list;
  }
  return addAddress({ label, ...fields, line: trimmed, makeDefault });
}

export function removeAddress(id) {
  let list = readAddresses().filter((a) => a.id !== id);
  if (list.length && !list.some((a) => a.isDefault)) {
    list[0].isDefault = true;
  }
  saveAddresses(list);
  return list;
}

export function setDefaultAddress(id) {
  const list = readAddresses().map((a) => ({ ...a, isDefault: a.id === id }));
  saveAddresses(list);
  return list;
}

export function defaultAddress() {
  const list = readAddresses();
  return list.find((a) => a.isDefault) || list[0] || null;
}

export const COUPONS = [
  {
    code: "WELCOME10",
    title: "10% off first order",
    detail: "Enter at checkout when payment API supports promo codes."
  },
  {
    code: "FREESHIP",
    title: "Free shipping",
    detail: "Already applied on eligible items at Bagz."
  }
];
