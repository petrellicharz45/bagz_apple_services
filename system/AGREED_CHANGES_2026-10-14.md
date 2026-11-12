# Fancy Deals — agreed changes (not coded yet)

**Date:** 14 October 2026  
**Current live test build:** Android **v1.51**  
**APK:** `Luxiva/FancyDeals-1.51.apk`

Named-tab **See more** (scrollable, above bottom nav). Search auto-opens real catalog results. Admin **manual delivery from/to** per product. Centered PIN-wait spinner on checkout. MTN/Airtel prepared; login/stock unchanged.

Shop tab always returns to Home / All (no longer sticks on Category). Category lists query Firestore for up to 100 products instead of a small cache. Forgot-password shows a real message, not `null`. Cart has Keep shopping plus related and recently viewed rows.

Discussed with the owner. Coding starts only when they say so, **one item at a time**.

Login, admin claim, stock rules, and existing payment providers stay as they are unless an item below says otherwise. Mobile-money **PIN API** will be supplied later.

---

## Item 1 — Shop shows many products (fast)

**Shop (`All` tab)**

- Mixture of products from **different** categories.
- About **100** product cards first, then **load more while scrolling** in small batches so the app stays fast.
- Photos load as you scroll (not all 100 full photos at once).
- **Keep** banners, flash sale, and category circles **above** the grid.

**Named tabs** (Jersey, Jean Jackets, Underwear, …)

- **Not** a mixed catalog.
- Jersey = jerseys only. Jean Jackets = jean jackets only.
- Each tab shows **only** products that belong to that category.

---

## Item 2 — Footer

- **Hide** HELP / CHAT / CONTACT / ORDERS / ACCOUNT **for now**.
- Keep bottom tabs (see item 9): **Shop · Category · Trends · Me**.

---

## Item 3 — Category tabs: no big picture, straight to products

When the user taps **Jean Jackets** or any other **named tab**:

- Hide the **wide banner / category photo** at the top.
- Go **straight** to the heading **Best Products**.
- Then the product cards.
- **At least 40** products of **that category only**.
- More on scroll if there are more.

---

## Item 4 — Register password field

The problem is **not** dots vs letters.

On **Let’s Register**, the keyboard covers the lower fields. First Name / Last Name stay visible; **email and password sit under the keyboard**.

**Fix:** the form **scrolls** so the field being typed stays **above the keyboard**. Apply the same idea on Login if it has the same issue.

---

## Item 5 — Cart and checkout (Jumia-style, professional UI)

**Add to cart** on the product (colour / size), then user taps the **top cart icon**.

Screens:

1. **Cart** — items, change quantity, remove, total  
2. **Checkout** — delivery address  
3. **Payment** — MTN / Airtel / card (existing methods)  
4. **Order placed / confirmed**

**Later (owner will give the API):** after confirm, the customer’s **MTN or Airtel** phone gets a **PIN prompt**. PIN is entered on the phone network, not typed inside Fancy Deals. Until the API is provided, build the screens and flow only.

---

## Item 6 — Product page related rows

Under **Add to cart**:

1. **More from this category**  
2. **You may also like**  
3. **Recently viewed** — this phone, even if the user is **not** logged in  

---

## Item 7 — Shop vs Category

- **Shop** always opens Shop (Home / All).  
- **Category** always opens Category.  
- From Category, tapping Shop must **not** stay on Category and must **not** act like Back.  
- Same from a product page, cart, or Me.

---

## Item 8 — Men / Women / Kids / Home Utilities / Accessories / Beauty

Sit **under Free Shipping and Flash Sale** on Home. Tap a group → all products **tagged** with that group.

**Admin (ticks, not free typing)**

- **Type:** existing category (Jersey, Jean Jackets, …) — one type.  
- **Group:** tick one or more of  
  **Men · Women · Kids · Home Utilities · Accessories · Beauty**

A product can have **more than one group** (e.g. Men and Kids).

- Home tab **Jersey** → all jerseys (type).  
- Home button **Men** → every product with Men ticked (any type).  
- No group tick → that product does **not** appear in that group button.

These six groups **must exist on the admin side**.

---

## Item 9 — Trends instead of bottom Cart tab

- Bottom tabs: **Shop · Category · Trends · Me** (Cart tab **removed**).  
- **Top bar cart icon** still opens cart / checkout (item 5).  
- **Trends** = products **created in the last 3 days**, newest first.  
- If nothing is that new → **show older products** (do not leave Trends empty).

---

## Item 10 — Discount countdown (Jumia-style)

Admin chooses per product:

1. **% off + start date + end date** — timer only inside that window.  
2. **% off with no dates** — **unlimited** until admin turns it off or sets an end date.  
3. **% off + end date only** — on now, countdown until end, then normal price.

- **Before start:** show **Starts in …** (do not hide the offer).  
- **During:** countdown on **product cards** (small) **and** on the **product page** (larger bar).  
- When the window ends: discount **stops**. No fake timer.

---

## Item 11 — Wallet (store credit / refunds)

**We are clear.** This is **not** a real bank account. It is **digits the admin sets** in the backend. The user can shop with that credit because the owner **already received** the money on the original order.

### Story (owner’s example)

1. Client is **logged in**. Under **Me** they have **Wallet**.  
2. They order a **phone 50,000 UGX** and a **bag 10,000 UGX**. Total **60,000 UGX**.  
3. They confirm. **60,000 is deducted on their MTN/Airtel line** (real payment).  
4. Owner delivers **only the phone**. Bag is **out of stock**.  
5. Owner **refunds 10,000 UGX into the customer wallet** in admin (not a cash send to the line in v1).  
6. Client can buy anything on Fancy Deals using that **10,000** credit.

### Spending rules

- Next order **equal to or less than** wallet → pay with wallet (no new line charge for that amount).  
- Next order **above** wallet → app says **top up the balance of … UGX**, then **initiate payment on the line** for the **difference only**.  
- Example: wallet 10,000, item 15,000 → tell user to top up **5,000 UGX**, then MTN/Airtel prompt for 5,000.

### v1 limits

- Wallet only after **login**.  
- Shown under **Me**.  
- Balance **UGX**.  
- History of credits (refunds) and spends.  
- **Admin sets / adjusts** the customer wallet in the backend.  
- **No withdraw** to MTN/Airtel in v1.  
- Not “real money in a bank”; it is **shop credit** for goods already paid to the owner.

---

## Build order (when coding starts)

Do **one item at a time**, test, then the next:

1. Item 7 — Shop vs Category (if still wrong on the phone)  
2. Item 4 — Register keyboard / password visible  
3. Item 3 — Named tabs: no banner, Best Products, ≥40  
4. Item 1 — Shop All 100 + scroll more  
5. Item 2 — Hide footer  
6. Item 8 — Admin groups + Home six buttons  
7. Item 10 — Offer start/end + Starts in + timers  
8. Item 9 — Trends tab  
9. Item 6 — Product related rows  
10. Item 5 — Cart UI (PIN API when provided)  
11. Item 11 — Wallet  

PIN API and any extra payment docs wait until the owner sends them.

---

## Out of scope until asked

- Wallet cash-out to the phone line  
- Automatic refund without admin typing the amount  
- Play Store listing  
- Changing login / admin-claim security
