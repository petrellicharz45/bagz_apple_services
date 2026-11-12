# Banner image preload during splash (hybrid)

## Goal
Banner photos feel slow on home because splash only prefetches Firestore URLs; Glide downloads bytes after the ViewPager binds. Prefetch image bytes during splash.

## Approach
Hybrid Glide preload in `AppDataStore` after `fetchBanners()` succeeds:

1. Inject `@ApplicationContext Context`.
2. Collect banner image URLs (same rules as `BannersAdapter`).
3. Await Glide `downloadOnly` for the first 2 URLs (per-image timeout ~3s).
4. Fire-and-forget preload for the remaining URLs.
5. `isReady` stays gated on warm-up join (so splash waits for those first 2, subject to existing min/max splash timing).

## Out of scope
Adapter changes, Coil migration, waiting for all banners.
