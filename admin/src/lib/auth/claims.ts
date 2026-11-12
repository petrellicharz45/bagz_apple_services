import { PUBLIC_DEV_ADMIN_EMAILS } from "$env/static/public";

export const isAdminClaim = (claims: Record<string, unknown>) => {
  return claims.admin === true;
};

const LOCAL_DEV_ADMIN_EMAILS = [
  "directorac162@gmail.com",
  "ssempijjadickson@gmail.com"
];

const envAdminEmails = (PUBLIC_DEV_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Emails listed in PUBLIC_DEV_ADMIN_EMAILS at build time (bootstrap / demo hosting). */
export const isBootstrapAdminEmail = (email: string | null | undefined) => {
  if (!email || envAdminEmails.length === 0) return false;
  return envAdminEmails.includes(email.trim().toLowerCase());
};

export const isDevAdminEmail = (email: string | null | undefined) => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (isBootstrapAdminEmail(normalized)) return true;
  if (!import.meta.env.DEV) return false;
  return LOCAL_DEV_ADMIN_EMAILS.includes(normalized);
};
