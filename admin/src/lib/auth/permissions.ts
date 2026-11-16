/**
 * Staff roles and permissions.
 *
 * Every staff member has a Firestore document staff/{uid}: { name, email, role, perms, active }.
 * `perms` maps each module below to "none" | "view" | "edit". Firestore rules (firebase/firestore.rules)
 * enforce the same map, so hiding a page here is only a convenience; the database is what says no.
 *
 * The owner account (Firebase custom claim admin:true) and staff with the "admin" role can do
 * everything, including adding and removing users.
 */

export type Level = "none" | "view" | "edit";
export type Perms = Record<string, Level>;

export const LEVELS: { id: Level; label: string }[] = [
  { id: "none", label: "No access" },
  { id: "view", label: "View only" },
  { id: "edit", label: "View & edit" }
];

export const MODULES = [
  {
    id: "products",
    label: "Products & stock",
    pages: "Products, Inventory, Wrong product info",
    hrefs: ["/products", "/inventory", "/product-reports"]
  },
  {
    id: "catalog",
    label: "Categories",
    pages: "Categories, Subcategories, Groups",
    hrefs: ["/categories", "/subcategories", "/groups"]
  },
  { id: "orders", label: "Orders & customers", pages: "Orders, customer details", hrefs: ["/orders"] },
  { id: "sales", label: "Sales reports", pages: "Sales", hrefs: ["/sales"] },
  { id: "tickets", label: "Support tickets", pages: "Support Tickets", hrefs: ["/tickets"] },
  {
    id: "marketing",
    label: "Marketing",
    pages: "Home banners, Pop-ups, Social links, SEO, Push broadcasts",
    hrefs: ["/banners", "/popups", "/social-links", "/seo", "/push-notifications"]
  },
  {
    id: "settings",
    label: "Shop settings",
    pages: "Settings, Delivery fees, System insights (activity log)",
    hrefs: ["/settings", "/delivery-fees", "/system-insights"]
  }
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

const all = (level: Level): Perms => Object.fromEntries(MODULES.map((m) => [m.id, level]));

export const ROLES: { id: string; label: string; description: string; perms: Perms }[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Everything, including adding users, changing roles and shop settings.",
    perms: all("edit")
  },
  {
    id: "manager",
    label: "Manager",
    description: "Runs the shop day to day: products, categories, orders, support and marketing. Sees sales and settings.",
    perms: {
      products: "edit",
      catalog: "edit",
      orders: "edit",
      sales: "view",
      tickets: "edit",
      marketing: "edit",
      settings: "view"
    }
  },
  {
    id: "finance",
    label: "Finance",
    description: "Confirms payments on orders and follows sales. Sees products and prices.",
    perms: {
      products: "view",
      catalog: "none",
      orders: "edit",
      sales: "view",
      tickets: "none",
      marketing: "none",
      settings: "none"
    }
  },
  {
    id: "sales",
    label: "Sales person",
    description: "Handles orders and customer support. Sees products, prices and stock.",
    perms: {
      products: "view",
      catalog: "none",
      orders: "edit",
      sales: "none",
      tickets: "edit",
      marketing: "none",
      settings: "none"
    }
  }
];

export function roleById(id: string) {
  return ROLES.find((r) => r.id === id);
}

export function roleLabel(id: string) {
  return roleById(id)?.label || "Custom";
}

export function presetPerms(roleId: string): Perms {
  return { ...(roleById(roleId)?.perms || all("none")) };
}

/** Keep only known modules and levels (anything else becomes "none"). */
export function cleanPerms(raw: unknown): Perms {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    MODULES.map((m) => {
      const v = src[m.id];
      return [m.id, v === "view" || v === "edit" ? v : "none"];
    })
  );
}

/** True when the permissions differ from the role's defaults. */
export function isCustomised(roleId: string, perms: Perms) {
  const preset = roleById(roleId)?.perms;
  if (!preset) return true;
  return MODULES.some((m) => (perms[m.id] || "none") !== (preset[m.id] || "none"));
}

export type Access = {
  /** "owner" = Firebase admin claim (or bootstrap email); "staff" = staff/{uid} document. */
  kind: "owner" | "staff";
  role: string;
  name: string;
  perms: Perms;
};

export function ownerAccess(name: string): Access {
  return { kind: "owner", role: "admin", name, perms: all("edit") };
}

/** Owners and staff with the Admin role can do everything, including managing users. */
export function isFullAdmin(access: Access | null) {
  return Boolean(access && (access.kind === "owner" || access.role === "admin"));
}

export function levelFor(access: Access | null, moduleId: string): Level {
  if (!access) return "none";
  if (isFullAdmin(access)) return "edit";
  if (moduleId === "staff") return "none";
  return access.perms[moduleId] || "none";
}

/**
 * Which module a page belongs to. null = every staff member (Dashboard, Notifications, own account).
 * `path` is the app path without the /admin prefix.
 */
export function moduleForPath(path: string, search = ""): string | null {
  if (path === "/" || path === "/notifications" || path.startsWith("/notifications/")) return null;
  // Everyone may open their own account tab (photo, email, password).
  if (path === "/settings" && new URLSearchParams(search).get("tab") === "account") return null;
  if (path === "/admin" || path.startsWith("/admin/")) return "staff";
  for (const m of MODULES) {
    if (m.hrefs.some((h) => path === h || path.startsWith(`${h}/`))) return m.id;
  }
  return null;
}

export function pageLevel(access: Access | null, path: string, search = ""): Level {
  const mod = moduleForPath(path, search);
  return mod === null ? (access ? "edit" : "none") : levelFor(access, mod);
}

export function permsSummary(access: { role: string; perms: Perms }): string {
  if (access.role === "admin") return "Everything";
  const edit = MODULES.filter((m) => access.perms[m.id] === "edit").map((m) => m.label);
  const view = MODULES.filter((m) => access.perms[m.id] === "view").map((m) => m.label);
  const parts = [];
  if (edit.length) parts.push(`Edits: ${edit.join(", ")}`);
  if (view.length) parts.push(`Views: ${view.join(", ")}`);
  return parts.join(" · ") || "No pages";
}
