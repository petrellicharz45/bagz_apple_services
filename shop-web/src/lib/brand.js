/**
 * Bagz Apple Services — single source of truth for brand identity.
 * Change the client here; the rest of the shop reads from this file.
 */

export const BRAND = {
  name: "Bagz Apple Services",
  shortName: "Bagz",
  legalName: "Bagz Apple Services",
  tagline: "Authentic Genuine Gadget Store",
  heroLine: "Kampala's trusted Apple & tech hub",
  description:
    "Authentic iPhones, Google Pixel, Samsung, MacBooks, Apple Watch, AirPods and accessories in Kampala. Swap & top-up, repairs, warranty and same-day delivery.",
  siteUrl: "https://bagzappleservices.com",
  domain: "bagzappleservices.com",

  /** Brand colours (from the BAGZ logo). */
  colors: {
    navy: "#13344f",
    navyDeep: "#0c2236",
    accent: "#2ba8e0",
    action: "#1673c4"
  },

  logo: "/brand/bagz-logo.png",
  logoWhite: "/brand/bagz-logo-white.png",
  ogImage: "/brand/store/bagz-store.jpg",

  contact: {
    email: "info@bagzappleservices.com",
    phoneDisplay: "+256 754 558 186",
    phoneTel: "+256754558186",
    whatsappE164: "256754558186",
    /** Weekday hours not yet confirmed by the client — only Sunday hours are published. */
    hours: "Sundays 11:00 AM – 5:00 PM · call for weekday hours"
  },

  branches: [
    {
      id: "ntinda",
      name: "Ntinda Branch",
      address: "Emessa Complex, Shop S10 (Level 3), Kiwatule Road, opp. Independent Hospital, Ntinda, Kampala"
    },
    {
      id: "kampala",
      name: "Kampala Branch",
      address: "Zainab Plaza, Wilson Street, Level 3 – Shop 13, Kampala"
    }
  ],

  social: {
    instagram: "https://www.instagram.com/bagzappleservices",
    facebook: "https://www.facebook.com/bagzappleservices",
    x: "https://x.com/bagzapplestore",
    snapchat: "https://www.snapchat.com/add/bagzmarvin"
  },

  /** Selling points shown in the trust bar, hero and help pages. */
  promises: {
    authentic: "100% authentic devices",
    warranty: "Warranty on every device",
    delivery: "Same-day delivery in Kampala",
    swap: "Swap & top-up accepted"
  },

  /** Android app (update once the Play Store listing exists). */
  androidPackage: "com.bagzappleservices.app",
  userAgentTag: "BagzApp",

  /** Prefix for browser localStorage keys. */
  storagePrefix: "bagz"
};

export const storageKey = (name) => `${BRAND.storagePrefix}_${name}`;
