import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/firebase", () => ({
  db: {}
}));

import { mapProductForm } from "./products";

describe("mapProductForm", () => {
  it("ensures nameLowercase is set", () => {
    const result = mapProductForm({ name: "Lux Bag" });
    expect(result.nameLowercase).toBe("lux bag");
  });
});
