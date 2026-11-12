# Fancy Deals (Luxiva) — App work done

**Date:** 10 October 2026  
**Current Android build:** versionName **1.40**, versionCode **41**  
**APK path:** `app/build/outputs/apk/debug/app-debug.apk`  
**Package:** `com.carthigan.luxiva` (display name: Fancy Deals)

This file records what was implemented for the Android shop and the SvelteKit admin panel. Catalog, offers, categories, and WhatsApp support come from the **admin panel / Firestore**, not from products invented on the phone.

**Scope freeze:** keep the current shop UI. Do not add extra Jumia marketplace screens (sort/filter pages, See-all flash sales, share, delivery line, written reviews, home recently viewed, search history, FAQ, extra header account).

---

## 1. Original six shop / admin changes

| Item | Where | Status |
|------|--------|--------|
| Category sidebar opens product lists | Android Search | Done |
| Color picker + named colors + Add Color | Admin product forms | Done |
| Size selection as orange boxes | Android product details | Done |
| More products + recently viewed | Android product details | Done |
| Admin dashboard restyle (not pharmacy) | Admin web | Done |
| Login restyle (Fancy Deals, no signup copy) | Admin web | Done |

---

## 2. Admin panel (web)

- SvelteKit SPA on Vite (local port **5174**; avoid blank :5173 service-worker cache).
- Firebase Auth email/password with admin claim. DEV allowlist includes the director admin email.
- Dashboard restyled as a shop admin, not a pharmacy.
- Login: orange wave background; cart photo **removed**.
- Settings: Change Password for Firebase Auth.
- Product forms: color picker, named colors, **Add Color**.
- Product forms: **Offer %** and optional **Flash sale ends** (`saleEndAt` millis in Firestore).
- Products, orders, users, tickets, banners, categories, WhatsApp number live in Firestore (`settings/config` for WhatsApp).

---

## 3. Android shop (Kotlin)

### Launch
- Splash no longer waits for every Firestore query. Categories load first; other data continues in the background.
- Splash timeout shortened; splash shows **v{VERSION_NAME}** so you can confirm the installed build.

### Sticky shop chrome (every shopping screen)
- Logo, search, Help, cart + badge on `ShoppingActivity`.
- Old Home mail/calendar header hidden.
- Duplicate Search-tab search bar hidden.
- Help / chat uses admin `settings/config` `whatsappNumber` (fallback `256703055006`).
- Logo returns to Home; cart icon opens Cart.

### Search
- Typing in the sticky search shows a **live dropdown** of matching products (image, name, price) from the Firestore product collection.
- Submit / search button opens the Search tab results (same catalog).
- Category tap from Home opens Search with the category list on the **left** and products on the **right**. Sidebar stays visible.
- Search still supports barcode / AI scan on the Search fragment.

### Home
- Category tabs come from admin categories only (no hardcoded clothing catalog if Firestore fails).
- Flash sales row uses products with `offerPercentage`. Countdown shows when admin set `saleEndAt`.
- Promo cards, circular categories, banners, compact footer (Help, Chat, Contact, Orders, Account).
- `% off` on product cards from admin `offerPercentage`. Expired sales (`saleEndAt` passed) drop the discount.

### Product details
- Title is not used as a giant description. **Description** heading, about 4 lines, **Read more**, smaller type.
- Image thumbs, color chips with product photos, orange size boxes.
- Sticky call / cart / add-to-cart / quantity.
- Flash Sales bar + live countdown when offer + end time are set. Offer-only products show “Limited offer” without a fake timer.
- More products and recently viewed from the real catalog.
- Footer: back to top, chat, help, contact, terms, orders, account.
- Bottom navigation stays visible.

### Cart, account, support
- Cart, billing, addresses, orders, wishlist, tickets, terms unchanged in business logic.
- Payments remain MTN / Airtel / cards as already documented.

---

## 4. Data rules (do not break)

- Login and admin claim stay as they were.
- Stock, checkout, and Firebase writes stay as they were.
- Phone catalog = Firestore `product` documents created in admin.
- Flash sale end time is set in **admin**; the app only counts down.
- If offer % is set and end date is empty, the sale stays on with no countdown until the % is removed.

---

## 5. Machine setup

**Android Studio is already installed on this PC.** Do not ask to install it or treat the SDK/IDE as missing.

- Open the Gradle project: `D:\projects\luxiva\Luxiva`
- Run or debug from Android Studio, or `.\gradlew.bat assembleDebug`
- Debug APK: `app/build/outputs/apk/debug/app-debug.apk`

---

## 6. APK install notes

1. Uninstall Fancy Deals on the phone.
2. Copy **this** file: `Luxiva/app/build/outputs/apk/debug/app-debug.apk` (current: **1.38**).
3. Splash must show **v1.38**. Any older splash means the phone still has an old install.

Older copies on disk (`Luxiva-debug-1.22.apk`, `FancyDeals-1.23.apk`) are **not** this build.

---

## 7. What was deliberately not added

Jumia marketplace extras: dedicated flash-sales page, sort/filter UI, share button, PDP delivery quote, written review threads, home recently viewed, search history, stock “only X left”, extra FAQ page, extra Account icon in the header.

---

## 8. Key files touched (reference)

**Android:** `ShoppingActivity.kt`, `layout_shop_top_bar.xml`, `activity_shopping.xml`, `SearchFragment.kt`, `SearchViewModel.kt`, `ShopSearchViewModel.kt`, `ProductDetailsFragment.kt`, `fragment_product_details.xml`, `HomeFragment.kt`, `MainCategoryFragment.kt`, `fragment_main_category.xml`, `Product.kt` (`saleEndAt`, `activeOffer()`), `AppDataStore.kt`, `app/build.gradle.kts`.

**Admin:** `admin/src/routes/login/+page.svelte`, product new/edit pages (`offerPercentage`, `saleEndAt`), dashboard and settings password.

---

## 9. Follow-up (1.29–1.30)

- **1.30:** Product hero photo is a real ImageView (thumbs were loading; the pager was not). Same admin URLs, smaller decode so it appears instead of a blank square or spinner.

- More products on details: up to **50** from Firestore.
- Large product photo: no shared-element fill on the pager; thumbs and hero use the same admin images.
- Size chips: wrap content, smaller padding (S / XL / XXL no longer stretch full width).

---

## 10. Suggested next small change (not done)

If work continues inside this UI only: show **“Only X left”** on product details from existing admin stock. No new screens.

---

## 11. v1.33 — Catalog alignment (test one item at a time)

Splash **v1.33**. Uninstall old Fancy Deals first.

1. Shop opens with **All** products (not a white screen and black strip).
2. Open Category, tap Shop again — catalog still there.
3. Home tabs are **All** plus **admin category names** (no Women / Curve / Kids / Men / Home).
4. Home **Jersey Outfits** (and every named tab) shows **only** that category.
5. Empty admin category shows **No products in this category yet.** — no mixed fill-in.
6. Category sidebar: Jean Jackets / Underwear / etc. = only that category.
7. Category top tabs = All + the same admin names; tap loads that list.
8. **Just for You** = full catalog. **New In** = newest existing products. **Sale** = products with an active offer.
9. Product **card photos** load (Underwear and others).
10. PDP **small thumbs** load (not an orange blank).
11. Footer unchanged. No Unsplash dummy tiles.

**Code:** Home ViewPager creates a new fragment per tab; bottom nav restores Shop. Category lists use exact `product.category`. Images load with a fixed size + grey placeholder.

## 12. v1.34 — Faster lists and photos

Named tabs were downloading the **whole catalog twice** (offers + products, then a full-collection fallback) and ViewPager was creating extra tabs off-screen. Category screen also fetched the catalog on open before Just for You. Photos decoded at large size with a long hang.

Now: one category query, only the current tab plus one neighbor, no full-catalog fallback, 12s image timeout, smaller decode. Splash **v1.34**.

---

## 13. v1.35 — Shop / Category from a product page

Bottom Shop and Category always open those tabs. They no longer act like Back or do nothing when you are on a product. Faster loading from 1.34 is in this APK too. Splash **v1.35**.

---

## 14. v1.36 — Shop/Category from anywhere + faster catalog

Shop and Category navigate to those tabs from any screen (product, cart, Me). Catalog is cached on the phone and reused so lists can appear immediately; cover photos preload. After the first successful open, later visits should feel about **1 second**. First install still depends on the network for 2500+ products. Splash **v1.36**.

---

## 15. v1.38 — Why the shop felt stuck for minutes (root cause + fix)

**Root cause (not the phone, not Play Store):**

1. Startup downloaded **every product document** (~2500) from Firestore before Home was usable.
2. Product **grids measured every card at once** (`ExpandableRecyclerView` inside a NestedScrollView), so Glide started **dozens of full-size Storage downloads** together.
3. Admin uploaded **original camera JPEGs**. Glide `.override(180, 240)` only resizes **after** the full file is downloaded. One grid of 12 photos at 2–5 MB each is 24–60 MB on mobile data.

**What 1.38 does:**

- Home loads a **12-product shelf** first. The rest of the catalog pages in the background for search.
- Named category tabs use a **recycling** grid (only on-screen photos download).
- Search never pulls the whole collection in one `get()`.
- New/edited admin photos are resized (gallery ≤1080px, card ≤480px). Product edit has **Compress photos for the shop app** so existing items can be shrunk in place.

Splash **v1.38**. Uninstall the old app first. Existing catalog photos stay large until you compress them in admin.
