export const ADMIN_MODULE_IDS = [
  "dashboard",
  "products",
  "categories",
  "subcategories",
  "banners",
  "orders",
  "tickets",
  "notifications",
  "admin_users",
  "settings"
] as const;

export const ADMIN_ROLES = [
  { id: "super_admin", label: "Super Admin", modules: ["*"] },
  {
    id: "catalog_manager",
    label: "Catalog manager",
    modules: ["dashboard", "products", "categories", "subcategories", "banners"]
  },
  {
    id: "orders_support",
    label: "Orders & support",
    modules: ["dashboard", "orders", "tickets"]
  },
  {
    id: "marketing",
    label: "Marketing",
    modules: ["dashboard", "banners", "notifications"]
  },
  { id: "custom", label: "Custom (pick modules)", modules: [] as string[] }
];

export function normalizeModules(modules: unknown, role: string): string[] {
  if (role === "super_admin") return ["*"];
  const list = Array.isArray(modules)
    ? modules.filter((m): m is string =>
        ADMIN_MODULE_IDS.includes(m as (typeof ADMIN_MODULE_IDS)[number])
      )
    : [];
  if (list.length) return list;
  if (role === "catalog_manager") {
    return ["dashboard", "products", "categories", "subcategories", "banners"];
  }
  if (role === "orders_support") return ["dashboard", "orders", "tickets"];
  if (role === "marketing") return ["dashboard", "banners", "notifications"];
  return ["dashboard", "products"];
}
