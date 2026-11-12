const RESERVED_SETTINGS_KEYS = new Set(["recommended"]);

/** Parse settings/categories — keys are category names; values may be true or an image URL. */
export function categoryKeysFromSettings(data) {
  if (!data || typeof data !== "object") return [];
  return Object.keys(data).filter(
    (k) => k && !k.startsWith("_") && !RESERVED_SETTINGS_KEYS.has(k.toLowerCase())
  );
}

export function imageMapFromSettings(data) {
  const images = {};
  if (!data || typeof data !== "object") return images;
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string" && /^https?:\/\//i.test(val.trim())) {
      images[key] = val.trim();
    }
  }
  return images;
}
