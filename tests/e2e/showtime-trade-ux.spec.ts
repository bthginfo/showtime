import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { privateRequestContext } from "./private-api";
import { totp } from "./mfa-helper";

test.skip(
  process.env.SHOWTIME_TRADE_UX !== "development",
  "Uses an explicitly selected, owned Showtime DEV fixture.",
);
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });
test.setTimeout(180000);
const base = "http://127.0.0.1:3100";
const output = ".local/trade-ux-20261015";
let api: APIRequestContext,
  scopes: { departmentId: string; departmentName: string; organizationId: string }[],
  tenant: string,
  userId: string;
let production: string, asset: any, report: any;
const marker = "QA UX " + randomUUID().slice(0, 8);
async function call(path: string, data?: unknown) {
  const response = await api.fetch(path, {
    method: data === undefined ? "GET" : "POST",
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), path.split("?")[0] + " " + response.status()).toBe(true);
  return response.json();
}
async function scope(name: string) {
  const target = scopes.find((s) => s.departmentName === name)!;
  await call("/api/platform/switch", { organizationId: tenant, departmentId: target.departmentId });
  return call("/api/workspace");
}
async function pageFor(browser: Browser, path: string) {
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator("#trade-records")).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("button", { name: "Aktualisieren", exact: true })).toBeEnabled({
    timeout: 60000,
  });
  return { page, context };
}
test.beforeAll(async () => {
  const access = JSON.parse(fs.readFileSync(".local/privacy-qa-access.json", "utf8"));
  if (access.environment !== "development" || !access.username.startsWith("qa-privacy-"))
    throw Error("Owned development fixture required");
  tenant = access.organizationId;
  userId = access.userId;
  api = await privateRequestContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
    timeout: 60000,
  });
  const login = await call("/api/login", { username: access.username, password: access.password });
  if (login.twoFactorRedirect)
    await call("/api/auth/mfa", { action: "verify", code: totp(access.mfaSecret) });
  scopes = (await call("/api/platform/scopes")).scopes.filter(
    (s: any) => s.organizationId === tenant,
  );
  await scope("Maske");
  production = (
    await call("/api/records/productions", {
      data: {
        title: marker + " Produktion",
        status: "active",
        memberIds: [userId],
        contacts: [],
      },
    })
  ).id;
  asset = await call("/api/theater", {
    action: "save-item",
    data: {
      moduleId: "makeup",
      type: "asset",
      title: marker + " Perücke",
      data: { inventoryNumber: marker, quantity: 12, condition: "available" },
    },
  });
  fs.mkdirSync(output, { recursive: true });
});
test.afterAll(async () => {
  if (api) {
    await api.post("/api/logout", { data: {} }).catch(() => undefined);
    await api.dispose();
  }
});

test("all 22 trades preserve the selected function when changing production and fit desktop/mobile", async ({
  browser,
}) => {
  test.setTimeout(900000);
  const evidence: any[] = [];
  for (const target of scopes) {
    await call("/api/platform/switch", {
      organizationId: tenant,
      departmentId: target.departmentId,
    });
    const workspace = await call("/api/workspace");
    if (!workspace.currentModuleId || evidence.some((e) => e.id === workspace.currentModuleId))
      continue;
    const planning = await call("/api/theater");
    const manifest = planning.modules.find(
      (m: any) => m.moduleId === workspace.currentModuleId,
    ).manifest;
    const feature = manifest.features[1] || manifest.features[0];
    const { page, context } = await pageFor(browser, "/?module=theater&view=trade");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.name));
    try {
      await page.getByRole("button", { name: "Alle Funktionen", exact: true }).click();
      await page
        .locator(".feature-choices button.work-tile")
        .filter({ hasText: feature.label })
        .first()
        .click();
      await expect(page.locator("#trade-records h2")).toHaveText(feature.label);
      const productionSelect = page.locator(".planning-filters select").first();
      const selectableProduction = await productionSelect
        .locator("option:not([value=''])")
        .first()
        .getAttribute("value");
      expect(selectableProduction, "a visible production can be selected").toBeTruthy();
      await productionSelect.selectOption(selectableProduction!);
      await expect(page.getByRole("button", { name: "Aktualisieren", exact: true })).toBeEnabled({
        timeout: 60000,
      });
      await expect(page.locator("#trade-records h2")).toHaveText(feature.label);
      expect(new URL(page.url()).searchParams.get("featureId")).toBe(feature.id);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: output + "/" + workspace.currentModuleId + "-desktop.png",
        fullPage: true,
      });
      const desktop = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        recordsTop: document.querySelector("#trade-records")!.getBoundingClientRect().top,
      }));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: output + "/" + workspace.currentModuleId + "-mobile.png",
        fullPage: true,
      });
      const mobile = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        recordsTop: document.querySelector("#trade-records")!.getBoundingClientRect().top,
      }));
      expect(desktop.scrollWidth).toBeLessThanOrEqual(desktop.width);
      expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.width);
      expect(errors).toEqual([]);
      evidence.push({
        id: workspace.currentModuleId,
        feature: feature.id,
        desktop,
        mobile,
        errors,
      });
      fs.writeFileSync(
        output + "/evidence.json",
        JSON.stringify({ at: new Date().toISOString(), evidence }, null, 2),
      );
    } finally {
      await context.close();
    }
  }
  expect(evidence).toHaveLength(22);
});

test("the function chooser presents the active trade as descriptive tiles", async ({ browser }) => {
  await scope("Licht");
  const workspace = await call("/api/workspace");
  const planning = await call("/api/theater");
  const expected = planning.modules.find(
    (module: any) => module.moduleId === workspace.currentModuleId,
  ).manifest.features.length;
  const { page, context } = await pageFor(browser, "/?module=theater&view=trade");
  try {
    await page.getByRole("button", { name: "Alle Funktionen", exact: true }).click();
    const chooser = page.locator(".feature-choices");
    await expect(chooser.getByRole("heading", { name: /Alle Funktionen/ })).toBeVisible();
    await expect(chooser.locator("button.work-tile")).toHaveCount(expected);
    await expect(chooser.locator(".tile-description")).toHaveCount(expected);
    await page.screenshot({ path: output + "/lighting-functions-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output + "/lighting-functions-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});

test("the trade home puts actionable Facharbeit before schedules and tasks", async ({
  browser,
}) => {
  await scope("Maske");
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const priorities = page.getByRole("heading", {
      name: "Deine Facharbeit mit Handlungsbedarf",
      exact: true,
    });
    const schedule = page.getByRole("heading", { name: "Deine nächsten Termine", exact: true });
    await expect(priorities).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByRole("group", { name: "Arbeitsstände mit Handlungsbedarf" }),
    ).toBeVisible();
    expect((await priorities.boundingBox())!.y).toBeLessThan((await schedule.boundingBox())!.y);
    await page.screenshot({ path: output + "/trade-home-priorities-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output + "/trade-home-priorities-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});

test("cancel preserves the list context; a global asset is selectable and stock books once", async ({
  browser,
}) => {
  await scope("Maske");
  const { page, context } = await pageFor(browser, "/?module=theater&featureId=asset");
  try {
    await page.getByLabel("Arbeitsstände suchen").fill(asset.title);
    await page
      .locator(".trade-entry")
      .getByRole("button", { name: "Bearbeiten", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const editorProductionSelect = dialog.locator("form select").first();
    const visibleProduction = await editorProductionSelect
      .locator("option:not([value=''])")
      .first()
      .getAttribute("value");
    expect(visibleProduction, "a visible production can be selected in the editor").toBeTruthy();
    await editorProductionSelect.selectOption(visibleProduction!);
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(page.locator(".planning-filters select").first()).toHaveValue("");
    await expect(page.locator(".trade-entry h3")).toHaveText(asset.title);
    await page.goto(
      base +
        "/?module=theater&featureId=stock-movement&productionId=" +
        encodeURIComponent(visibleProduction!),
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );
    await expect(page.locator("#trade-records")).toBeVisible({ timeout: 60000 });
    await page
      .getByRole("button", { name: "Bewegung buchen", exact: true })
      .click({ timeout: 30000 });
    await dialog.getByLabel("Titel", { exact: true }).fill(marker + " Bestandsbuchung");
    const article = dialog.getByLabel("Artikel · Pflichtfeld", { exact: true });
    await expect(article.locator("option", { hasText: asset.title })).toHaveCount(1, {
      timeout: 60000,
    });
    const assetOptionValue = await article
      .locator("option", { hasText: asset.title })
      .getAttribute("value");
    expect(assetOptionValue).toBeTruthy();
    await article.selectOption(assetOptionValue!);
    await dialog
      .locator("label")
      .filter({ hasText: /^Bewegung/ })
      .locator("select")
      .selectOption("consume");
    await dialog.getByLabel("Menge", { exact: true }).fill("2");
    await dialog.getByLabel("Grund / Nachweis", { exact: true }).fill("Synthetische UX-Prüfung");
    await expect(dialog.getByLabel("Status", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output + "/stock-editor-mobile.png", fullPage: true });
    await dialog
      .getByRole("button", { name: "Bestandsbewegung verbindlich buchen", exact: true })
      .click();
    await expect(dialog).toHaveCount(0, { timeout: 60000 });
    await expect(
      page.getByRole("status").filter({ hasText: "Bestandsbewegung gebucht" }),
    ).toBeVisible();
    const stored = await call("/api/theater/operations?id=" + asset.id);
    expect(stored.item.data._stock.available).toBe(10);
  } finally {
    await context.close();
  }
});

test("required cue selections block an empty submission and show the error on the actual field", async ({
  browser,
}) => {
  await scope("Inspizienz");
  const { page, context } = await pageFor(
    browser,
    "/?module=theater&featureId=cue-edition&productionId=" + production,
  );
  try {
    await page.getByRole("button", { name: "Gemeinsame Cue-Fassung anlegen", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Titel", { exact: true }).fill(marker + " Leere Fassung");
    await dialog.getByLabel("Fassung", { exact: true }).fill("A");
    const input = dialog.getByRole("searchbox", { name: "Zugehörige Fach-Cues durchsuchen" });
    await expect(input).toBeVisible();
    expect(await input.evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(false);
    let submitted = false;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/theater") && r.method() === "POST") submitted = true;
    });
    await dialog
      .getByRole("button", { name: "Gemeinsame Cue-Fassung anlegen", exact: true })
      .click();
    await expect(input).toBeFocused();
    expect(submitted).toBe(false);
    await page.screenshot({ path: output + "/cue-required-desktop.png", fullPage: true });
  } finally {
    await context.close();
  }
});

test("followup retries reuse the same operation after a committed response is lost", async ({
  browser,
}) => {
  await scope("Regie");
  report = await call("/api/theater", {
    action: "save-item",
    data: {
      moduleId: "direction",
      type: "rehearsal-report",
      productionId: production,
      title: marker + " Probenbericht",
      data: {},
    },
  });
  const { page, context } = await pageFor(
    browser,
    "/?module=theater&featureId=rehearsal-report&itemId=" + report.id,
  );
  try {
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Aufträge an andere Gewerke", { exact: true }).click();
    await dialog.getByRole("searchbox", { name: "Empfangende Gewerke durchsuchen" }).fill("Maske");
    await dialog.getByLabel("Maske", { exact: true }).check();
    await dialog
      .getByLabel("Änderungsauftrag", { exact: true })
      .fill("Bitte die Perücke für die nächste Probe abstimmen.");
    let first = true;
    const ids: string[] = [];
    await page.route("**/api/theater/operations", async (route) => {
      const req = route.request();
      if (req.method() !== "POST" || req.postDataJSON().action !== "followups")
        return route.continue();
      ids.push(req.postDataJSON().data.operationId);
      const response = await route.fetch();
      if (first) {
        first = false;
        await route.abort("connectionreset");
      } else await route.fulfill({ response });
    });
    await dialog.getByRole("button", { name: "Folgeaufträge senden", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 60000 });
    await dialog.getByRole("button", { name: "Folgeaufträge senden", exact: true }).click();
    await expect(dialog.getByRole("status").filter({ hasText: "Aufträge gesendet" })).toBeVisible({
      timeout: 60000,
    });
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    const planning = await call("/api/theater?productionId=" + production);
    const followups = planning.items.filter(
      (i: any) => i.type === "collaboration" && i.data.sourceItemId === report.id,
    );
    expect(followups).toHaveLength(1);
  } finally {
    await context.close();
  }
});
