import { test, expect, request, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.skip(
  base !== "http://127.0.0.1:3100",
  "Platform fixtures use the separate development environment.",
);
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });
let admin: APIRequestContext, employee: APIRequestContext;
let first: { id: string; departments: { id: string; name: string }[] }, second: typeof first;
const key = randomUUID().slice(0, 8);
async function call(api: APIRequestContext, url: string, data?: unknown, method = "POST") {
  const response = await api.fetch(url, { method, ...(data ? { data } : {}) });
  expect(response.ok(), `${method} ${url}: ${response.status()}`).toBeTruthy();
  return response.json();
}
test.beforeAll(async () => {
  const access = JSON.parse(fs.readFileSync(".local/access-development.json", "utf8"));
  admin = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  await call(admin, "/api/login", { username: access.username, password: access.password });
});
test.afterAll(async () => {
  for (const api of [admin, employee]) {
    if (api) {
      await api.post("/api/logout", { data: {} });
      await api.dispose();
    }
  }
});

test("self onboarding creates all trades and makes the new theater immediately usable", async () => {
  first = await call(admin, "/api/platform/tenants", {
    name: "QA Plattform " + key,
    slug: "qa-platform-" + key,
    administrator: "self",
  });
  expect(first.departments).toHaveLength(20);
  const scopes = await call(admin, "/api/platform/scopes", undefined, "GET");
  expect(
    scopes.scopes.filter((s: { organizationId: string }) => s.organizationId === first.id),
  ).toHaveLength(20);
  const detail = await call(admin, `/api/platform/tenants/${first.id}`, undefined, "GET");
  expect(detail.modules.filter((m: { enabled: boolean }) => m.enabled)).toHaveLength(20);
  const summary = (await call(admin, "/api/platform/tenants", undefined, "GET")).find(
    (entry: { id: string }) => entry.id === first.id,
  );
  expect(summary).toMatchObject({ memberCount: 1, departmentCount: 20, administratorCount: 1 });
  await call(admin, "/api/platform/switch", {
    organizationId: first.id,
    departmentId: first.departments[0].id,
  });
  expect((await admin.get("/api/workspace")).ok()).toBe(true);
});
test("duplicate identifiers return an actionable conflict without creating another theater", async () => {
  const before = await call(admin, "/api/platform/tenants", undefined, "GET");
  const result = await admin.post("/api/platform/tenants", {
    data: { name: "Duplicate", slug: "qa-platform-" + key },
  });
  expect(result.status()).toBe(409);
  expect((await result.json()).error).toContain("Kennung");
  expect(await call(admin, "/api/platform/tenants", undefined, "GET")).toHaveLength(before.length);
});
test("invite onboarding keeps tenants isolated and new invitations revoke unused predecessors", async () => {
  second = await call(admin, "/api/platform/tenants", {
    name: "QA Einladung " + key,
    slug: "qa-invite-" + key,
    administrator: "invite",
  });
  const scopes = await call(admin, "/api/platform/scopes", undefined, "GET");
  expect(
    scopes.scopes.some((s: { organizationId: string }) => s.organizationId === second.id),
  ).toBe(false);
  const rotated = await call(admin, `/api/platform/tenants/${second.id}/invitation`, {});
  const previous = await admin.post("/api/register", {
    data: {
      existingAccount: true,
      invitation: new URL(
        (second as typeof second & { invitationUrl: string }).invitationUrl,
      ).searchParams.get("invitation"),
    },
  });
  expect(previous.status()).toBe(400);
  const joined = await call(admin, "/api/register", {
    existingAccount: true,
    invitation: new URL(rotated.url).searchParams.get("invitation"),
  });
  expect(joined.scope.organizationId).toBe(second.id);
  expect(
    (
      await admin.post("/api/register", {
        data: {
          existingAccount: true,
          invitation: new URL(rotated.url).searchParams.get("invitation"),
        },
      })
    ).status(),
  ).toBe(400);
});
test("regular employees cannot access or mutate any platform administration endpoint", async () => {
  await call(admin, "/api/platform/switch", {
    organizationId: first.id,
    departmentId: first.departments[0].id,
  });
  const invitation = await call(admin, "/api/platform/configuration", {
    action: "invite",
    data: { departmentId: first.departments[0].id, role: "employee" },
  });
  employee = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const username = "qa-platform-" + key,
    password = "QA-" + randomUUID();
  await call(employee, "/api/register", {
    username,
    password,
    name: "QA Platform Employee",
    invitation: new URL(invitation.url).searchParams.get("invitation"),
  });
  await call(employee, "/api/login", { username, password });
  for (const url of ["/api/platform/tenants", `/api/platform/tenants/${first.id}`])
    expect((await employee.get(url)).status()).toBe(403);
  for (const url of [
    `/api/platform/tenants/${first.id}/setup`,
    `/api/platform/tenants/${first.id}/invitation`,
  ])
    expect((await employee.post(url, { data: {} })).status()).toBe(403);
  expect(
    (
      await employee.post("/api/platform/tenants", {
        data: { name: "Forbidden", slug: "forbidden-" + key },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await employee.patch("/api/platform/tenants", { data: { id: first.id, status: "disabled" } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await employee.post("/api/platform/switch", {
        data: { organizationId: second.id, departmentId: second.departments[0].id },
      })
    ).status(),
  ).toBe(403);
});
test("locking revokes live access, stale changes conflict, and setup cannot unlock a theater", async () => {
  const list = await call(admin, "/api/platform/tenants", undefined, "GET");
  const tenant = list.find((t: { id: string }) => t.id === first.id);
  await call(employee, "/api/platform/switch", {
    organizationId: first.id,
    departmentId: first.departments[0].id,
  });
  expect((await employee.get("/api/workspace")).ok()).toBe(true);
  await call(
    admin,
    "/api/platform/tenants",
    { id: first.id, status: "disabled", expectedVersion: tenant.version },
    "PATCH",
  );
  expect((await employee.get("/api/workspace")).status()).toBe(403);
  expect((await admin.post(`/api/platform/tenants/${first.id}/setup`, { data: {} })).status()).toBe(
    409,
  );
  expect(
    (
      await admin.patch("/api/platform/tenants", {
        data: { id: first.id, status: "active", expectedVersion: tenant.version },
      })
    ).status(),
  ).toBe(409);
  const fresh = (await call(admin, "/api/platform/tenants", undefined, "GET")).find(
    (t: { id: string }) => t.id === first.id,
  );
  await call(
    admin,
    "/api/platform/tenants",
    { id: first.id, status: "active", expectedVersion: fresh.version },
    "PATCH",
  );
  expect((await employee.get("/api/workspace")).ok()).toBe(true);
});
