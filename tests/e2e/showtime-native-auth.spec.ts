import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { privateRequestContext } from "./private-api";
import { totp } from "./mfa-helper";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.use({ trace: "off" });
test.skip(!process.env.SHOWTIME_E2E_ACCESS_FILE, "An explicit synthetic MFA fixture is required");

test("native production login and MFA preserve origins; foreign forms stay blocked and mobile views load", async ({
  browser,
}) => {
  const access = JSON.parse(fs.readFileSync(process.env.SHOWTIME_E2E_ACCESS_FILE!, "utf8"));
  expect(access.username).toMatch(/^qa-privacy-/);
  expect(access.baseURL).toBe(base);
  expect(["http://127.0.0.1:3100", "https://showtime-ingolstadt.vercel.app"]).toContain(base);
  expect(access.environment).toBe(base.startsWith("https:") ? "production" : "development");
  expect(access.mfaSecret).toBeTruthy();
  const proxy = process.env.SHOWTIME_E2E_PROXY
    ? { server: process.env.SHOWTIME_E2E_PROXY }
    : undefined;
  const native = await browser.newContext({ javaScriptEnabled: false, proxy });
  let api: Awaited<ReturnType<typeof privateRequestContext>> | undefined;
  let mobile: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let phase = "password form";
  try {
    const page = await native.newPage();
    const metadata: { path: string; origin?: string; referer?: string }[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && ["/api/login", "/api/auth/mfa"].includes(path))
        metadata.push({
          path,
          origin: request.headers().origin,
          referer: request.headers().referer,
        });
    });
    await page.goto(base + "/login");
    await page.getByLabel("Benutzername", { exact: true }).fill(access.username);
    await page.getByLabel("Passwort", { exact: true }).fill(access.password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(base + "/login/mfa");
    phase = "native second factor";
    await page.screenshot({ path: ".local/privacy-live-native-mfa.png", animations: "disabled" });
    await page.getByLabel("Authenticator-Code", { exact: true }).fill(totp(access.mfaSecret));
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page).toHaveURL(base + "/");
    expect(metadata).toHaveLength(2);
    for (const request of metadata) {
      expect(request.origin).toBe(base);
      expect(request.referer).toBe(base + "/");
    }
    phase = "authenticated scope and foreign forms";
    api = await privateRequestContext({
      baseURL: base,
      proxy,
      storageState: await native.storageState(),
    });
    for (const origin of ["https://qa-attacker.invalid", "null"]) {
      const rejected = await api.post("/api/login", {
        headers: { Origin: origin, "Sec-Fetch-Site": "cross-site" },
        form: { username: access.username, password: "QA-invalid-password" },
      });
      expect(rejected.status()).toBe(403);
    }
    const scopesResponse = await api.get("/api/platform/scopes");
    expect(scopesResponse.ok()).toBe(true);
    const scopes = await scopesResponse.json();
    expect(scopes.user.id).toBe(access.userId);
    const scope = scopes.scopes.find(
      (s: { organizationId: string; departmentName: string }) =>
        s.organizationId === access.organizationId && s.departmentName === "Maske",
    );
    expect(scope).toBeTruthy();
    const switched = await api.post("/api/platform/switch", {
      headers: { Origin: base },
      data: { organizationId: scope.organizationId, departmentId: scope.departmentId },
    });
    expect(switched.ok()).toBe(true);
    phase = "mobile privacy and calendar";
    mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      proxy,
      storageState: await api.storageState(),
    });
    const screen = await mobile.newPage();
    const errors: string[] = [];
    screen.on("pageerror", (error) => errors.push(error.name));
    await screen.goto(base + "/?module=privacy&tab=security");
    await expect(
      screen.getByText("Authenticator eingerichtet · Zugang bestätigt", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    expect(await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await screen.screenshot({
      path: ".local/privacy-live-mobile-security.png",
      fullPage: true,
      animations: "disabled",
    });
    await screen.goto(base + "/?module=calendar");
    await expect(screen.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(screen.getByText("Live verbunden", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    expect(await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await screen.screenshot({
      path: ".local/privacy-live-mobile-calendar.png",
      fullPage: true,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  } catch {
    // Never include Playwright call logs containing filled passwords or session cookies.
    throw new Error("Synthetic native auth/CSRF verification failed at: " + phase);
  } finally {
    await Promise.all([mobile?.close(), api?.dispose(), native.close()]);
  }
});
