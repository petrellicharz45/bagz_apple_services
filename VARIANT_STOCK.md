# Fancy Deals — Stock Management System

## Overview

Fancy Deals tracks product inventory at three levels:

1. **Total Stock** (`stock`) — A single number for products with no sizes/colors
2. **Per-Size Stock** (`sizeStock`) — Stock per size (e.g., S=5, M=3, L=0)
3. **Variant Stock** (`variantStock`) — Stock per color×size combo (e.g., Red-S=5, Blue-M=7)

These three levels form a **fallback chain**. The system always tries the most specific level first:

```
variantStock["0-S"] → sizeStock["S"] → stock
```

If a product doesn't have variant stock, it falls back to size stock. If it doesn't have size stock, it falls back to total stock. This means all existing products work without any changes.

---

## Stock Levels Explained

### Level 1: Total Stock (`stock`)

The simplest form. One number for the entire product.

**When to use:** Products with no sizes and no colors (e.g., a phone case, a book).

**Firestore data:**
```json
{
  "stock": 50
}
```

**Android behavior:** "Out of Stock" shows when `stock` reaches 0. Quantity in cart cannot exceed `stock`.

---

### Level 2: Per-Size Stock (`sizeStock`)

Stock tracked per size. The total `stock` is still saved as a fallback.

**When to use:** Products with sizes but no colors (e.g., a t-shirt in S/M/L, all same color).

**Firestore data:**
```json
{
  "sizes": ["S", "M", "L"],
  "stock": 15,
  "sizeStock": { "S": 5, "M": 7, "L": 3 }
}
```

**Admin dashboard:** When you enter sizes but no colors, a "Stock per Size" field appears. Enter comma-separated values (e.g., `5,7,3` for S=5, M=7, L=3).

**Android behavior:**
- Sizes with 0 stock appear greyed out with a strikethrough
- "Out of Stock" button uses `getStockForSize(size)`
- Cart quantity limit uses the per-size stock

---

### Level 3: Variant Stock (`variantStock`) — Color × Size

The most granular level. Stock tracked for every color+size combination.

**When to use:** Products with both colors AND sizes (e.g., a red t-shirt in S/M/L AND a blue t-shirt in S/M/L).

**Firestore data:**
```json
{
  "colors": [-65536, -16776961],
  "sizes": ["S", "M", "L"],
  "stock": 17,
  "sizeStock": { "S": 5, "M": 10, "L": 2 },
  "variantStock": {
    "0-S": 5, "0-M": 3, "0-L": 0,
    "1-S": 0, "1-M": 7, "1-L": 2
  }
}
```

**Key format:** `"colorIndex-sizeName"`
- `0` = first color (Red), `1` = second color (Blue)
- `S`, `M`, `L` = size names
- So `"0-S"` = Red Small, `"1-M"` = Blue Medium

**Admin dashboard:** When you enter both colors AND sizes, a checkbox appears: "Track stock per color × size variant". Check it to reveal a matrix table where you enter stock for each combination.

**Android behavior:**
- Customer picks a color first → the app filters sizes based on that color's stock
- Sizes with 0 stock for the selected color appear greyed out
- Cart and checkout respect the variant stock limit

---

## How Stock Is Created

### Via Admin Dashboard (Web)

Products are **only** created through the web admin dashboard at `https://luxiva-dev.web.app`.

1. Go to **Products → New Product**
2. Fill in name, category, price, images
3. Enter **sizes** (optional, comma-separated: `S,M,L`)
4. Enter **colors** (optional, comma-separated hex: `#FF0000,#00FF00`)
5. Enter **Total Stock** (fallback number)
6. If sizes only → **Stock per Size** field appears
7. If colors + sizes → **Variant Stock** matrix appears (after checking the checkbox)
8. Click **Save Product**

**What gets saved:**
- `stock` = the total stock number you entered
- `sizeStock` = per-size values (if you entered them)
- `variantStock` = per color×size values (if you entered them)

### Via Admin Dashboard (Edit)

1. Go to **Products** → click a product
2. Modify stock values in any of the three fields
3. Click **Save Changes**

---

## How Stock Is Displayed (Android App)

### Product Details Screen

1. **Color selection:** Colors appear as circles. Tapping a color updates the sizes list.
2. **Size selection:** Sizes appear as chips.
   - If variant stock exists: sizes with 0 stock for the selected color are greyed out with strikethrough
   - If only size stock exists: sizes with 0 stock are greyed out
   - If only total stock exists: all sizes show, "Out of Stock" if stock = 0
3. **Add to Cart button:**
   - Shows "Out of Stock" if the current selection has 0 stock
   - Shows "Remove" if the item is already in the cart
   - Shows "Add to Cart" otherwise

### Cart Screen

- Each item shows the selected color (as a colored circle) and size
- **+** button: Increases quantity. Stops at the stock limit with error "Max stock reached (N)"
- **-** button: Decreases quantity. At 0, the item is removed from cart
- Guest users (not logged in) have the same limits

### Checkout (Billing Screen)

- Shows all cart items with their color/size
- "Place Order" button triggers a Firestore transaction that validates stock
- If any item has insufficient stock, the order fails with: "Not enough stock for [product name] (size [size]). Only [N] left."

---

## How Stock Is Deducted

Stock is deducted **when an order status changes to an active state**, NOT when the order is placed.

### Active Order Statuses

An order is considered "active" when its status is:
- **Confirmed**
- **Shipped**
- **Delivered**

### Deduction Flow

When an admin changes an order from Pending → Confirmed (or any non-active → active):

1. The cloud function `adminUpdateOrderStatus` runs
2. For each product in the order:
   - `stock` is decremented by the ordered quantity
   - `sizeStock[size]` is decremented (if size exists)
   - `variantStock["colorIdx-size"]` is decremented (if variant stock exists)
3. All three levels are updated simultaneously

**Example:** Customer orders 2× Red-M (variant stock key `"0-M"`):
- Before: `stock=17`, `sizeStock["M"]=10`, `variantStock["0-M"]=3`
- After: `stock=15`, `sizeStock["M"]=8`, `variantStock["0-M"]=1`

### Manual Payment Confirmation

When an admin confirms a manual payment (`adminConfirmManualPayment`):
- Same deduction logic applies
- Order is set to Confirmed + Paid

---

## How Stock Is Restored

Stock is restored when an active order is moved back to a non-active status (e.g., Rejected, Cancelled).

### Restoration Flow

When an admin changes an order from Confirmed → Rejected:

1. The cloud function `adminUpdateOrderStatus` runs
2. For each product in the order:
   - `stock` is incremented back
   - `sizeStock[size]` is incremented back
   - `variantStock["colorIdx-size"]` is incremented back
3. All three levels are restored

**Example:** The 2× Red-M order is rejected:
- Before: `stock=15`, `sizeStock["M"]=8`, `variantStock["0-M"]=1`
- After: `stock=17`, `sizeStock["M"]=10`, `variantStock["0-M"]=3`

---

## Order Status Transitions and Stock Impact

| From | To | Stock Impact |
|------|-----|-------------|
| Pending | Confirmed | **Deduct** stock |
| Pending | Shipped | **Deduct** stock |
| Pending | Delivered | **Deduct** stock |
| Confirmed | Rejected | **Restore** stock |
| Confirmed | Cancelled | **Restore** stock |
| Shipped | Rejected | **Restore** stock |
| Delivered | Rejected | **Restore** stock |
| Pending | Rejected | No change (never deducted) |
| Pending | Cancelled | No change (never deducted) |

**Key rule:** Stock is only deducted when moving INTO an active state. Stock is only restored when moving OUT of an active state. Moving between active states (e.g., Confirmed → Shipped) does NOT double-deduct.

---

## Product Types and Stock Behavior

### Product with No Sizes, No Colors

- Uses `stock` only
- "Out of Stock" when `stock` = 0
- Cart quantity limit = `stock`

### Product with Sizes, No Colors

- Uses `sizeStock[size]` with `stock` as fallback
- Each size has its own stock
- Sizes with 0 stock are greyed out
- Cart quantity limit = `sizeStock[selectedSize]`

### Product with Colors, No Sizes

- Colors are for display only (no stock per color)
- Uses `stock` for quantity limit
- No variant stock needed

### Product with Colors AND Sizes

- Uses `variantStock["colorIdx-size"]` with `sizeStock[size]` and `stock` as fallbacks
- Each color+size combo has its own stock
- Sizes are filtered based on selected color
- Cart quantity limit = `variantStock[selectedColorIdx-size]`

---

## Guest Cart (Not Logged In)

Guest users have the same stock management as logged-in users:

- Products are stored locally in `GuestCart`
- Stock limits are checked using the same `getStockForVariant()` / `getStockForSize()` / `stock` fallback chain
- Guest cart items are lost if the app is cleared (not synced to Firestore)
- When a guest logs in, they can add items to their Firestore cart

---

## Image Handling

### Upload Format

The admin dashboard converts all uploaded images to **JPEG** before saving to Firebase Storage. This prevents AVIF format issues with Glide on certain Android devices.

### Storage

Images are stored at `product/images/{uuid}` in Firebase Storage.

### Display

- Product cards show the first image (`images[0]`)
- Product details shows all images in a ViewPager with fullscreen zoom
- Glide loads images with error logging (`LuxivaGlide` tag)

---

## How to Test Stock Management

### Test 1: Create a Simple Product (No Sizes, No Colors)

1. Go to **Products → New Product**
2. Enter name, category, price, images
3. Enter **Total Stock:** 10
4. Do NOT enter sizes or colors
5. Save
6. Open in Android app → verify "Add to Cart" works
7. Add 10 to cart → verify 11th item is blocked

### Test 2: Create a Product with Sizes Only

1. Go to **Products → New Product**
2. Enter **Sizes:** `S,M,L`
3. Enter **Stock per Size:** `5,3,0`
4. Enter **Total Stock:** 8
5. Save
6. Open in Android app → verify **L** is greyed out
7. Select **S** → add 5 to cart → verify 6th is blocked

### Test 3: Create a Product with Colors + Sizes + Variant Stock

1. Go to **Products → New Product**
2. Enter **Colors:** `#FF0000,#00FF00`
3. Enter **Sizes:** `S,M,L`
4. Enter **Total Stock:** 17
5. Check **"Track stock per color × size variant"**
6. Enter stock: Red-S=5, Red-M=3, Red-L=0, Green-S=0, Green-M=7, Green-L=2
7. Save
8. Open in Android app
9. Select **Red** → verify **L** is greyed out (stock=0)
10. Select **Green** → verify **S** is greyed out (stock=0)
11. Add **Red-M** × 3 to cart → verify 4th is blocked

### Test 4: Order Stock Deduction

1. Place an order with **Red-M** × 2
2. Go to admin → Orders → change status to **Confirmed**
3. Go to product edit page → verify:
   - `variantStock["0-M"]` = 1 (was 3)
   - `sizeStock["M"]` = 8 (was 10)
   - `stock` = 15 (was 17)

### Test 5: Order Cancellation Restores Stock

1. Change the order from **Confirmed** → **Rejected**
2. Go to product edit page → verify:
   - `variantStock["0-M"]` = 3 (restored)
   - `sizeStock["M"]` = 10 (restored)
   - `stock` = 17 (restored)

### Test 6: Backward Compatibility

1. Find an old product (created before variant stock feature)
2. Open in Android app
3. Verify sizes work with `sizeStock` or `stock` fallback
4. Add to cart and verify quantity limits

### Test 7: Guest Cart Limits

1. Log out of the app
2. Browse a product with variant stock
3. Add to cart with specific color+size
4. Verify quantity limits work the same as logged-in users

### Test 8: Checkout Validation

1. Add items to cart
2. Go to checkout
3. In another tab, set the product's variant stock to 0
4. Place the order → verify it fails with "Not enough stock" error

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Sizes don't filter by color | Product has no `variantStock` | Edit product, enable variant stock, save |
| "Out of Stock" shows incorrectly | Variant stock is 0 for that combo | Edit product, update stock for that combo |
| Stock not deducting on order | Cloud function not updated | Run `firebase deploy --only functions` |
| Old products broken | Should not happen — fallback exists | Check that `sizeStock` and `stock` are set |
| Cart allows more than stock | Using old app version | Rebuild app with latest code |
| Guest cart lost on app close | Guest cart is local only | Expected behavior — log in to persist |
| Images not loading | AVIF format issue | Re-upload images from admin (auto-converts to JPEG) |

---

## Technical Details

### Firestore Schema (Products Collection)

```
product/{productId}
├── id: string
├── name: string
├── nameLowercase: string
├── category: string
├── price: number
├── offerPercentage: number | null
├── description: string | null
├── colors: number[] | null          // Android color ints
├── sizes: string[] | null           // ["S", "M", "L"]
├── images: string[]                 // Firebase Storage URLs
├── stock: number                    // Total fallback stock
├── sizeStock: Map<string, number>   // {"S": 5, "M": 3}
├── variantStock: Map<string, number> // {"0-S": 5, "1-M": 7}
├── special: boolean
├── rating: number | null
└── reviewsCount: number
```

### Cloud Functions

| Function | Trigger | Stock Impact |
|----------|---------|-------------|
| `adminUpdateOrderStatus` | Admin changes order status | Deducts/restores stock |
| `adminConfirmManualPayment` | Admin confirms manual payment | Deducts stock |
| `nylonPayCollect` | Customer pays via Nylon Pay | Deducts stock (via status change) |

### Android Key Classes

| File | Role |
|------|------|
| `Product.kt` | Data model with `getStockForVariant()` and `getStockForSize()` |
| `CartProduct.kt` | Cart item with `selectedColorIndex` for variant key |
| `SizesAdapter.kt` | Size chips with variant stock filtering |
| `ProductDetailsFragment.kt` | Color/size selection, stock checks |
| `DetailsViewModel.kt` | Add-to-cart with variant stock limits |
| `CartViewModel.kt` | Cart quantity limits with variant stock |
| `OrderViewModel.kt` | Checkout validation with variant stock |
