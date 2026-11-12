import { HttpsError } from "firebase-functions/v2/https";

function devAdminEmails(): string[] {
  return (process.env.DEV_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const assertAdmin = (context: {
  auth?: { token?: Record<string, unknown> };
}) => {
  const token = context.auth?.token;
  const isAdmin = token?.admin === true;
  const email = String(token?.email || "").trim().toLowerCase();
  const devOk = email && devAdminEmails().includes(email);
  if (!isAdmin && !devOk) {
    throw new HttpsError("permission-denied", "Admin access required");
  }
};
