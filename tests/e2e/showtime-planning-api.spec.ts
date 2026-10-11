import { test, expect, request, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.skip(
  base !== "http://127.0.0.1:3100",
  "Planning fixtures use the separate development environment.",
);
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });
let admin: APIRequestContext, guest: APIRequestContext;
let tenant: { id: string; departments: { id: string; name: string }[] };
let productionId: string, adminId: string, guestId: string;
const marker = randomUUID().slice(0, 8);
async function call(api: APIRequestContext, path: string, data?: unknown, method = "POST") {
  const response = await api.fetch(path, { method, ...(data ? { data } : {}) });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
  return response.json();
}
const department = (name: string) => tenant.departments.find((item) => item.name === name)!.id;
async function switchTo(api: APIRequestContext, team: string) {
  await call(api, "/api/platform/switch", {
    organizationId: tenant.id,
    departmentId: department(team),
  });
}
function rehearsal(start: string, end: string, participantIds = [adminId]) {
  return {
    action: "save-item",
    data: {
      moduleId: "disposition",
      type: "rehearsal",
      title: "DEMO · Planungsgrenze " + marker,
      productionId,
      data: { start, end, participantIds },
    },
  };
}
test.beforeAll(async () => {
  const access = JSON.parse(fs.readFileSync(".local/access-development.json", "utf8"));
  admin = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  await call(admin, "/api/login", { username: access.username, password: access.password });
  tenant = await call(admin, "/api/platform/tenants", {
    name: "QA Planungsregeln " + marker,
    slug: "qa-planning-" + marker,
    administrator: "self",
  });
  await switchTo(admin, "Disposition");
  adminId = (await call(admin, "/api/workspace", undefined, "GET")).user.id;
  for (const role of ["production_lead", "disposition"])
    await call(admin, "/api/platform/configuration", {
      action: "grant",
      data: { userId: adminId, role, scope: "tenant", scopeId: null },
    });
  productionId = (
    await call(admin, "/api/records/productions", {
      data: { title: "DEMO · Planungsprüfung " + marker, status: "active" },
    })
  ).id;
  const invite = await call(admin, "/api/platform/configuration", {
    action: "invite",
    data: { departmentId: department("Ensemble"), productionId, role: "guest" },
  });
  guest = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const username = "qa-planning-" + marker,
    password = "QA-" + randomUUID();
  await call(guest, "/api/register", {
    username,
    password,
    name: "DEMO · Ensemble " + marker,
    invitation: new URL(invite.url).searchParams.get("invitation"),
  });
  await call(guest, "/api/login", { username, password });
  await switchTo(guest, "Ensemble");
  guestId = (await call(guest, "/api/workspace", undefined, "GET")).user.id;
  await call(guest, "/api/theater", {
    action: "save-item",
    data: {
      moduleId: "ensemble",
      type: "availability",
      title: "DEMO · am 23. Oktober abwesend",
      productionId,
      data: { start: "2026-10-23", end: "2026-10-23", availability: "unavailable" },
    },
  });
  await call(admin, "/api/platform/configuration", {
    action: "settings",
    data: {
      timezone: "Europe/Berlin",
      workRules: {
        maxDutyHours: 8,
        minimumRestHours: 11,
        minimumBreakMinutes: 0,
        breakAfterHours: 6,
        confirmedByTheater: true,
      },
    },
  });
});
test.afterAll(async () => {
  if (admin && tenant)
    await admin.patch("/api/platform/tenants", { data: { id: tenant.id, status: "disabled" } });
  for (const api of [admin, guest])
    if (api) {
      await api.post("/api/logout", { data: {} });
      await api.dispose();
    }
});
test("a local absence blocks noon and the previous UTC date after local midnight", async () => {
  for (const [start, end] of [
    ["2026-10-23T10:00:00Z", "2026-10-23T11:00:00Z"],
    ["2026-10-22T22:30:00Z", "2026-10-22T23:00:00Z"],
  ])
    expect(
      (await admin.post("/api/theater", { data: rehearsal(start, end, [guestId]) })).status(),
    ).toBe(409);
});
test("a service ending exactly before the absence starts remains possible", async () => {
  await call(
    admin,
    "/api/theater",
    rehearsal("2026-10-22T20:00:00Z", "2026-10-22T22:00:00Z", [guestId]),
  );
});
test("two adjacent eight-hour services cannot bypass the confirmed eight-hour maximum", async () => {
  await call(admin, "/api/theater", rehearsal("2026-10-26T08:00:00Z", "2026-10-26T16:00:00Z"));
  expect(
    (
      await admin.post("/api/theater", {
        data: rehearsal("2026-10-26T16:00:00Z", "2026-10-27T00:00:00Z"),
      })
    ).status(),
  ).toBe(409);
});
test("all three connected fragments count towards the same person's maximum", async () => {
  await call(admin, "/api/theater", rehearsal("2026-10-28T08:00:00Z", "2026-10-28T11:00:00Z"));
  await call(admin, "/api/theater", rehearsal("2026-10-28T11:00:00Z", "2026-10-28T14:00:00Z"));
  expect(
    (
      await admin.post("/api/theater", {
        data: rehearsal("2026-10-28T14:00:00Z", "2026-10-28T17:00:00Z"),
      })
    ).status(),
  ).toBe(409);
});
test("different people's services do not combine into a fictitious long duty", async () => {
  await call(
    admin,
    "/api/theater",
    rehearsal("2026-10-30T08:00:00Z", "2026-10-30T12:00:00Z", [adminId]),
  );
  await call(
    admin,
    "/api/theater",
    rehearsal("2026-10-30T13:00:00Z", "2026-10-30T17:00:00Z", [guestId]),
  );
  await call(
    admin,
    "/api/theater",
    rehearsal("2026-10-30T12:00:00Z", "2026-10-30T13:00:00Z", [adminId, guestId]),
  );
});
