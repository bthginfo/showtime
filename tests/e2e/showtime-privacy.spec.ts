import { privateRequestContext } from "./private-api";
import { test, expect, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { totp } from "./mfa-helper";
const base = "http://127.0.0.1:3100";
test.describe.configure({ mode: "serial" });
test.use({ trace: "off" });
test.skip(
  !process.env.SHOWTIME_E2E_ACCESS_FILE,
  "Explicit synthetic Showtime MFA fixture required",
);
let admin: APIRequestContext;
let fixture: any;
let policyVersion = 0;
let noticeUrl = "";
let accessRequest: any;
const marker = "QA Privacy " + randomUUID().slice(0, 8);
async function call(path: string, data?: unknown, method = "POST") {
  const r = await admin.fetch(path, { method, ...(data === undefined ? {} : { data }) });
  const b = await r.json();
  expect(r.ok(), path + " " + r.status() + " " + (b.error || "")).toBeTruthy();
  return b;
}
test.beforeAll(async () => {
  fixture = JSON.parse(fs.readFileSync(process.env.SHOWTIME_E2E_ACCESS_FILE!, "utf8"));
  expect(fixture.environment).toBe("development");
  expect(fixture.username).toMatch(/^qa-privacy-/);
  admin = await privateRequestContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const login = await call("/api/login", {
    username: fixture.username,
    password: fixture.password,
  });
  if (login.twoFactorRedirect)
    await call("/api/auth/mfa", { action: "verify", code: totp(fixture.mfaSecret) });
  const scopes = await call("/api/platform/scopes", undefined, "GET");
  const scope = scopes.scopes.find(
    (s: any) => s.organizationId === fixture.organizationId && s.departmentName === "Maske",
  );
  await call("/api/platform/switch", scope);
  const state = await call("/api/privacy", undefined, "GET");
  policyVersion = state.policyVersion;
  noticeUrl = state.noticeUrl;
});
test.afterAll(async () => {
  await admin?.dispose();
});
test("a password-only privileged session cannot read support or change privacy policy", async () => {
  expect(
    (
      await admin.post("/api/auth/mfa", { data: { action: "enable", password: fixture.password } })
    ).status(),
  ).toBe(409);
  const api = await privateRequestContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  try {
    const r = await api.post("/api/login", {
      data: { username: fixture.username, password: fixture.password },
    });
    expect((await r.json()).twoFactorRedirect).toBe(true);
    expect((await api.get("/api/platform/support")).status()).toBe(401);
    expect(
      (
        await api.post("/api/privacy", {
          data: { action: "policy", version: policyVersion, data: {} },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await api.dispose();
  }
});
test("publishes only a complete synthetic theater notice and leaves internal review notes private", async ({
  page,
}) => {
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "policy",
          version: policyVersion,
          data: { controller: {}, publishedAt: new Date().toISOString() },
        },
      })
    ).status(),
  ).toBe(400);
  const data = {
    controller: {
      name: marker + " Controller",
      address: "QA Test Address 1",
      contact: "privacy@qa.invalid",
      dpo: "",
    },
    provider: { name: "QA SaaS", address: "QA Provider Address", contact: "provider@qa.invalid" },
    rightsContact: "rights@qa.invalid",
    purposes: ["employees", "actors", "contacts"].map((group) => ({
      group,
      purpose: "QA purpose",
      basis: "QA reviewed legal basis",
      retention: "QA reviewed retention",
      recipients: "QA recipients",
      notice: "",
    })),
    notice: "QA synthetic privacy notice. No real legal approval is asserted.",
    worksCouncilReview: "QA_INTERNAL_REVIEW_DO_NOT_PUBLISH",
    reviewedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  };
  await call("/api/privacy", { action: "policy", version: policyVersion, data });
  await page.goto(noticeUrl);
  await expect(
    page.getByRole("heading", { name: "Datenschutzinformation", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(marker + " Controller")).toBeVisible();
  await expect(page.getByText("QA_INTERNAL_REVIEW_DO_NOT_PUBLISH")).toHaveCount(0);
  const current = await call("/api/privacy", undefined, "GET");
  policyVersion = current.policyVersion;
  await call("/api/privacy", {
    action: "policy",
    version: policyVersion,
    data: {
      ...current.policy,
      controller: { ...current.policy.controller, name: marker + " DRAFT" },
      publishedAt: "",
    },
  });
  await page.reload();
  await expect(page.getByText(marker + " Controller")).toBeVisible();
  await expect(page.getByText(marker + " DRAFT")).toHaveCount(0);
});
test("creates own requests with a server receipt, then requires documented identity and response to close", async () => {
  accessRequest = await call("/api/privacy", {
    action: "entry",
    kind: "request",
    status: "closed",
    data: {
      title: marker + " access",
      requestType: "access",
      subjectType: "account",
      subjectId: fixture.userId,
      receivedAt: "2020-01-01T00:00:00Z",
      response: "Forged completion",
      decision: "Forged decision",
    },
  });
  expect(accessRequest.status).toBe("open");
  expect(new Date(accessRequest.data.receivedAt).getFullYear()).toBeGreaterThan(2020);
  expect(accessRequest.data.response).toBe("");
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "entry",
          id: accessRequest.id,
          version: accessRequest.version,
          kind: "request",
          status: "closed",
          data: accessRequest.data,
        },
      })
    ).status(),
  ).toBe(400);
  const exported = await call("/api/privacy", { action: "subject-export", id: accessRequest.id });
  expect(exported.subjectId).toBe(fixture.userId);
  expect(JSON.stringify(exported)).not.toMatch(/backupCodes|session_token|password|secret/);
});
test("keeps provider contracts, retention rules, image licenses and breach decisions pending until evidence exists", async () => {
  await call("/api/privacy", { action: "provider-drafts" });
  const state = await call("/api/privacy", undefined, "GET");
  expect(state.entries.filter((e: any) => e.kind === "provider").length).toBeGreaterThanOrEqual(3);
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "entry",
          kind: "provider",
          status: "verified",
          data: { title: marker + " incomplete provider" },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "entry",
          kind: "retention",
          status: "verified",
          data: { title: marker + " retention", group: "time", trigger: "last-updated" },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "entry",
          kind: "image",
          status: "verified",
          data: { title: marker + " photo", allowedUse: "public" },
        },
      })
    ).status(),
  ).toBe(400);
  const incident = await call("/api/privacy", {
    action: "entry",
    kind: "incident",
    data: {
      title: marker + " incident",
      awareAt: new Date().toISOString(),
      authorityDecision: "pending",
      subjectsDecision: "pending",
    },
  });
  expect(Date.parse(incident.dueAt) - Date.parse(incident.data.awareAt)).toBe(72 * 3600000);
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "entry",
          kind: "incident",
          id: incident.id,
          version: incident.version,
          status: "closed",
          data: incident.data,
        },
      })
    ).status(),
  ).toBe(400);
});
test("a scoped erasure uses confirmation, respects holds and writes a content-free tombstone", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const row = await call("/api/records/time", {
    data: {
      title: marker + " erasure candidate",
      durationSeconds: 900,
      date: day,
      category: "other",
    },
  });
  let erasure = await call("/api/privacy", {
    action: "entry",
    kind: "request",
    data: {
      title: marker + " erasure",
      requestType: "erasure",
      subjectType: "account",
      subjectId: fixture.userId,
    },
  });
  erasure = await call("/api/privacy", {
    action: "entry",
    kind: "request",
    id: erasure.id,
    version: erasure.version,
    data: { ...erasure.data, decision: "QA verified erasure decision" },
  });
  const hold = await call("/api/privacy", {
    action: "entry",
    kind: "hold",
    data: { title: marker + " hold", recordIds: [row.id], reason: "QA legal hold" },
  });
  const preview = await call("/api/privacy", { action: "erasure-preview", id: erasure.id });
  expect(preview.candidates.find((r: any) => r.id === row.id).held).toBe(true);
  expect(
    (
      await admin.post("/api/privacy", {
        data: {
          action: "erase",
          id: erasure.id,
          data: { recordIds: [row.id], confirmation: "GEPRÜFTE DATEN LÖSCHEN" },
        },
      })
    ).status(),
  ).toBe(409);
  await call("/api/privacy", {
    action: "entry",
    kind: "hold",
    id: hold.id,
    version: hold.version,
    status: "withdrawn",
    data: hold.data,
  });
  expect(
    (
      await admin.post("/api/privacy", {
        data: { action: "erase", id: erasure.id, data: { recordIds: [row.id] } },
      })
    ).status(),
  ).toBe(400);
  const result = await call("/api/privacy", {
    action: "erase",
    id: erasure.id,
    data: { recordIds: [row.id], confirmation: "GEPRÜFTE DATEN LÖSCHEN" },
  });
  expect(result.erased).toBe(1);
  expect(result.accountDeleted).toBe(false);
  expect(
    (await call("/api/records/time", undefined, "GET")).records.some((r: any) => r.id === row.id),
  ).toBe(false);
});
test("privacy and calendar pages work at desktop and mobile widths with readable forms and no overflow", async ({
  page,
}) => {
  await page.context().addCookies((await admin.storageState()).cookies);
  fs.mkdirSync(".impeccable/review", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name + ": " + e.message));
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
    ["user-1065", 1065, 779],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const tab of ["overview", "requests", "security", "providers", "retention", "policy"]) {
      await page.goto("/?module=privacy&tab=" + tab);
      await expect(
        page.getByRole("heading", { name: "Datenschutz & Sicherheit", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        page.getByText("Datenschutzangaben werden geladen …", { exact: true }),
      ).toHaveCount(0, { timeout: 30000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
      ).toBe(false);
      await page.screenshot({
        path: ".impeccable/review/privacy-" + name + "-" + tab + ".png",
        fullPage: true,
      });
    }
    await page.goto("/?module=privacy&tab=providers");
    await expect(page.getByRole("button", { name: "Anbieter anlegen", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Anbieter anlegen", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Anbieter anlegen", exact: true }),
    ).toBeFocused();
    await page.getByLabel("Kurzer Titel", { exact: true }).fill(marker + " UI provider");
    await page.screenshot({
      path: ".impeccable/review/privacy-" + name + "-entry-form.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(page.locator("#privacy-section-heading")).toBeFocused();
    await page.getByRole("button", { name: "Anbieter anlegen", exact: true }).click();
    await page.getByLabel("Kurzer Titel", { exact: true }).fill(marker + " UI provider");
    await page
      .getByLabel("Dienst und verarbeitete Inhalte", { exact: true })
      .fill("QA user-facing service");
    await page.getByRole("button", { name: "Vorgang speichern", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Gespeichert." })).toBeVisible();
    await expect(page.locator("#privacy-section-heading")).toBeFocused();
    await page.goto(noticeUrl);
    await expect(
      page.getByRole("heading", { name: "Datenschutzinformation", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".impeccable/review/privacy-" + name + "-public-notice.png",
      fullPage: true,
    });
    await page.goto("/?module=calendar");
    await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible({
      timeout: 30000,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    ).toBe(false);
    await page.screenshot({
      path: ".impeccable/review/privacy-" + name + "-calendar.png",
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
