import { describe, expect, it } from "vitest";
import { assertOrigin } from "@/platform/http";
describe("native auth forms with a no-referrer policy", () => {
  const req = (site?: string) =>
    new Request("http://127.0.0.1:3100/api/login", {
      method: "POST",
      headers: { Origin: "null", ...(site ? { "Sec-Fetch-Site": site } : {}) },
    });
  it("accepts browser-verified same-origin forms", () => {
    expect(() => assertOrigin(req("same-origin"))).not.toThrow();
  });
  it("rejects opaque, same-site and foreign origins without a same-origin signal", () => {
    for (const site of [undefined, "none", "same-site", "cross-site"])
      expect(() => assertOrigin(req(site))).toThrow();
  });
});
