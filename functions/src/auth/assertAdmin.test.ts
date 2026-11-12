import { describe, expect, it } from "vitest";
import { assertAdmin } from "./assertAdmin";

describe("assertAdmin", () => {
  it("throws when admin claim missing", () => {
    expect(() => assertAdmin({ auth: { token: {} } })).toThrow();
  });
});
