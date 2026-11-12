import * as admin from "firebase-admin";

function buildVariantKey(item: { selectedColorIndex?: number; selectedSize?: string }): string | null {
  const colorIndex = item.selectedColorIndex;
  const size = item.selectedSize;
  if (colorIndex == null || !size) return null;
  return `${colorIndex}-${size}`;
}

export function buildStockUpdates(
  productDoc: FirebaseFirestore.DocumentSnapshot,
  item: { selectedColorIndex?: number; selectedSize?: string },
  delta: number
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    stock: admin.firestore.FieldValue.increment(delta)
  };

  const variantKey = buildVariantKey(item);
  const data = productDoc.data() || {};
  const variantStock = data.variantStock || {};

  if (variantKey && Object.keys(variantStock).length > 0) {
    const current = Number(variantStock[variantKey] ?? 0);
    updates[`variantStock.${variantKey}`] = Math.max(0, current + delta);
  }

  if (item.selectedSize) {
    const sizeStock = data.sizeStock || {};
    const currentSizeStock = Number(sizeStock[item.selectedSize] ?? 0);
    updates[`sizeStock.${item.selectedSize}`] = Math.max(0, currentSizeStock + delta);
  }

  return updates;
}
