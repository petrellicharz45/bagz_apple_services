import { base } from "$app/paths";

/**
 * The admin lives under a sub-path of the shop (https://bagzappleservices.com/admin).
 * App paths in the code are written from the admin's root ("/orders"); `to` adds the sub-path
 * for links and navigation, and `appPath` removes it from the browser address.
 */
export function to(path: string): string {
  if (/^[a-z]+:\/\//i.test(path) || !path.startsWith("/")) return path;
  if (base && (path === base || path.startsWith(`${base}/`))) return path;
  return path === "/" ? base || "/" : `${base}${path}`;
}

export function appPath(pathname: string): string {
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || "/";
  }
  return pathname || "/";
}
