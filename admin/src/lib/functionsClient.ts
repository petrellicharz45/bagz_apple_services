import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { app } from "$lib/firebase";
import { browser } from "$app/environment";

let emulatorConnected = false;

/** Firebase callable region (must match deployed v2 functions). */
const FUNCTIONS_REGION = "us-central1";

export function getAdminFunctions(): Functions {
  if (!app) {
    throw new Error("Firebase is not initialized. Check admin/.env.");
  }
  const functions = getFunctions(app, FUNCTIONS_REGION);
  if (
    browser &&
    import.meta.env.DEV &&
    import.meta.env.VITE_CONNECT_FUNCTIONS_EMULATOR === "true" &&
    !emulatorConnected
  ) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    emulatorConnected = true;
  }
  return functions;
}

export function formatCallableError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const code = e?.code || "";
  const msg = e?.message || String(error);

  if (code === "functions/permission-denied" || msg.includes("permission-denied")) {
    return "Admin permission required. Sign out and sign in again, or use “Make super admin” after Cloud Functions are deployed.";
  }
  if (
    code === "functions/internal" ||
    code === "functions/not-found" ||
    msg === "internal" ||
    /^\s*internal\s*$/i.test(msg)
  ) {
    return (
      "That action needs a Cloud Function, and those functions are not deployed on this Firebase plan."
    );
  }
  return msg || "Request failed.";
}
