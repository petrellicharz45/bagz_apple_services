import { describe, expect, it } from "vitest";
import { isAdminClaim } from "./claims";

describe("isAdminClaim", () => {
  it("returns true only when admin claim is true", () => {
    expect(isAdminClaim({})).toBe(false);
    expect(isAdminClaim({ admin: false })).toBe(false);
    expect(isAdminClaim({ admin: true })).toBe(true);
  });
});
