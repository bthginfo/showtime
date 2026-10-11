import { test, expect, request, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.skip(
  base !== "http://127.0.0.1:3100",
  "Collaboration fixtures use the separate development environment.",
);
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });
let admin: APIRequestContext, receiver: APIRequestContext, outsider: APIRequestContext;
let tenant: { id: string; departments: { id: string; name: string }[] },
  productionId: string,
  requestId: string,
  fileId: string,
  receiverId: string;
let version: number;
const marker = randomUUID().slice(0, 8);
async function call(api: APIRequestContext, path: string, data?: unknown, method = "POST") {
  const response = await api.fetch(path, { method, ...(data ? { data } : {}) });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
  return response.json();
}
const department = (name: string) =>
  tenant.departments.find((department) => department.name === name)!.id;
async function switchTo(api: APIRequestContext, departmentId: string) {
  await call(api, "/api/platform/switch", { organizationId: tenant.id, departmentId });
}
test.beforeAll(async () => {
  admin = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const access = JSON.parse(fs.readFileSync(".local/access-development.json", "utf8"));
  await call(admin, "/api/login", { username: access.username, password: access.password });
  tenant = await call(admin, "/api/platform/tenants", {
    name: "QA Zusammenarbeit " + marker,
    slug: "qa-collaboration-" + marker,
    administrator: "self",
  });
  await switchTo(admin, department("Kostüm"));
  const workspace = await call(admin, "/api/workspace", undefined, "GET");
  for (const role of ["production_lead", "team_lead"])
    await call(admin, "/api/platform/configuration", {
      action: "grant",
      data: { userId: workspace.user.id, role, scope: "tenant", scopeId: null },
    });
  async function member(label: string, team: string) {
    const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
    const invitation = await call(admin, "/api/platform/configuration", {
      action: "invite",
      data: { departmentId: department(team), role: "team_lead" },
    });
    const username = "qa-" + label + "-" + marker,
      password = "QA-" + randomUUID();
    await call(api, "/api/register", {
      username,
      password,
      name: "QA " + label,
      invitation: new URL(invitation.url).searchParams.get("invitation"),
    });
    await call(api, "/api/login", { username, password });
    await switchTo(api, department(team));
    return { api, id: (await call(api, "/api/workspace", undefined, "GET")).user.id };
  }
  const target = await member("Maske", "Maske"),
    other = await member("Licht", "Licht");
  receiver = target.api;
  receiverId = target.id;
  outsider = other.api;
  productionId = (
    await call(admin, "/api/records/productions", {
      data: { title: "QA Gewerke " + marker, status: "active", memberIds: [receiverId, other.id] },
    })
  ).id;
});
test.afterAll(async () => {
  if (admin && tenant)
    await admin.patch("/api/platform/tenants", { data: { id: tenant.id, status: "disabled" } });
  for (const api of [admin, receiver, outsider])
    if (api) {
      await api.post("/api/logout", { data: {} });
      await api.dispose();
    }
});

test("all twenty trades load their own module and validated feature contracts", async () => {
  const scopes = await call(admin, "/api/platform/scopes", undefined, "GET");
  expect(
    scopes.scopes.filter((scope: { organizationId: string }) => scope.organizationId === tenant.id),
  ).toHaveLength(20);
  for (const team of tenant.departments) {
    await switchTo(admin, team.id);
    const workspace = await call(admin, "/api/workspace", undefined, "GET");
    const planning = await call(admin, "/api/theater", undefined, "GET");
    const module = planning.modules.find(
      (module: { config: { departmentId: string } }) => module.config.departmentId === team.id,
    );
    expect(module?.manifest?.features.length, team.name).toBeGreaterThan(0);
    expect(workspace.currentModuleId).toBe(module.moduleId);
    expect(workspace.user.activeDepartmentIds).toContain(team.id);
  }
  await switchTo(admin, department("Kostüm"));
});

test("an explicit request is idempotent, visible to its receiving trade and hidden from unrelated trades", async () => {
  requestId = randomUUID();
  const data = {
    id: requestId,
    title: "QA Ausstattung an Maske",
    kind: "approval",
    recipientDepartmentId: department("Maske"),
    productionId,
    brief: "Bitte Frisur und Perücke mit der Kostümfigurine abstimmen.",
    acceptance: "Die gewünschte Silhouette und der Wechsel sind gemeinsam geprüft.",
    dueDate: "2026-10-12",
  };
  const entry = await call(admin, "/api/theater/collaborations", { action: "create", data });
  version = entry.version;
  expect((await call(admin, "/api/theater/collaborations", { action: "create", data })).id).toBe(
    requestId,
  );
  const target = await call(
    receiver,
    "/api/theater/collaborations?id=" + requestId,
    undefined,
    "GET",
  );
  expect(target.entry.canApprove).toBe(true);
  expect(target.replies).toHaveLength(1);
  expect((await outsider.get("/api/theater/collaborations?id=" + requestId)).status()).toBe(404);
  expect(
    (await call(outsider, "/api/theater/collaborations", undefined, "GET")).entries,
  ).toHaveLength(0);
  expect(
    (
      await admin.post("/api/theater/collaborations", {
        data: {
          action: "reply",
          data: {
            id: requestId,
            expectedVersion: version,
            action: "approve",
            message: "Self approval is forbidden.",
          },
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await admin.patch(`/api/records/handovers/${requestId}`, {
        data: { version: 1, data: { title: "Bypass" } },
      })
    ).status(),
  ).toBe(403);
});

test("feedback, revisions and uploaded attachments advance the review version and protect private files", async () => {
  const changed = await call(receiver, "/api/theater/collaborations", {
    action: "reply",
    data: {
      id: requestId,
      expectedVersion: version,
      action: "request-changes",
      message: "Bitte den schnellen Perückenwechsel genauer beschreiben.",
    },
  });
  version = changed.version;
  expect(changed.status).toBe("changes_requested");
  expect(
    (
      await admin.post("/api/theater/collaborations", {
        data: {
          action: "reply",
          data: {
            id: requestId,
            expectedVersion: 1,
            action: "comment",
            message: "Stale feedback.",
          },
        },
      })
    ).status(),
  ).toBe(409);
  const revised = await call(admin, "/api/theater/collaborations", {
    action: "reply",
    data: {
      id: requestId,
      expectedVersion: version,
      action: "revise",
      message: "Wechsel ergänzt.",
      brief:
        "Perücke wird im zweiten Bild hinter der Bühne gewechselt. Kostüm und Headset vorher gemeinsam prüfen.",
    },
  });
  version = revised.version;
  expect(revised.status).toBe("review");
  expect(revised.data.revision).toBe(2);
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  const bytes = Buffer.from(await document.save());
  const upload = await admin.post("/api/files", {
    multipart: {
      recordKind: "handovers",
      recordId: requestId,
      file: { name: "QA-Figurine.pdf", mimeType: "application/pdf", buffer: bytes },
    },
  });
  expect(upload.status()).toBe(201);
  fileId = (await upload.json()).id;
  const detail = await call(
    receiver,
    "/api/theater/collaborations?id=" + requestId,
    undefined,
    "GET",
  );
  expect(detail.entry.version).toBe(version + 1);
  expect(detail.files).toHaveLength(1);
  const downloaded = await receiver.get("/api/files/" + fileId);
  expect(downloaded.status()).toBe(200);
  expect(
    createHash("sha256")
      .update(await downloaded.body())
      .digest("hex"),
  ).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect([403, 404]).toContain((await outsider.get("/api/files/" + fileId)).status());
  expect(
    (
      await receiver.post("/api/theater/collaborations", {
        data: {
          action: "reply",
          data: {
            id: requestId,
            expectedVersion: version,
            action: "approve",
            message: "This missed the attachment.",
          },
        },
      })
    ).status(),
  ).toBe(409);
  version = detail.entry.version;
});

test("a receiving team lead approves the current version and completed attachments remain immutable", async () => {
  const approved = await call(receiver, "/api/theater/collaborations", {
    action: "reply",
    data: {
      id: requestId,
      expectedVersion: version,
      action: "approve",
      message: "Silhouette und Wechsel geprüft. Der Arbeitsstand ist freigegeben.",
    },
  });
  expect(approved.status).toBe("approved");
  version = approved.version;
  expect(
    (
      await receiver.post("/api/theater/collaborations", {
        data: {
          action: "reply",
          data: {
            id: requestId,
            expectedVersion: version,
            action: "comment",
            message: "Cannot alter a closed review.",
          },
        },
      })
    ).status(),
  ).toBe(409);
  const upload = await admin.post("/api/files", {
    multipart: {
      recordKind: "handovers",
      recordId: requestId,
      file: { name: "Later.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    },
  });
  expect(upload.status()).toBe(403);
  expect((await admin.delete("/api/files/" + fileId)).status()).toBe(403);
  expect((await receiver.get("/api/files/" + fileId)).status()).toBe(200);
  const notices = (await call(receiver, "/api/workspace", undefined, "GET")).records.notifications;
  expect(
    notices.some(
      (notice: { data: { type: string; recordId: string } }) =>
        notice.data.type === "TradeCollaborationChangedV1" && notice.data.recordId === requestId,
    ),
  ).toBe(true);
});

test("the leadership overview uses actual audience reports and rejects duplicates, invalid counts and unauthorized access", async () => {
  await switchTo(admin, department("Vorderhaus"));
  const curtainAt = new Date(Date.now() - 3 * 86400000).toISOString();
  const show = await call(admin, "/api/theater", {
    action: "schedule",
    data: { action: "performance", data: { productionId, curtainAt, status: "planned" } },
  });
  const data = {
    performanceId: show.id,
    offeredSeats: 200,
    visitors: 160,
    paidTickets: 150,
    complimentaryTickets: 10,
    amountCents: 300000,
  };
  const report = {
    action: "save-item",
    data: {
      moduleId: "front-of-house",
      type: "audience-report",
      title: "QA Besucherbericht",
      productionId,
      status: "done",
      data,
    },
  };
  const saved = await call(admin, "/api/theater", report);
  expect(saved.id).toBeTruthy();
  expect((await admin.post("/api/theater", { data: report })).status()).toBe(409);
  expect(
    (
      await admin.post("/api/theater", {
        data: { ...report, data: { ...report.data, data: { ...data, visitors: 201 } } },
      })
    ).status(),
  ).toBe(400);
  const overview = await call(admin, "/api/theater/overview", undefined, "GET");
  expect(overview.audience).toMatchObject({
    reports: 1,
    visitors: 160,
    offeredSeats: 200,
    occupancy: 80,
    incomeCents: 300000,
  });
  expect(overview.productionCount).toBe(1);
  expect((await receiver.get("/api/theater/overview")).status()).toBe(403);
  expect((await outsider.get("/api/theater/overview")).status()).toBe(403);
});

test("fresh membership withdrawal revokes existing file, request and notification access", async () => {
  await call(admin, "/api/platform/configuration", {
    action: "member",
    data: { userId: receiverId, status: "disabled" },
  });
  expect((await receiver.get("/api/theater/collaborations?id=" + requestId)).status()).toBe(403);
  expect((await receiver.get("/api/files/" + fileId)).status()).toBe(403);
  expect((await receiver.get("/api/workspace")).status()).toBe(403);
});
