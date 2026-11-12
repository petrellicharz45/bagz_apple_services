import { describe, expect, it, vi } from "vitest";

// Mock firebase before importing auth.ts
vi.mock("$lib/firebase", () => ({
  auth: {},
  firebaseInitError: null
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn()
}));
vi.mock("$app/environment", () => ({
  browser: false,
  dev: false
}));
vi.mock("$env/dynamic/public", () => ({
  env: {}
}));

import { deriveAdminFlag } from "./auth";

describe("deriveAdminFlag", () => {
  it("maps claims into admin boolean", () => {
    expect(deriveAdminFlag(null)).toBe(false);
    expect(deriveAdminFlag({ admin: true })).toBe(true);
  });
});
