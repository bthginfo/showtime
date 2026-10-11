import { test, expect, request, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import postgres from "postgres";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.skip(base !== "http://127.0.0.1:3100", "Synthetic expansion fixtures use development only.");
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });
test.setTimeout(180000);
let admin: APIRequestContext,
  member: APIRequestContext,
  tenant: { id: string; departments: { id: string; name: string }[] },
  productionId: string,
  userId: string,
  memberId: string,
  asset: any,
  room: any,
  workshop: any,
  booking: any,
  cue: any;
const marker = randomUUID().slice(0, 8);
const dep = (name: string) => tenant.departments.find((d) => d.name === name)!.id;
async function call(api: APIRequestContext, path: string, data?: unknown, method = "POST") {
  const r = await api.fetch(path, { method, ...(data ? { data } : {}) });
  expect(r.ok(), method + " " + path + " " + r.status()).toBe(true);
  return r.json();
}
async function scope(name: string) {
  await call(admin, "/api/platform/switch", { organizationId: tenant.id, departmentId: dep(name) });
}
async function save(
  moduleId: string,
  type: string,
  data: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return call(admin, "/api/theater", {
    action: "save-item",
    data: {
      moduleId,
      type,
      title: "QA " + type + " " + marker,
      productionId,
      data: Object.fromEntries(
        Object.entries(data).filter(
          ([key]) => !key.startsWith("_") && !["dependencyIds", "eventId"].includes(key),
        ),
      ),
      ...extra,
    },
  });
}
test.beforeAll(async () => {
  admin = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const access = JSON.parse(fs.readFileSync(".local/access-development.json", "utf8"));
  await call(admin, "/api/login", { username: access.username, password: access.password });
  tenant = await call(admin, "/api/platform/tenants", {
    name: "QA Fachausbau " + marker,
    slug: "qa-fachausbau-" + marker,
    administrator: "self",
  });
  await scope("Requisite");
  userId = (await call(admin, "/api/workspace", undefined, "GET")).user.id;
  for (const role of [
    "production_lead",
    "team_lead",
    "disposition",
    "intendance",
    "costume_specialist",
  ])
    await call(admin, "/api/platform/configuration", {
      action: "grant",
      data: {
        userId,
        role,
        scope: "tenant",
        scopeId: null,
        sensitiveConfirmed: true,
        sensitiveReason: "Synthetischer Fachtest im separaten Entwicklungstheater.",
      },
    });
  member = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const invite = await call(admin, "/api/platform/configuration", {
      action: "invite",
      data: { departmentId: dep("Theaterpädagogik"), role: "employee" },
    }),
    credentials = { username: "qa-fach-" + marker, password: "QA-" + randomUUID() };
  await call(member, "/api/register", {
    ...credentials,
    name: "Synthetische Fachmitarbeit",
    invitation: new URL(invite.url).searchParams.get("invitation"),
  });
  await call(member, "/api/login", credentials);
  await call(member, "/api/platform/switch", {
    organizationId: tenant.id,
    departmentId: dep("Theaterpädagogik"),
  });
  memberId = (await call(member, "/api/workspace", undefined, "GET")).user.id;
  productionId = (
    await call(admin, "/api/records/productions", {
      data: {
        title: "QA Ausbauproduktion " + marker,
        status: "active",
        memberIds: [memberId, userId],
      },
    })
  ).id;
  fs.writeFileSync(
    ".local/gaps-browser-access.json",
    JSON.stringify({ tenant, productionId, admin: access, member: credentials }),
  );
});
test.afterAll(async () => {
  if (admin && tenant && process.env.SHOWTIME_KEEP_FIXTURE !== "1")
    await admin.patch("/api/platform/tenants", { data: { id: tenant.id, status: "disabled" } });
  for (const api of [admin, member])
    if (api) {
      await api.post("/api/logout", { data: {} });
      await api.dispose();
    }
});
test("stock movements change actual stock, prevent overdraw and preserve immutable evidence", async () => {
  await scope("Requisite");
  asset = await save("props", "asset", {
    inventoryNumber: "QA-001",
    kind: "consumable",
    quantity: 10,
    condition: "available",
  });
  await save("props", "stock-movement", {
    assetId: asset.id,
    movement: "loan",
    quantity: 3,
    reason: "Synthetische Vorstellung",
  });
  let detail = await call(admin, "/api/theater/operations?id=" + asset.id, undefined, "GET");
  expect(detail.item.data._stock).toEqual({ available: 7, loaned: 3, consumed: 0 });
  const movement = await save("props", "stock-movement", {
    assetId: asset.id,
    movement: "return",
    quantity: 2,
    reason: "Rückgabe",
  });
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            id: movement.id,
            moduleId: "props",
            type: "stock-movement",
            title: movement.title,
            productionId,
            expectedVersion: movement.version,
            data: {
              assetId: asset.id,
              movement: "return",
              quantity: 1,
              reason: "Nachträglich verändern",
            },
          },
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            moduleId: "props",
            type: "stock-movement",
            title: "QA Überziehung",
            productionId,
            data: { assetId: asset.id, movement: "consume", quantity: 100, reason: "Test" },
          },
        },
      })
    ).status(),
  ).toBe(409);
  detail = await call(admin, "/api/theater/operations?id=" + asset.id, undefined, "GET");
  expect(detail.item.data._stock).toEqual({ available: 9, loaned: 1, consumed: 0 });
  expect(detail.history.length).toBeGreaterThan(2);
});
test("linked loan and return post stock evidence once and forbid changing the recorded quantity", async () => {
  await scope("Requisite");
  const loan = await save("props", "loan", {
    assetId: asset.id,
    lender: "QA Fundus",
    quantity: 3,
    deadline: "2099-01-01",
  });
  expect(
    (await call(admin, "/api/theater/operations?id=" + asset.id, undefined, "GET")).item.data
      ._stock,
  ).toEqual({ available: 6, loaned: 4, consumed: 0 });
  const data = { ...loan.data, returnedAt: new Date().toISOString().slice(0, 10) };
  const returned = await save("props", "loan", data, {
    id: loan.id,
    expectedVersion: loan.version,
    status: "done",
  });
  await save("props", "loan", data, {
    id: returned.id,
    expectedVersion: returned.version,
    status: "done",
  });
  expect(
    (await call(admin, "/api/theater/operations?id=" + asset.id, undefined, "GET")).item.data
      ._stock,
  ).toEqual({ available: 9, loaned: 1, consumed: 0 });
  const planning = await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET");
  expect(
    planning.items.filter(
      (row: any) => row.type === "stock-movement" && row.data.sourceItemId === loan.id,
    ),
  ).toHaveLength(2);
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            moduleId: "props",
            type: "loan",
            title: loan.title,
            id: returned.id,
            expectedVersion: returned.version + 1,
            productionId,
            status: "done",
            data: {
              ...Object.fromEntries(
                Object.entries(data).filter(
                  ([key]) => !key.startsWith("_") && !["dependencyIds", "eventId"].includes(key),
                ),
              ),
              quantity: 2,
            },
          },
        },
      })
    ).status(),
  ).toBe(409);
});
test("CSV preview rolls back all effects, applying repeats exactly once and changed keys conflict", async () => {
  await scope("Ausstattung");
  const data = {
    operationId: randomUUID(),
    moduleId: "design",
    type: "design",
    productionId,
    format: "csv",
    content:
      "title;externalId;revision;concept\nQA Import " +
      marker +
      ";unique-" +
      marker +
      ";V1;Modellprobe",
    mapping: {},
  };
  const preview = await call(admin, "/api/integrations/exchange", { ...data, action: "preview" });
  expect(preview.errors).toEqual([]);
  expect(
    (await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET")).items.filter(
      (i: any) => i.title === "QA Import " + marker,
    ),
  ).toHaveLength(0);
  const first = await call(admin, "/api/integrations/exchange", {
    ...data,
    action: "apply",
    previewHash: preview.previewHash,
  });
  expect(first.imported).toBe(1);
  await call(admin, "/api/integrations/exchange", {
    ...data,
    action: "apply",
    previewHash: preview.previewHash,
  });
  expect(
    (await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET")).items.filter(
      (i: any) => i.title === "QA Import " + marker,
    ),
  ).toHaveLength(1);
  const changed = {
      ...data,
      operationId: randomUUID(),
      content: data.content.replace("Modellprobe", "Bauprobe"),
    },
    next = await call(admin, "/api/integrations/exchange", { ...changed, action: "preview" });
  expect(next.errors.length).toBe(1);
  const invalid = {
      ...data,
      operationId: randomUUID(),
      content: "title;revision\nQA atomar " + marker + ";V1\nQA ungültig;",
    },
    bad = await call(admin, "/api/integrations/exchange", { ...invalid, action: "preview" });
  expect(bad.errors.length).toBe(1);
  expect(
    (
      await admin.post("/api/integrations/exchange", {
        data: { ...invalid, action: "apply", previewHash: bad.previewHash },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET")).items.some(
      (i: any) => i.title === "QA atomar " + marker,
    ),
  ).toBe(false);
});
test("DMX and sound assignment conflicts are detected and later archived slots are reusable", async () => {
  await scope("Licht");
  const data = { fixture: "QA Gerät", dmxAddress: 1, dmxUniverse: 1, footprint: 20 };
  const patch = await save("lighting", "patch", data);
  const collision = await admin.post("/api/theater", {
    data: {
      action: "save-item",
      data: {
        moduleId: "lighting",
        type: "patch",
        title: "QA Konflikt",
        productionId,
        data: { ...data, dmxAddress: 20 },
      },
    },
  });
  expect(collision.status()).toBe(409);
  await save("lighting", "patch", { ...data, dmxAddress: 21 });
  await call(admin, "/api/theater/operations", {
    action: "lifecycle",
    data: {
      id: patch.id,
      expectedVersion: patch.version,
      action: "archive",
      reason: "Gerät entpatcht",
    },
  });
  await save("lighting", "patch", data);
  expect((await member.get("/api/theater/operations?id=" + patch.id)).status()).toBe(404);
  await scope("Regie");
  const commonScene = await save("direction", "scene", {
    revision: "QA Szene V1",
    blocking: "Gemeinsamer Produktionsstand",
  });
  expect((await member.get("/api/theater/operations?id=" + commonScene.id)).ok()).toBe(true);
  expect(
    (
      await member.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            id: commonScene.id,
            expectedVersion: commonScene.version,
            moduleId: "direction",
            type: "scene",
            title: commonScene.title,
            productionId,
            data: { revision: "Unberechtigte Änderung" },
          },
        },
      })
    ).status(),
  ).toBe(403);
  await scope("Ton");
  await save("sound", "channel", { channelNumber: 1, frequencyMHz: 500 });
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            moduleId: "sound",
            type: "channel",
            title: "QA Kanal doppelt",
            productionId,
            data: { channelNumber: 1, frequencyMHz: 501 },
          },
        },
      })
    ).status(),
  ).toBe(409);
});
test("education enforces capacity and keeps consent records away from ordinary employees", async () => {
  await scope("Theaterpädagogik");
  room = await call(admin, "/api/theater", {
    action: "save-resource",
    data: { name: "QA Studio", type: "studio", capacity: 30, setupMinutes: 0, teardownMinutes: 0 },
  });
  workshop = await save("education", "workshop", {
    start: "2026-11-20T09:00:00Z",
    end: "2026-11-20T10:00:00Z",
    capacity: 10,
    resourceId: room.id,
    participantIds: [memberId],
  });
  booking = await save("education", "group-booking", {
    workshopId: workshop.id,
    groupName: "QA Klasse",
    participants: 8,
  });
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            moduleId: "education",
            type: "group-booking",
            title: "QA Zu voll",
            productionId,
            data: { workshopId: workshop.id, groupName: "QA zweite Klasse", participants: 3 },
          },
        },
      })
    ).status(),
  ).toBe(409);
  const privateItem = await save("education", "participant", {
    bookingId: booking.id,
    name: "Synthetisches Kürzel",
    consentPurpose: "QA Workshop",
    consentGiven: true,
    consentUntil: "2026-11-20",
  });
  expect((await member.get("/api/theater/operations?id=" + privateItem.id)).status()).toBe(404);
  expect(
    (
      await member.get(
        "/api/integrations/exchange?moduleId=education&type=participant&format=csv&sensitiveConfirmed=true&productionId=" +
          productionId,
      )
    ).status(),
  ).toBe(403);
  const planning = await call(
    member,
    "/api/theater?productionId=" + productionId,
    undefined,
    "GET",
  );
  expect(planning.items.some((i: any) => i.id === privateItem.id)).toBe(false);
  expect(planning.items.some((i: any) => i.id === booking.id)).toBe(true);
});
test("archiving requires a reason, blocks direct editing and supports traceable restoration", async () => {
  await scope("Regie");
  const source = await save("direction", "scene", {
    revision: "QA V1",
    blocking: "Synthetischer Weg",
  });
  const archived = await call(admin, "/api/theater/operations", {
    action: "lifecycle",
    data: {
      id: source.id,
      expectedVersion: source.version,
      action: "archive",
      reason: "Diese Fassung wird ersetzt",
    },
  });
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "save-item",
          data: {
            moduleId: "direction",
            type: "scene",
            id: source.id,
            expectedVersion: archived.version,
            title: source.title,
            productionId,
            data: { revision: "V2" },
          },
        },
      })
    ).status(),
  ).toBe(409);
  const successor = await call(admin, "/api/theater/operations", {
    action: "lifecycle",
    data: {
      id: source.id,
      expectedVersion: archived.version,
      action: "successor",
      reason: "Geprüfte Nachfolgefassung",
    },
  });
  expect(successor.item.data.sourceItemId).toBe(source.id);
  const restored = await call(admin, "/api/theater/operations", {
    action: "lifecycle",
    data: {
      id: source.id,
      expectedVersion: archived.version,
      action: "restore",
      reason: "Fassung erneut bearbeiten",
    },
  });
  expect(restored.status).toBe("draft");
  expect(
    (await call(admin, "/api/theater/operations?id=" + source.id, undefined, "GET")).history,
  ).toHaveLength(3);
});
test("limited availability is effective in theater time and confirmed profiles constrain only assigned people", async () => {
  await scope("Ensemble");
  await save("ensemble", "availability", {
    start: "2026-11-23",
    end: "2026-11-23",
    availability: "limited",
    allowedFrom: "10:00",
    allowedTo: "14:00",
  });
  const event = (start: string, end: string, people = [userId]) => ({
    data: {
      title: "QA Dienstfenster",
      productionId,
      start,
      end,
      participantIds: people,
      blocksTime: true,
      category: "rehearsal",
    },
  });
  expect(
    (
      await admin.post("/api/records/events", {
        data: event("2026-11-23T08:00:00Z", "2026-11-23T09:00:00Z"),
      })
    ).status(),
  ).toBe(409);
  await call(admin, "/api/records/events", event("2026-11-23T09:00:00Z", "2026-11-23T10:00:00Z"));
  const rules = {
      maxDutyHours: 2,
      minimumRestHours: 0,
      minimumBreakMinutes: 0,
      breakAfterHours: 6,
      maxWeeklyHours: 20,
      maxConsecutiveDays: 6,
      confirmedByTheater: false,
    },
    profile = { id: "qa-rules", name: "QA Gruppe", memberIds: [memberId], actorIds: [], rules };
  await call(admin, "/api/platform/configuration", {
    action: "settings",
    data: { workRuleProfiles: [profile] },
  });
  await call(
    admin,
    "/api/records/events",
    event("2026-11-24T08:00:00Z", "2026-11-24T11:00:00Z", [memberId]),
  );
  await call(admin, "/api/platform/configuration", {
    action: "settings",
    data: { workRuleProfiles: [{ ...profile, rules: { ...rules, confirmedByTheater: true } }] },
  });
  expect(
    (
      await admin.post("/api/records/events", {
        data: event("2026-11-25T08:00:00Z", "2026-11-25T11:00:00Z", [memberId]),
      })
    ).status(),
  ).toBe(409);
  await call(
    admin,
    "/api/records/events",
    event("2026-11-25T08:00:00Z", "2026-11-25T11:00:00Z", [userId]),
  );
});
test("batch preview leaves versions unchanged and applying keeps linked performances synchronized", async () => {
  await scope("Disposition");
  const show = await call(admin, "/api/theater", {
    action: "schedule",
    data: {
      action: "performance",
      data: {
        productionId,
        curtainAt: "2026-11-26T18:00:00Z",
        durationMinutes: 60,
        participantIds: [],
        status: "planned",
      },
    },
  });
  const event = await call(admin, "/api/v1/calendar?id=" + show.eventId, undefined, "GET"),
    data = {
      operationId: randomUUID(),
      changes: [
        {
          id: event.id,
          expectedVersion: event.version,
          start: "2026-11-27T18:00:00Z",
          end: "2026-11-27T19:00:00Z",
        },
      ],
    };
  const preview = await call(admin, "/api/theater/operations", { action: "batch-preview", data });
  expect(preview.preview).toHaveLength(1);
  expect((await call(admin, "/api/v1/calendar?id=" + show.eventId, undefined, "GET")).version).toBe(
    event.version,
  );
  await call(admin, "/api/theater/operations", { action: "batch-apply", data });
  await call(admin, "/api/theater/operations", { action: "batch-apply", data });
  const shows = await call(
    admin,
    "/api/theater?productionId=" + productionId + "&from=2026-11-01&to=2026-11-30",
    undefined,
    "GET",
  );
  expect(shows.performances.find((s: any) => s.id === show.id).curtainAt).toBe(
    "2026-11-27T18:00:00.000Z",
  );
  expect((await call(admin, "/api/v1/calendar?id=" + show.eventId, undefined, "GET")).version).toBe(
    event.version + 1,
  );
});
test("readiness is bound to exact source versions and cannot be waived by a scoped employee", async () => {
  await scope("Requisite");
  const ready = await save("props", "readiness", { ready: true, notes: "Synthetischer Check" });
  let state = await call(
    admin,
    "/api/theater/operations?readiness=" + productionId,
    undefined,
    "GET",
  );
  expect(state.states.find((s: any) => s.moduleId === "props").ready).toBe(true);
  asset = (await call(admin, "/api/theater/operations?id=" + asset.id, undefined, "GET")).item;
  await save(
    "props",
    "asset",
    { ...asset.data, notes: "Geänderte Prüfung" },
    { id: asset.id, expectedVersion: asset.version },
  );
  state = await call(admin, "/api/theater/operations?readiness=" + productionId, undefined, "GET");
  expect(state.states.find((s: any) => s.moduleId === "props").stale).toBe(true);
  expect(
    (
      await member.post("/api/theater/operations", {
        data: {
          action: "readiness-policy",
          data: {
            productionId,
            required: ["props"],
            waivers: [
              {
                moduleId: "props",
                reason: "Synthetische Ausnahme",
                expiresAt: "2026-12-01T00:00:00Z",
              },
            ],
          },
        },
      })
    ).status(),
  ).toBe(403);
  await call(admin, "/api/theater/operations", {
    action: "readiness-policy",
    data: {
      productionId,
      required: ["props"],
      waivers: [
        {
          moduleId: "props",
          reason: "Nur synthetische Abnahme der Ausnahmefunktion",
          expiresAt: "2026-12-01T00:00:00Z",
        },
      ],
    },
  });
  state = await call(admin, "/api/theater/operations?readiness=" + productionId, undefined, "GET");
  expect(state.states.find((s: any) => s.moduleId === "props").waiver.reason).toContain(
    "synthetische",
  );
  expect(ready.version).toBe(1);
});
test("private chunk uploads are resumable, hash checked and tied to the current trade", async () => {
  await scope("Inspizienz");
  cue = await save("stage-management", "cue", {
    sequence: 1,
    trigger: "QA Zeichen",
    action: "Synthetisches Startsignal",
  });
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Synthetic Showtime QA");
  pdf.setSubject("Q".repeat(1_010_000));
  const bytes = Buffer.from(await pdf.save({ useObjectStreams: false }));
  expect(bytes.length).toBeGreaterThan(2_000_000);
  const upload = await call(admin, "/api/media", {
    action: "init",
    data: { itemId: cue.id, name: "qa-stand.pdf", mime: "application/pdf", size: bytes.length },
  });
  for (let index = 0; index < Math.ceil(bytes.length / upload.partBytes); index++) {
    const body = bytes.subarray(index * upload.partBytes, (index + 1) * upload.partBytes),
      path = "/api/media?id=" + upload.id + "&part=" + index;
    expect(
      (
        await admin.put(path, {
          data: body,
          headers: { "Content-Type": "application/octet-stream" },
        })
      ).ok(),
    ).toBe(true);
    if (index === 0)
      expect(
        (
          await admin.put(path, {
            data: body,
            headers: { "Content-Type": "application/octet-stream" },
          })
        ).ok(),
      ).toBe(true);
  }
  const result = await call(admin, "/api/media", { action: "finish", id: upload.id });
  const history = await call(admin, "/api/theater/operations?id=" + cue.id, undefined, "GET");
  expect(history.files).toHaveLength(1);
  expect(history.files[0].data.path).toBeUndefined();
  const downloaded = await admin.get("/api/files/" + history.files[0].id);
  expect(downloaded.ok()).toBe(true);
  expect(
    createHash("sha256")
      .update(await downloaded.body())
      .digest("hex"),
  ).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(result).toBeTruthy();
});
test("offline cues contain no executable script or external dependencies and safely escape markup", async () => {
  const result = await admin.get("/api/theater/cues?productionId=" + productionId);
  expect(result.ok()).toBe(true);
  const html = await result.text();
  expect(html).toContain("Synthetisches Startsignal");
  expect(html).not.toMatch(/<script|https?:\/\/|<link/i);
  expect(result.headers()["content-security-policy"]).toContain("default-src 'none'");
  const shared = await member.get("/api/theater/cues?productionId=" + productionId);
  expect(shared.ok()).toBe(true);
  expect(await shared.text()).toContain("Synthetisches Startsignal");
  expect((await member.get("/api/v1/trade-items?id=" + asset.id)).status()).toBe(404);
});
test("scoped open API keys enforce scope, repeatability, fresh rights and immediate revocation", async () => {
  await scope("Ausstattung");
  const key = await call(admin, "/api/integrations/access", {
    action: "create",
    label: "QA Fachimport",
    scopes: ["trade:read", "trade:write"],
    expiresInDays: 1,
  });
  const api = await request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Authorization: "Bearer " + key.token },
  });
  try {
    expect((await api.get("/api/v1/trade-items?productionId=" + productionId)).ok()).toBe(true);
    expect((await api.get("/api/v1/time")).status()).toBe(403);
    const body = {
      moduleId: "design",
      type: "design",
      title: "QA API " + marker,
      productionId,
      data: { revision: "API V1" },
    };
    const headers = { "Idempotency-Key": "qa-operation-" + marker };
    const first = await api.post("/api/v1/trade-items", { data: body, headers });
    expect(first.ok()).toBe(true);
    const one = await first.json(),
      second = await api.post("/api/v1/trade-items", { data: body, headers });
    expect(second.ok()).toBe(true);
    expect((await second.json()).id).toBe(one.id);
    expect(
      (
        await api.post("/api/v1/trade-items", {
          data: { ...body, title: "QA anderer Vorgang" },
          headers,
        })
      ).status(),
    ).toBe(409);
  } finally {
    await api.dispose();
  }
  await call(admin, "/api/integrations/access", { action: "revoke", id: key.id });
  const revoked = await request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Authorization: "Bearer " + key.token },
  });
  expect([401, 403]).toContain((await revoked.get("/api/v1/trade-items")).status());
  await revoked.dispose();
});
test("maintenance series create the next instance once and resource blocks prevent new bookings", async () => {
  await scope("Haustechnik & IT");
  const equipment = await save("facilities", "asset", {
    inventoryNumber: "QA-SERVICE",
    quantity: 1,
    condition: "available",
    resourceId: room.id,
  });
  const series = await save("facilities", "maintenance-series", {
    assetId: equipment.id,
    nextService: "2026-11-02",
    intervalDays: 30,
    responsibleId: userId,
    checklist: "Synthetische Sichtprüfung",
  });
  let planning = await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET");
  const run = planning.items.find(
    (i: any) => i.type === "maintenance" && i.data.seriesId === series.id,
  );
  expect(run).toBeTruthy();
  await save("facilities", "maintenance", run.data, {
    id: run.id,
    expectedVersion: run.version,
    status: "done",
  });
  planning = await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET");
  expect(
    planning.items.filter((i: any) => i.type === "maintenance" && i.data.seriesId === series.id),
  ).toHaveLength(2);
  expect(planning.items.find((i: any) => i.id === series.id).data.nextService).toBe("2026-12-02");
  const current = planning.items.find((i: any) => i.id === series.id);
  await save(
    "facilities",
    "maintenance-series",
    { ...current.data, nextService: "2026-12-03" },
    { id: current.id, expectedVersion: current.version },
  );
  planning = await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET");
  expect(
    planning.items.find((i: any) => i.type === "maintenance" && i.data.nextService === "2026-12-02")
      .status,
  ).toBe("cancelled");
  expect(
    planning.items.filter(
      (i: any) =>
        i.type === "maintenance" &&
        i.data.seriesId === series.id &&
        !["done", "cancelled", "archived"].includes(i.status),
    ),
  ).toHaveLength(1);
  const incident = await save("facilities", "incident", {
    resourceId: room.id,
    blockResource: true,
    fault: "Synthetische Sperrprüfung",
  });
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "reserve-resource",
          data: {
            resourceId: room.id,
            startAt: "2026-11-28T09:00:00Z",
            endAt: "2026-11-28T10:00:00Z",
            quantity: 1,
          },
        },
      })
    ).status(),
  ).toBe(409);
  planning = await call(admin, "/api/theater?productionId=" + productionId, undefined, "GET");
  expect(planning.resourceBlocks.some((b: any) => b.itemId === incident.id)).toBe(true);
});
test("care cycles change real asset condition and casting changes create traceable follow-up tasks", async () => {
  await scope("Kostüm");
  const actor = await call(admin, "/api/records/actors", {
      data: { name: "QA Besetzung " + marker },
    }),
    alternate = await call(admin, "/api/records/actors", {
      data: { name: "QA Alternative " + marker },
    }),
    character = await call(admin, "/api/records/characters", {
      data: { name: "QA Figur " + marker, productionId },
    });
  const fundus = await save("costume", "asset", {
      inventoryNumber: "QA-COSTUME",
      quantity: 1,
      condition: "available",
    }),
    costume = await save("costume", "costume", {
      actorId: actor.id,
      characterId: character.id,
      assetId: fundus.id,
    });
  const care = await save("costume", "care-cycle", { assetId: fundus.id, care: "clean" });
  expect(
    (await call(admin, "/api/theater/operations?id=" + fundus.id, undefined, "GET")).item.data
      .condition,
  ).toBe("maintenance");
  const secondCare = await save("costume", "care-cycle", { assetId: fundus.id, care: "repair" });
  await save("costume", "care-cycle", care.data, {
    id: care.id,
    expectedVersion: care.version,
    status: "done",
  });
  expect(
    (await call(admin, "/api/theater/operations?id=" + fundus.id, undefined, "GET")).item.data
      .condition,
  ).toBe("maintenance");
  await save("costume", "care-cycle", secondCare.data, {
    id: secondCare.id,
    expectedVersion: secondCare.version,
    status: "done",
  });
  expect(
    (await call(admin, "/api/theater/operations?id=" + fundus.id, undefined, "GET")).item.data
      .condition,
  ).toBe("available");
  await scope("Disposition");
  const assignment = await call(admin, "/api/records/casting", {
    data: { productionId, actorId: actor.id, characterId: character.id },
  });
  const change = await save("disposition", "cast-change", {
    actorId: alternate.id,
    previousActorId: actor.id,
    characterId: character.id,
    effectiveFrom: "2099-11-02",
  });
  const impact = await call(admin, "/api/theater/operations?id=" + costume.id, undefined, "GET");
  expect(impact.item.data._castImpact.changeId).toBe(change.id);
  await scope("Kostüm");
  expect(
    (
      await call(admin, "/api/v1/records?kind=tasks&productionId=" + productionId, undefined, "GET")
    ).records.some((t: any) => t.data.affectedItemId === costume.id),
  ).toBe(true);
  await scope("Disposition");
  expect(
    (await call(admin, "/api/v1/records?kind=casting&id=" + assignment.id, undefined, "GET")).data
      .actorId,
  ).toBe(actor.id);
  await save(
    "disposition",
    "cast-change",
    { ...change.data, effectiveFrom: "2020-01-01" },
    { id: change.id, expectedVersion: change.version },
  );
  expect(
    (await call(admin, "/api/v1/records?kind=casting&id=" + assignment.id, undefined, "GET")).data
      .actorId,
  ).toBe(alternate.id);
});
test("open API counts rejected input, returns throttling headers and handles bounded concurrent reads", async () => {
  await scope("Ausstattung");
  const key = await call(admin, "/api/integrations/access", {
    action: "create",
    label: "QA limit and load",
    scopes: ["trade:read"],
    expiresInDays: 1,
  });
  const api = await request.newContext({
      baseURL: base,
      extraHTTPHeaders: { Authorization: "Bearer " + key.token },
    }),
    metrics: { ms: number; status: number }[] = [];
  const runtime = JSON.parse(fs.readFileSync(".local/runtime-development.json", "utf8")),
    worker = postgres(runtime.WORKER_DATABASE_URL, { max: 1, prepare: false });
  try {
    for (let batch = 0; batch < 5; batch++)
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          const started = performance.now(),
            r = await api.get("/api/v1/trade-items?productionId=" + productionId);
          metrics.push({ ms: Math.round(performance.now() - started), status: r.status() });
          expect(r.ok()).toBe(true);
        }),
      );
    const rejected = await api.get("/api/v1/invalid-entity");
    expect(rejected.status()).toBe(400);
    if (Date.now() % 60000 > 55000)
      await new Promise((resolve) => setTimeout(resolve, 60100 - (Date.now() % 60000)));
    await worker.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${tenant.id},true)`;
      const meters =
        await tx`select result from integration_receipts where access_id=${key.id} and request_hash='rate'`;
      expect(meters.reduce((total, row) => total + Number(row.result.count), 0)).toBe(21);
      const operationKey = "rate:" + key.id + ":" + Math.floor(Date.now() / 60000);
      await tx`insert into integration_receipts(id,organization_id,access_id,operation_key,request_hash,result) values(${randomUUID()},${tenant.id},${key.id},${operationKey},'rate','{"count":120}'::jsonb) on conflict(organization_id,operation_key) do update set result=excluded.result`;
    });
    const limited = await api.get("/api/v1/trade-items");
    expect(limited.status()).toBe(429);
    expect(limited.headers()["retry-after"]).toBe("60");
    const sorted = metrics.map((m) => m.ms).sort((a, b) => a - b);
    fs.writeFileSync(
      ".local/gaps-api-load-evidence.json",
      JSON.stringify({
        requests: metrics.length,
        concurrency: 4,
        successful: metrics.filter((m) => m.status === 200).length,
        p50Ms: sorted[9],
        p95Ms: sorted[18],
        maximumMs: sorted[19],
        environment: "development",
        measuredAt: new Date().toISOString(),
      }),
    );
  } finally {
    await worker.end();
    await api.dispose();
    await call(admin, "/api/integrations/access", { action: "revoke", id: key.id });
  }
});
