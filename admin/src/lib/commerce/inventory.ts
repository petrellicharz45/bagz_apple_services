export type InventoryRow = {
  id: string;
  name: string;
  stock: number;
  category?: string;
  image?: string;
  baseline: number;
  stockPct: number;
  band: "high" | "medium" | "low" | "out";
};

/** Baseline for “70% depleted” = stock at or below 30% of baseline (default baseline 10+). */
export function productStockBaseline(product: Record<string, unknown>): number {
  const explicit = Number(product.stockBaseline ?? product.restockLevel ?? 0);
  if (explicit > 0) return explicit;
  const stock = Number(product.stock ?? 0);
  return Math.max(stock, 10);
}

export function stockPercentRemaining(product: Record<string, unknown>): number {
  const baseline = productStockBaseline(product);
  const stock = Number(product.stock ?? 0);
  if (baseline <= 0) return stock > 0 ? 100 : 0;
  return Math.min(100, Math.round((stock / baseline) * 100));
}

export function isLowStockAlert(product: Record<string, unknown>): boolean {
  const stock = Number(product.stock ?? 0);
  if (stock <= 0) return true;
  return stockPercentRemaining(product) <= 30;
}

export function toInventoryRow(product: Record<string, unknown> & { id: string }): InventoryRow {
  const stock = Number(product.stock ?? 0);
  const baseline = productStockBaseline(product);
  const stockPct = stockPercentRemaining(product);
  let band: InventoryRow["band"] = "high";
  if (stock <= 0) band = "out";
  else if (stockPct <= 30) band = "low";
  else if (stockPct <= 60) band = "medium";
  return {
    id: product.id,
    name: String(product.name || "Product"),
    stock,
    category: String(product.category || ""),
    image: (product.images as string[])?.[0],
    baseline,
    stockPct,
    band
  };
}
