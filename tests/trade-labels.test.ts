import { describe, expect, it } from "vitest";
import { euroInputToCents, centsToEuroInput } from "@/shared/trade-labels";
describe("exact euro entry", () => {
  it("handles decimal point, comma and whole amounts without floating rounding", () => {
    expect(euroInputToCents("62.40")).toBe(6240);
    expect(euroInputToCents("62,40")).toBe(6240);
    expect(euroInputToCents("0.29")).toBe(29);
    expect(euroInputToCents("12")).toBe(1200);
    expect(euroInputToCents("12.3")).toBe(1230);
  });
  it("does not silently round overprecise, negative or invalid input", () => {
    for (const value of ["1.005", "-12", "abc", "1e6", "12."])
      expect(euroInputToCents(value)).toBeNaN();
    expect(euroInputToCents("")).toBeUndefined();
  });
  it("round-trips stored cents including zero", () => {
    for (const value of [0, 1, 29, 6240, 12345, 99999999])
      expect(euroInputToCents(centsToEuroInput(value))).toBe(value);
    expect(centsToEuroInput(undefined)).toBe("");
  });
});
