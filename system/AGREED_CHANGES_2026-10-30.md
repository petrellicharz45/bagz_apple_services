# Fancy Deals — agreed changes (not coded yet)

**Date:** 30 October 2026
**Applies to:** the **website** only (`fancydealsug.com`, code in `shop-web/`) and the **admin panel** (`admin/`). The Android app is not part of this round.
**Reference:** Temu (temu.com) on desktop and mobile. Where this file says "like Temu", copy Temu's layout and wording.

Coding starts only when the owner says the list is finished. Then **one change at a time**, and the owner tests it before the next one.

---

## Change 1 — Product page: remove the left small photos

**Desktop and mobile website.**

- **Remove** the column of small photos on the **left side** of the big product photo.
- **Keep** the option photos (today labelled Brown / Gray / Black):
  - Desktop: on the right side, next to the big photo.
  - Mobile: below the big photo.
- These option photos become the photos named in the admin (see Change 4).
- Option photos show **only the photo**: no "Color:" label, no word under the photo.
- By default the page shows the **first photo uploaded** in the admin, with its name.
- **Desktop:** **hovering** the mouse over a small photo shows it as the big picture straight away (no click needed).
- **Mobile:** the customer **taps** the small photo.
- When a small photo is chosen, **its name shows in the Description section, below the normal description text**:

```
Description
  Soft cotton, round neck,
  machine washable...
  Red Versace T shirt        ← name of the chosen photo
```

**Mobile — "Explore your interests":**
- It appears **twice**: once **above** the product title and again **further down** the page.
- **Remove the top one**, keep the one further down.

---

## Change 2 — Bigger photos and text, like Temu

**Product cards** (Home, Categories, search results):
- Bigger, square photos. Desktop about **5 cards per row**, like Temu.
- Product name on **one line**, cut with "…".
- **Large, bold price**, "sold" count beside it, cart button on the right.

**Product page:**
- **Desktop:** big main photo on the left; larger title, large price, larger size boxes on the right — same sizes as Temu.
- **Mobile:** the photo fills the **full width** of the screen; text sizes like Temu.
- Replace the dots under the photo with a **"1/18" counter** in the corner of the photo, like Temu.

---

## Change 3 — Tap the photo to open it full screen

**Mobile (copy Temu):**
- Black background, photo in the middle.
- **X** top-left, **"2/7" counter** top-centre, **share** icon top-right.
- Label on the photo with its name, e.g. "Items: Red Versace T shirt" (the name typed in the admin).
- Round **Cart** icon and orange **"Add to cart"** button at the bottom.
- **Swipe** left and right to see all the product's photos.

**Desktop (copy Temu, but bigger photo):**
- Dark see-through background over the page.
- **X** top-right.
- Strip of small photos on the **left** (inside the full-screen view only).
- **‹ ›** arrows left and right to move between photos.
- Label with the photo's name.
- Photo **bigger than Temu's** — fills most of the screen height.

**"Add to cart" before a size is chosen — opens a picker (copy Temu):**

- **Desktop:** a white box over the page.
  - Left: big photo with ‹ › arrows, row of small photos underneath.
  - Right: option photos **with their names underneath**, sizes with red **"Please select size!"**, **Service/Benefits — FREE SHIPPING**, **Qty**, orange **"Select an option"** button.
  - **X** top-right to close.
- **Mobile:** a panel slides up from the bottom.
  - Orange header bar (e.g. "BIG SALE") with **X**.
  - Small summary: photo, name, price, old price crossed out, "% OFF".
  - Option photos **with names underneath**, sizes, **Service/Benefits — FREE SHIPPING**, **Qty − 1 +**, orange **"Select an option"** button.
  - Once a size is picked, the button adds to cart.

---

## Change 4 — Admin: name each photo (replaces colours)

- When uploading a product, **each photo gets its own name field**. Example for one product:
  - Photo 1 → "Black Versace T shirt"
  - Photo 2 → "Red Versace T shirt"
  - …and so on for every photo of that product.
- These named photos are the option photos on the product page (Change 1) and in the picker (Change 3).
- **Search:** typing a photo name (e.g. "Black Versace T shirt" or "Red Versace T shirt") must find that product.
- **Hide** the current colour tools in the admin (colour picker, named colours, Add Color). They are no longer used.

---

## Safety rules — do not break the existing system

- **Restore point first:** commit the current code before coding starts, so any change can be rolled back.
- **Add, don't remove:** photo names are a **new field** on the product. Existing `colors`, `colorLabels`, `colorImageIndices`, `stock`, `sizeStock` and `variantStock` stay untouched in Firestore.
- **Hide, don't delete:** the admin colour tools are hidden only. The Android app and the stock functions (`functions/src/stockUtil.ts`) still use colour data for per-colour stock.
- **Old products keep working:** a product with no photo names falls back to today's display.
- **Do not touch:** login, checkout, payments (MTN/Airtel), stock deduction, orders, the Android app, Cloud Functions.
- **Build check:** website and admin must build cleanly before each change is handed over for testing.

---

## Hand-over after each change

After each change is coded and builds cleanly, the owner receives:

1. **List of files changed** (what each file does, in plain words).
2. **Upload packages** ready for Hostinger:
   - **Website:** `deploy/hostinger/packages/fancydeals-shop-upload.zip` from `npm run build:hostinger` (upload + extract into `public_html`, see `deploy/hostinger/SHOP_DEPLOY.md`).
   - **Admin** (only when the admin changed): the admin build zip for the admin subdomain.
3. **Test steps** for that change.

---

## Decisions

- Photo name shows **below** the normal description text (not replacing it).
- **Website first.** The Android app gets the same changes **later**, after the website is done.

---

## Build order and status

Order: **4 → 1 → 2 → 3**, one at a time.

| Change | Status |
|---|---|
| 4 — Photo names in admin + search | **Passed owner's local test 30 Oct 2026** (git `83fad76`, `a38ea4e` row layout) |
| 1 — Product page photos | **Coded 30 Oct 2026 — owner testing** (cart/order/search show the chosen photo + name; search results now refilter while typing) |
| 2 — Temu sizes | **Coded 30 Oct 2026 — waiting for owner test** (git `c1685fa`) |
| 3 — Full-screen photo + picker | **Passed owner's local test 30 Oct 2026** |
| 5 — Website orders saved to the admin | **Code done; paused by owner 30 Oct 2026 — resume 31 Oct.** No Cloud Functions are deployed on `fancydeals-ug`, and this PC is not logged in to Firebase. Paid and attempted orders are resent automatically once the function is live. |

**Change 5 — where to resume (31 Oct):**
1. Project firebase-tools is 13.29.1 (too old — Google login is rejected with "credentials are no longer valid"). Latest 15.34.2 is already in the npx cache.
2. In Command Prompt from `D:\projects\luxiva\Luxiva`:
   `node node_modules\firebase-tools\lib\bin\firebase.js logout` then `npx firebase-tools@latest login --reauth` (Google account that owns `fancydeals-ug`).
3. `cd functions && npm.cmd run build && cd ..` then
   `npx firebase-tools@latest deploy --only functions:shopCreateWebOrder,functions:shopDeductCatalogStock`
4. If it asks for the Blaze plan: upgrade in Firebase console → Usage and billing.
5. Check: `https://us-central1-fancydeals-ug.cloudfunctions.net/shopCreateWebOrder` no longer returns 404; open the shop once in the test browser; orders appear in Admin → Orders.

**Source files changed so far** (all included in the upload zips — the zips are built from these):

| Area | File |
|---|---|
| Admin | `admin/src/lib/products/photoNames.ts` (new) |
| Admin | `admin/src/routes/products/new/+page.svelte` |
| Admin | `admin/src/routes/products/[id]/+page.svelte` |
| Admin | `admin/src/routes/products/bulk/+page.svelte` |
| Website | `shop-web/src/App.svelte` |
| Website | `shop-web/src/components/ProductDetail.svelte` |
| Website | `shop-web/src/components/ProductCard.svelte` |
| Website | `shop-web/src/components/CategoryBrowseView.svelte` (5 columns) |
| Website | `shop-web/src/components/CheckoutPage.svelte` (5 columns in "More products" only) |
| Website | `shop-web/src/lib/search.js` |
| Website | `shop-web/src/lib/productPhotos.js` |
| Website | `shop-web/src/lib/orders.js` (Change 5 — send + resend orders to admin) |
| Website | `shop-web/src/components/PhotoViewer.svelte` (new — Change 3 full screen) |
| Website | `shop-web/src/components/OptionPicker.svelte` (new — Change 3 picker) |
| Website | `shop-web/src/components/TemuIcon.svelte` (share icon) |
| Admin | `admin/src/routes/orders/+page.svelte` (status column) |
| Admin | `admin/src/routes/orders/[id]/+page.svelte` (photo name in Color column) |
| Backend | `functions/src/webOrders.ts` (new — `shopCreateWebOrder`) |
| Backend | `functions/src/orderStock.ts` (marks order `stockDeducted`) |
| Backend | `functions/src/index.ts` (exports the new function) |

**Backend deploy (Firebase, not Hostinger)** — deploy only these two functions, so other
undeployed local backend code is not pushed by accident:

```
cd /d D:\projects\luxiva\Luxiva\functions
npm.cmd run build
cd ..
node node_modules\firebase-tools\lib\bin\firebase.js deploy --only functions:shopCreateWebOrder,functions:shopDeductCatalogStock
```

Hostinger does not take source files: upload **`deploy/hostinger/packages/fancydeals-shop-upload.zip`** (website) and the **admin zip** built at the end.

**Raised during testing:**
- Website orders were saved only in the customer's browser → now **Change 5** (agreed 30 Oct 2026).
- Categories menu: Jewelry and Accessories have no subcategories in Admin → Subcategories, so the menu shows one "Shop Jewelry" tile with a broken category photo.

**Change 4 technical notes:** new product field `imageNames` (array, same order as `images`, `""` = no name). Colour tools hidden with `SHOW_COLOR_TOOLS = false` in `admin/src/lib/products/photoNames.ts`. On the edit page, products that already have colours keep them, and their colour × size stock table stays visible so stock can still be edited.
