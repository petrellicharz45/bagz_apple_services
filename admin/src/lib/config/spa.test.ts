import { describe, expect, it } from "vitest";
import { isSpaConfigValid } from "./spa";

describe("spa config", () => {
  it("requires ssr and prerender to be disabled", () => {
    expect(isSpaConfigValid({ ssr: true, prerender: true })).toBe(false);
    expect(isSpaConfigValid({ ssr: false, prerender: false })).toBe(true);
  });
});
