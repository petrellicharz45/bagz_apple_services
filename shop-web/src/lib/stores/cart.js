import { writable, derived } from "svelte/store";
import { priceParts } from "../catalog.js";

const KEY = "bagz_cart_v1";
export const MIN_CHECKOUT_UGX = 10000;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export const cartItems = writable(read());
export const cartDrawerOpen = writable(false);

cartItems.subscribe((items) => persist(items));

export const cartCount = derived(cartItems, ($items) =>
  $items.reduce((n, line) => n + line.qty, 0)
);

export const cartSubtotal = derived(cartItems, ($items) =>
  $items.reduce((sum, line) => sum + priceParts(line.product).current * line.qty, 0)
);

export function openCartDrawer() {
  cartDrawerOpen.set(true);
}

export function closeCartDrawer() {
  cartDrawerOpen.set(false);
}

export function addToCart(product, qty = 1, options = {}) {
  const size = options.size || "One size";
  const color = options.color || "Default";
  cartItems.update((items) => {
    const idx = items.findIndex(
      (x) => x.productId === product.id && x.size === size && x.color === color
    );
    if (idx >= 0) {
      const next = [...items];
      next[idx] = { ...next[idx], qty: next[idx].qty + qty };
      return next;
    }
    return [
      ...items,
      {
        productId: product.id,
        product,
        qty,
        size,
        color,
        selected: true
      }
    ];
  });
  cartDrawerOpen.set(true);
}

export function updateQty(productId, size, color, qty) {
  cartItems.update((items) =>
    items
      .map((x) =>
        x.productId === productId && x.size === size && x.color === color
          ? { ...x, qty: Math.max(1, qty) }
          : x
      )
      .filter((x) => x.qty > 0)
  );
}

export function removeLine(productId, size, color) {
  cartItems.update((items) =>
    items.filter(
      (x) => !(x.productId === productId && x.size === size && x.color === color)
    )
  );
}

export function toggleSelectAll(selected) {
  cartItems.update((items) => items.map((x) => ({ ...x, selected })));
}

export function setLineSelected(productId, size, color, selected) {
  cartItems.update((items) =>
    items.map((x) =>
      x.productId === productId && x.size === size && x.color === color
        ? { ...x, selected }
        : x
    )
  );
}

/** Remove lines that were checked out (keeps unselected items in cart). */
export function removeSelectedLines() {
  cartItems.update((items) => items.filter((x) => !x.selected));
}
