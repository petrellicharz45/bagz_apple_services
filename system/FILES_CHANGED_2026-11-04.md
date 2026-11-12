# Files changed — 4 November 2026

Website in a normal browser stays the same except the items below. Do not upload `functions/.env` (Pesapal keys, private).

## Profile photo on a phone

- `shop-web/src/components/AccountSectionView.svelte`
- `shop-web/src/lib/avatarImage.js`
- `app/src/main/java/com/carthigan/luxiva/ui/activities/WebShopActivity.kt` (photo picker inside the Android app)

## Get app strip

Hidden only when the Android app opens the site. Still visible in a browser.

- `shop-web/src/components/TemuHeader.svelte`
- `app/src/main/java/com/carthigan/luxiva/ui/activities/WebShopActivity.kt`

## Google / SEO

Live address is fancydealsug.com. Sitemap and canonical were pointing at fancydeals.ug.

- `shop-web/index.html`
- `shop-web/public/robots.txt`
- `shop-web/public/sitemap.xml`
- `shop-web/scripts/patch-seo-files.mjs`
- `shop-web/src/lib/productShare.js`

## Card fields and Pesapal

Card number, expiry, security code, and name on the card are on checkout. The card number is not saved. Pesapal sandbox keys are only in `functions/.env`.

- `shop-web/src/components/CheckoutPage.svelte`
- `functions/.env` (private, do not upload)
