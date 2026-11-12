# What the Android app must be

**Date:** 2 November 2026  
**Live shop:** https://fancydealsug.com/  
**Do not change the website.** Do not upload shop files for this task.

The phone app must show the **same screens as the mobile website**. It must not show the old Android design.

## Rejected (old APK)

Do not ship or restyle these screens:

- White top bar with “Search products, brands…”
- Small orange square icon instead of the Fancy Deals wordmark
- Left text category list plus “Just for You”
- Bottom bar: Shop, Category, Trends, Me
- Profile page titled “Guest User” with Terms & Policy, WhatsApp Support, and Login rows

That layout is the old app. It is not the website.

## Required

Open the website inside the app so every screen, color, word, and tap matches fancydealsug.com on a phone. Products stay on the same Firebase backend the website already uses. One admin upload updates the site and the app together.

The app icon and the splash must use the website logo (`shop-web/public/brand/fancy-deals-logo-white.png` on the orange header color `#C2410C`). Splash line: **Great products, Fancy prices**.

## Home (mobile)

1. White install strip: small orange logo, **Fancy Deals**, **Shop like a billionaire**, **Incredible deals in Uganda — app & mobile shop**, **Quick install**, blue **Get app**, and an X to close it.
2. Orange header (`#C2410C`): white Fancy Deals wordmark on the left, white cart icon, white person icon.
3. White rounded search field, placeholder **Search Fancy Deals**, black round button with a white magnifying glass.
4. Promo banner under the header. Current slide: dark curtain, **FANCY DEALS UGANDA**, **FREE DELIVERY**, gold **Shop now ›**, two FD suitcases, white pager dots. More than one slide.
5. Green bar: **Why choose Fancy Deals?** plus Secure privacy, Safe payments, Delivery guarantee.
6. Product grid, two columns. Each card: square photo, green **Free shipping** pill, optional discount or “Almost sold out”, one-line title, **UGX** price, sold count, stock line such as **20 pcs in stock**.
7. Fixed white bottom bar, four items: **Home**, **Categories**, **Cart**, **You**. Active item is orange. Cart shows a count badge when it is not empty.
8. The black desktop strip (Free shipping, Best-Selling Items, 5-Star Rated, Mega Sale, New In) is hidden on a phone. Do not put it back on the phone layout.

## Categories

- Same orange header and search stay above the list.
- Left column: full category names that wrap, not cut off with “…”. Examples: Featured, Accessories, Beachwear, Jewelry and Watches, Home and Kitchen, Bags, Women's Clothing, Men's Clothing, Beauty and Personal care, Men's Shoes, Women's Shoes.
- Right side: round photos in two columns, with the full name under each photo (Best sellers, 5-Star picks, Mega sale, New In, Daily deals, and the real subcategories).
- Bottom bar stays. Categories is the active item.

## You

- Title **Your account**.
- Round person placeholder.
- Rows: **Your orders**, **Browsing history**, **Your profile**, **Addresses**, **Coupon codes**, each with its short line underneath.
- **← Back to shop** returns home.
- Bottom bar stays. You is the active item.

## Cart

- Panel titled **Subtotal** with a close X.
- Amount in **UGX**.
- Green line for free shipping when the order qualifies.
- Orange buttons: minimum to checkout, **Proceed to checkout**, **Go to cart**.
- **Keep shopping** and the help line.
- Empty state: **Your cart is empty. Add items from the shop.**

## Product

- Same header, green trust bar, and interest row as the live product page.
- Photo and details in the normal page flow (not a floating overlay).
- Opening a product must not smoothly scroll the list to the top first.
- Mobile photo goes edge to edge.
- Related products sit under the details.
- Closing returns to the same place in the list.

## Rules

- Match the website. Do not invent a second shop layout.
- Do not edit `shop-web` while doing this app work.
- Prices stay in UGX. Words stay the website’s words.
