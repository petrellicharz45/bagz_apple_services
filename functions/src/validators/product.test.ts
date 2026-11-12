import { describe, expect, it } from "vitest";
import { normalizeProductInput } from "./product";

describe("normalizeProductInput", () => {
  it("lowercases name for nameLowercase", () => {
    const result = normalizeProductInput({ name: "Lux Bag" });
    expect(result.nameLowercase).toBe("lux bag");
  });
});
