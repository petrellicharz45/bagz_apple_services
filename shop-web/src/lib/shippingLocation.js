/** Saved delivery zone/area for shipping fee snippets on product pages. */

const ZONE_KEY = "fancydeals_delivery_zone";
const AREA_KEY = "fancydeals_delivery_area";

export const KAMPALA_AREAS = [
  "Central Business District",
  "Nakawa",
  "Rubaga",
  "Makindye",
  "Kawempe",
  "Ntinda",
  "Kira",
  "Entebbe Road"
];

export function getSavedDeliveryZone() {
  try {
    const z = localStorage.getItem(ZONE_KEY);
    return z === "outside" ? "outside" : "kampala";
  } catch {
    return "kampala";
  }
}

export function saveDeliveryZone(zone) {
  try {
    localStorage.setItem(ZONE_KEY, zone === "outside" ? "outside" : "kampala");
  } catch {
    /* ignore */
  }
}

export function getSavedDeliveryArea() {
  try {
    const a = localStorage.getItem(AREA_KEY);
    if (a && KAMPALA_AREAS.includes(a)) return a;
  } catch {
    /* ignore */
  }
  return KAMPALA_AREAS[0];
}

export function saveDeliveryArea(area) {
  try {
    if (area && KAMPALA_AREAS.includes(area)) {
      localStorage.setItem(AREA_KEY, area);
    }
  } catch {
    /* ignore */
  }
}

/** Human-readable destination for “+ shipping … to …”. */
export function deliveryDestinationLabel(zone, kampalaArea) {
  if (zone === "outside") return "Outside Kampala";
  return kampalaArea || KAMPALA_AREAS[0];
}
