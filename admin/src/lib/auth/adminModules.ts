export const ADMIN_MODULES = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "products", label: "Products", href: "/products" },
  { id: "categories", label: "Categories", href: "/categories" },
  { id: "subcategories", label: "Subcategories", href: "/subcategories" },
  { id: "banners", label: "Home Banners", href: "/banners" },
  { id: "orders", label: "Orders", href: "/orders" },
  { id: "tickets", label: "Support Tickets", href: "/tickets" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "admin_users", label: "Admin Management", href: "/admin" },
  { id: "settings", label: "Settings", href: "/settings" }
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
] as const;

export function modulesForRole(roleId: string): string[] {
  const role = ADMIN_ROLES.find((r) => r.id === roleId);
  return role?.modules ? [...role.modules] : [];
}

export function formatModulesSummary(modules: string[]): string {
  if (!modules?.length) return "—";
  if (modules.includes("*")) return "All modules";
  return `${modules.length} selected`;
}

export function canAccessModule(modules: string[], moduleId: string): boolean {
  if (!modules?.length) return true;
  if (modules.includes("*")) return true;
  return modules.includes(moduleId);
}

export function moduleLabelForHref(href: string): string {
  if (href === "/") return "dashboard";
  const seg = href.split("/").filter(Boolean)[0];
  const map: Record<string, string> = {
    products: "products",
    categories: "categories",
    subcategories: "subcategories",
    banners: "banners",
    orders: "orders",
    tickets: "tickets",
    notifications: "notifications",
    admin: "admin_users",
    settings: "settings"
  };
  return map[seg] || "dashboard";
}
