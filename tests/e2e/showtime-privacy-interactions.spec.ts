import { test, expect, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { privateRequestContext } from "./private-api";
import { totp } from "./mfa-helper";

const base = "http://127.0.0.1:3100";
const viewports = [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
  ["user-1065", 1065, 779],
] as const;
test.describe.configure({ mode: "serial" });
test.setTimeout(240000);
test.use({ trace: "off", actionTimeout: 10000, navigationTimeout: 30000 });
test.skip(!process.env.SHOWTIME_E2E_ACCESS_FILE, "Explicit synthetic development fixture required");
let admin: APIRequestContext,
  fixture: any,
  scope: any,
  member: { id: string; username: string; password: string; mfaSecret?: string };
async function capture(
  page: import("@playwright/test").Page,
  options: Parameters<import("@playwright/test").Page["screenshot"]>[0],
) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const sidebar = page.locator(".sidebar");
  if ((page.viewportSize()?.width || 1440) <= 760 && (await sidebar.count())) {
    if (await sidebar.getAttribute("class").then((value) => value?.includes("mobile-open"))) {
      await page.getByRole("button", { name: "Menü schließen", exact: true }).click();
    }
    await expect(sidebar).toHaveAttribute("aria-hidden", "true");
    await sidebar.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    await expect
      .poll(async () => {
        const bounds = await sidebar.boundingBox();
        return bounds ? bounds.x + bounds.width : 0;
      })
      .toBeLessThanOrEqual(1);
  }
  return page.screenshot({ ...options, animations: "disabled" });
}
const marker = "QA privacy interaction " + randomUUID().slice(0, 8);
async function call(api: APIRequestContext, path: string, data?: unknown, method = "POST") {
  const r = await api.fetch(path, { method, ...(data === undefined ? {} : { data }) });
  expect(r.ok(), `${path}: ${r.status()}`).toBeTruthy();
  return r.json();
}
test.beforeAll(async () => {
  fixture = JSON.parse(fs.readFileSync(process.env.SHOWTIME_E2E_ACCESS_FILE!, "utf8"));
  expect(fixture.environment).toBe("development");
  expect(fixture.username).toMatch(/^qa-privacy-/);
  admin = await privateRequestContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  await call(admin, "/api/login", { username: fixture.username, password: fixture.password });
  await call(admin, "/api/auth/mfa", { action: "verify", code: totp(fixture.mfaSecret) });
  scope = (await call(admin, "/api/platform/scopes", undefined, "GET")).scopes.find(
    (s: any) => s.organizationId === fixture.organizationId && s.departmentName === "Maske",
  );
  await call(admin, "/api/platform/switch", {
    organizationId: scope.organizationId,
    departmentId: scope.departmentId,
  });
  const invitation = await call(admin, "/api/platform/configuration", {
    action: "invite",
    data: { departmentId: scope.departmentId, role: "employee" },
  });
  member = {
    id: "",
    username: "qa-privacy-ui-" + randomUUID().slice(0, 8),
    password: randomUUID() + randomUUID(),
  };
  const api = await privateRequestContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  try {
    await call(api, "/api/register", {
      username: member.username,
      password: member.password,
      name: marker + " employee",
      invitation: new URL(invitation.url).searchParams.get("invitation"),
    });
    await call(api, "/api/login", { username: member.username, password: member.password });
    member.id = (await call(api, "/api/platform/scopes", undefined, "GET")).user.id;
    await call(api, "/api/platform/switch", {
      organizationId: scope.organizationId,
      departmentId: scope.departmentId,
    });
    await call(api, "/api/actions", {
      action: "profile-update",
      data: { onboardingCompleted: true },
    });
  } finally {
    await api.dispose();
  }
  fs.mkdirSync(".impeccable/review", { recursive: true });
});
test.afterAll(async () => {
  if (member?.id && admin) {
    await call(admin, "/api/platform/configuration", {
      action: "member",
      data: { userId: member.id, status: "disabled" },
    });
    const runtime = JSON.parse(fs.readFileSync(".local/runtime-development.json", "utf8"));
    if (runtime.APP_URL !== base || !member.username.startsWith("qa-privacy-ui-"))
      throw new Error("Synthetic cleanup only");
    const auth = postgres(runtime.AUTH_DATABASE_URL, { max: 1, prepare: false });
    try {
      await auth`delete from app_session where user_id=${member.id}`;
      await auth`delete from auth_two_factor where user_id=${member.id}`;
      await auth`update app_user set two_factor_enabled=false where id=${member.id} and username=${member.username}`;
    } finally {
      await auth.end();
    }
  }
  await admin?.dispose();
});
test("an employee can submit an own request, enroll MFA and use a recovery code once", async ({
  page,
}) => {
  const api = await privateRequestContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name));
  try {
    await call(api, "/api/login", { username: member.username, password: member.password });
    await call(api, "/api/platform/switch", {
      organizationId: scope.organizationId,
      departmentId: scope.departmentId,
    });
    await page.context().addCookies((await api.storageState()).cookies);
    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/?module=privacy&tab=security");
      await expect(
        page.getByText("Authenticator noch nicht eingerichtet", { exact: false }),
      ).toBeVisible({ timeout: 30000 });
      await capture(page, {
        path: `.impeccable/review/privacy-${name}-no-mfa.png`,
        fullPage: true,
      });
    }
    await page.goto("/?module=privacy&tab=requests");
    await expect(
      page.getByRole("heading", { name: "Noch keine Anfrage", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await capture(page, { path: ".impeccable/review/privacy-user-1065-empty.png", fullPage: true });
    await page.getByRole("button", { name: "Betroffenenanfrage anlegen", exact: true }).click();
    await expect(page.getByLabel("Person", { exact: true })).toHaveCount(0);
    await page.getByLabel("Kurzer Titel", { exact: true }).fill(marker + " own request");
    await page.getByRole("button", { name: "Vorgang speichern", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Gespeichert." })).toBeVisible();
    await page.goto("/?module=privacy&tab=security");
    await page.getByLabel("Dein aktuelles Passwort", { exact: true }).fill(member.password);
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/mfa") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Authenticator einrichten", exact: true }).click();
    const setup = await (await response).json();
    await expect(page.getByAltText("QR-Code für die Authenticator-App")).toBeVisible();
    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await capture(page, {
        path: `.impeccable/review/privacy-${name}-synthetic-mfa-setup.png`,
        fullPage: true,
      });
    }
    const secret = new URL(setup.totpURI).searchParams.get("secret")!;
    member.mfaSecret = secret;
    await page.getByLabel("Authenticator-Code", { exact: true }).fill(totp(secret));
    await page.getByRole("button", { name: "Code bestätigen", exact: true }).click();
    await expect(
      page.getByText("Authenticator eingerichtet · Zugang bestätigt", { exact: true }),
    ).toBeVisible();
    const recovery = await privateRequestContext({
      baseURL: base,
      extraHTTPHeaders: { Origin: base },
    });
    try {
      const result = await call(recovery, "/api/login", {
        username: member.username,
        password: member.password,
      });
      expect(result.twoFactorRedirect).toBe(true);
      await page.context().clearCookies();
      await page.context().addCookies((await recovery.storageState()).cookies);
      await page.goto("/login/mfa");
      await page
        .getByRole("link", { name: "Wiederherstellungscode verwenden", exact: true })
        .click();
      await expect(page.getByLabel("Wiederherstellungscode", { exact: true })).toBeVisible();
      for (const [name, width, height] of viewports) {
        await page.setViewportSize({ width, height });
        await capture(page, {
          path: `.impeccable/review/privacy-${name}-mfa-login.png`,
          fullPage: true,
        });
      }
      await page.getByLabel("Wiederherstellungscode", { exact: true }).fill(setup.backupCodes[0]);
      await page.getByRole("button", { name: "Anmelden", exact: true }).click();
      await expect(page.locator(".workspace")).toBeVisible({ timeout: 30000 });
      await call(recovery, "/api/login", { username: member.username, password: member.password });
      const replay = await recovery.post("/api/auth/mfa", {
        data: { action: "backup", code: setup.backupCodes[0] },
      });
      expect([400, 401, 403]).toContain(replay.status());
      const nativeContext = await page
        .context()
        .browser()!
        .newContext({ javaScriptEnabled: false });
      try {
        const nativePage = await nativeContext.newPage();
        await nativePage.goto(base + "/login");
        await nativePage.getByLabel("Benutzername", { exact: true }).fill(member.username);
        await nativePage.getByLabel("Passwort", { exact: true }).fill(member.password);
        await nativePage.getByRole("button", { name: "Anmelden", exact: true }).click();
        await expect(nativePage).toHaveURL(base + "/login/mfa");
        await nativePage
          .getByRole("link", { name: "Wiederherstellungscode verwenden", exact: true })
          .click();
        expect(new URL(nativePage.url()).searchParams.get("method")).toBe("backup");
        await expect(
          nativePage.getByLabel("Wiederherstellungscode", { exact: true }),
        ).toBeVisible();
        await nativePage.screenshot({
          path: ".impeccable/review/privacy-native-mfa-recovery.png",
          fullPage: true,
        });
        await nativePage
          .getByLabel("Wiederherstellungscode", { exact: true })
          .fill(setup.backupCodes[1]);
        await nativePage.getByRole("button", { name: "Anmelden", exact: true }).click();
        await expect(nativePage).toHaveURL(base + "/");
        const nativeSession = await nativeContext.request.get(base + "/api/platform/scopes");
        expect(nativeSession.status()).toBe(200);
        expect((await nativeSession.json()).user.id).toBe(member.id);
        expect(new URL(nativePage.url()).searchParams.has("code")).toBe(false);
      } finally {
        await nativeContext.close();
      }
    } finally {
      await recovery.dispose();
    }
    expect(errors).toEqual([]);
  } finally {
    await api.dispose();
  }
});
test("deletion previews show identifiable choices, active holds, partial results and focus", async ({
  page,
}) => {
  const day = new Date().toISOString().slice(0, 10);
  const rows = [];
  const owner = await privateRequestContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  try {
    await call(owner, "/api/login", { username: member.username, password: member.password });
    await call(owner, "/api/auth/mfa", { action: "verify", code: totp(member.mfaSecret!) });
    await call(owner, "/api/platform/switch", {
      organizationId: scope.organizationId,
      departmentId: scope.departmentId,
    });
    for (const label of ["delete allowed", "delete held"])
      rows.push(
        await call(owner, "/api/records/time", {
          data: {
            title: marker + " " + label,
            userId: member.id,
            date: day,
            durationSeconds: 600,
            category: "other",
          },
        }),
      );
  } finally {
    await owner.dispose();
  }
  let req = await call(admin, "/api/privacy", {
    action: "entry",
    kind: "request",
    data: {
      title: marker + " erasure review",
      subjectType: "account",
      subjectId: member.id,
      requestType: "erasure",
    },
  });
  req = await call(admin, "/api/privacy", {
    action: "entry",
    id: req.id,
    version: req.version,
    kind: "request",
    data: {
      ...req.data,
      identityVerifiedAt: new Date().toISOString(),
      decision: "QA verified erasure decision",
    },
  });
  const hold = await call(admin, "/api/privacy", {
    action: "entry",
    kind: "hold",
    data: { title: marker + " legal hold", recordIds: [rows[1].id], reason: "QA retention hold" },
  });
  await page.context().addCookies((await admin.storageState()).cookies);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name));
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/?module=privacy&tab=requests");
    const article = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: marker + " erasure review", exact: true }),
    });
    await article.getByRole("button", { name: "Löschvorschau prüfen", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Löschvorschau prüfen", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Zuerst Einträge auswählen", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: new RegExp("delete held") })).toBeDisabled();
    await page.getByRole("checkbox", { name: new RegExp("delete allowed") }).check();
    await expect(
      page.getByRole("button", { name: "1 geprüfte Einträge endgültig löschen", exact: true }),
    ).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await capture(page, {
      path: `.impeccable/review/privacy-${name}-deletion-selection.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Vorschau schließen", exact: true }).click();
    await expect(
      article.getByRole("button", { name: "Löschvorschau prüfen", exact: true }),
    ).toBeFocused();
  }
  await call(admin, "/api/privacy", {
    action: "erase",
    id: req.id,
    data: { confirmation: "GEPRÜFTE DATEN LÖSCHEN", recordIds: [rows[0].id] },
  });
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/?module=privacy&tab=requests");
    await page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: marker + " erasure review", exact: true }) })
      .getByRole("button", { name: "Löschvorschau prüfen", exact: true })
      .click();
    await expect(
      page.getByText(
        "Alle angezeigten Einträge sind gesperrt oder es gibt keine passenden Datensätze. Eine Löschung ist hier nicht möglich.",
        { exact: true },
      ),
    ).toBeVisible();
    await capture(page, {
      path: `.impeccable/review/privacy-${name}-deletion-blocked.png`,
      fullPage: true,
    });
  }
  const preview = await call(admin, "/api/privacy", { action: "erasure-preview", id: req.id });
  // The explicit bounded-result UI state uses a synthetic response; actual holds above are real DB data.
  await page.route("**/api/privacy", async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (body?.action === "erasure-preview")
      await route.fulfill({ json: { ...preview, more: true } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Vorschau schließen", exact: true }).click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: marker + " erasure review", exact: true }) })
    .getByRole("button", { name: "Löschvorschau prüfen", exact: true })
    .click();
  await expect(page.getByText(/Es sind mehr als 100 Datensätze vorhanden/)).toBeVisible();
  await capture(page, {
    path: ".impeccable/review/privacy-user-1065-partial-fixture.png",
    fullPage: true,
  });
  await page.unroute("**/api/privacy");
  await page.goto("/?module=privacy&tab=providers");
  await page.getByRole("button", { name: "Anbieter anlegen", exact: true }).click();
  await page.getByLabel("Kurzer Titel", { exact: true }).fill(marker + " incomplete provider");
  await page.locator("form").getByLabel("Status").selectOption("verified");
  await page.getByRole("button", { name: "Vorgang speichern", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Vertrag, Prüfung/ })
      .first(),
  ).toBeVisible();
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await capture(page, {
      path: `.impeccable/review/privacy-${name}-form-error.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.locator("#privacy-section-heading")).toBeFocused();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?module=privacy");
  await expect(
    page.getByRole("heading", { name: "Was du hier erledigen kannst", exact: true }),
  ).toBeVisible();
  await capture(page, { path: ".impeccable/review/privacy-user-1065-dark.png", fullPage: true });
  expect(errors).toEqual([]);
  await call(admin, "/api/privacy", {
    action: "entry",
    id: hold.id,
    version: hold.version,
    kind: "hold",
    status: "withdrawn",
    data: hold.data,
  });
});
