import { describe, expect, it } from "vitest";
import { authFormResponse, readAuthInput } from "@/platform/auth/form-request";
import { cleanAuthLocation, authFormFeedback } from "@/shared/auth-form-feedback";

function form(body: string, headers: Record<string, string> = {}) {
  return new Request("https://showtime.example/api/login", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Origin: "https://showtime.example",
      ...headers,
    },
  });
}

describe("authentication without JavaScript", () => {
  it("reads credentials only from a bounded POST body and keeps JSON clients compatible", async () => {
    expect(await readAuthInput(form("username=fixture&password=synthetic%26secret"))).toEqual({
      username: "fixture",
      password: "synthetic&secret",
    });
    expect(
      await readAuthInput(
        new Request("https://showtime.example/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "fixture", password: "synthetic" }),
        }),
      ),
    ).toEqual({ username: "fixture", password: "synthetic" });
    await expect(readAuthInput(form("password=" + "x".repeat(16_384)))).rejects.toMatchObject({
      status: 413,
    });
  });

  it("rejects cross-site form submissions and ambiguous repeated fields", async () => {
    await expect(
      readAuthInput(form("username=fixture", { Origin: "https://foreign.example" })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      readAuthInput(form("username=fixture", { "sec-fetch-site": "cross-site" })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(readAuthInput(form("password=first&password=second"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("keeps authentication cookies and redirects without credentials or response contents", () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "session=synthetic; HttpOnly; Secure; Path=/");
    headers.append("Set-Cookie", "scope=synthetic; HttpOnly; Secure; Path=/");
    const response = authFormResponse(
      form("username=fixture&password=synthetic"),
      Response.json({ private: "response-content" }, { headers }),
      "login",
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.body).toBeNull();
  });

  it("uses fixed failure codes and retains only a valid invitation for registration retries", () => {
    const failure = Response.json(
      { error: "private response", password: "synthetic" },
      { status: 401 },
    );
    expect(
      authFormResponse(form("password=synthetic"), failure, "login").headers.get("Location"),
    ).toBe("/login?error=invalid");
    expect(
      authFormResponse(
        form("password=synthetic"),
        new Response(null, { status: 429 }),
        "login",
      ).headers.get("Location"),
    ).toBe("/login?error=rate-limit");
    const invitation = "a".repeat(64);
    expect(
      authFormResponse(form("password=synthetic"), failure, "register", invitation).headers.get(
        "Location",
      ),
    ).toBe("/register?error=registration&invitation=" + invitation);
    expect(
      authFormResponse(
        form("password=synthetic"),
        failure,
        "register",
        "invalid&password=synthetic",
      ).headers.get("Location"),
    ).toBe("/register?error=registration");
    const forbidden = new Response(null, { status: 403 });
    expect(authFormResponse(form("password=synthetic"), forbidden, "login")).toBe(forbidden);
  });

  it("scrubs accidental credential query fields while preserving invitation links and safe feedback", () => {
    expect(
      cleanAuthLocation(
        new URL("https://showtime.example/login?username=fixture&PASSWORD=synthetic&error=invalid"),
      ),
    ).toBe("/login?error=invalid");
    expect(
      cleanAuthLocation(
        new URL("https://showtime.example/register?invitation=existing&password=synthetic"),
      ),
    ).toBe("/register?invitation=existing");
    expect(cleanAuthLocation(new URL("https://showtime.example/login?error=invalid"))).toBeNull();
    expect(authFormFeedback(new URLSearchParams("error=untrusted-private-text"))).toBe("");
  });
});
