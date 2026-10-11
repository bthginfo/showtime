import { test, expect, request, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { load } from "cheerio";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.skip(
  base !== "http://127.0.0.1:3100",
  "Authentication fixtures use the separate development environment.",
);
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });
let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
});
test.afterAll(async () => {
  if (api) {
    await api.post("/api/logout", { data: {} });
    await api.dispose();
  }
});

test("server-rendered authentication forms always submit to POST endpoints", async () => {
  for (const route of ["login", "register"]) {
    const response = await api.get("/" + route);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    const $ = load(await response.text());
    const form = $("input[name=password]").closest("form");
    expect(form.attr("method")?.toLowerCase()).toBe("post");
    expect(form.attr("action")).toBe("/api/" + route);
  }
});

test("a native form login authenticates without JavaScript and never redirects with credentials", async () => {
  const access = JSON.parse(fs.readFileSync(".local/access-development.json", "utf8"));
  const response = await api.post("/api/login", {
    form: { username: access.username, password: access.password },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/");
  expect(response.headers()["set-cookie"]?.includes("HttpOnly")).toBe(true);
  expect((await api.get("/api/platform/scopes")).status()).toBe(200);
});

test("invalid form submissions return safe feedback and foreign origins cannot sign in", async () => {
  const response = await api.post("/api/login", {
    form: { username: "qa-nonexistent-login", password: "synthetic-fixture-password" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/login?error=invalid");
  const page = await api.get(response.headers()["location"]);
  expect(await page.text()).toContain("Benutzername oder Passwort stimmt nicht");
  const blocked = await api.post("/api/login", {
    form: { username: "qa-nonexistent-login", password: "synthetic-fixture-password" },
    headers: { Origin: "https://foreign.example" },
    maxRedirects: 0,
  });
  expect(blocked.status()).toBe(403);
});

test("accidental credential URLs are scrubbed before rendering and GET never authenticates", async () => {
  const response = await api.get("/login?username=synthetic-fixture&password=synthetic-fixture", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/login");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(
    (await api.get("/api/login?username=synthetic-fixture&password=synthetic-fixture")).status(),
  ).toBe(405);
});
