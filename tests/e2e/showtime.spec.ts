import { test, expect, request, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import * as Y from "yjs";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";
test.describe.configure({ mode: "serial" });
test.skip(
  !base.startsWith("http://127.0.0.1:3100"),
  "Synthetic acceptance data is restricted to Showtime development.",
);
let admin: APIRequestContext, alice: APIRequestContext, bob: APIRequestContext;
let scope: { organizationId: string; departmentId: string }, second: typeof scope;
let aliceId: string,
  bobId: string,
  production: string,
  chat: string,
  message: string,
  file: string,
  ticket: string;
const key = randomUUID().slice(0, 8),
  marker = "QA " + key;
async function json(api: APIRequestContext, url: string, data?: unknown, method = "POST") {
  const r = await api.fetch(url, { method, ...(data !== undefined ? { data } : {}) });
  const body = await r.json();
  expect(r.ok(), JSON.stringify({ status: r.status, url, error: body.error })).toBeTruthy();
  return body;
}
async function login(username: string, password: string) {
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  await json(api, "/api/login", { username, password });
  return api;
}
async function switchTo(api: APIRequestContext, target: typeof scope) {
  await json(api, "/api/platform/switch", target);
}
async function openWorkspace(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator(".workspace")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("h1").first()).toBeVisible();
}
async function member(label: string) {
  const invite = await json(admin, "/api/platform/configuration", {
    action: "invite",
    data: { departmentId: scope.departmentId, role: "employee" },
  });
  const username = `qa-${key}-${label}`,
    password = `QA-${randomUUID()}`;
  const registration = await request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  await json(registration, "/api/register", {
    username,
    password,
    name: marker + " " + label,
    invitation: new URL(invite.url).searchParams.get("invitation"),
  });
  await registration.dispose();
  const api = await login(username, password);
  await switchTo(api, scope);
  const own = await json(api, "/api/platform/scopes", undefined, "GET");
  return { api, id: own.user.id };
}
test.beforeAll(async () => {
  test.setTimeout(120000);
  const access = JSON.parse(fs.readFileSync(".local/access-development.json", "utf8"));
  admin = await login(access.username, access.password);
  const scopes = (await json(admin, "/api/platform/scopes", undefined, "GET")).scopes;
  scope = scopes.find(
    (s: { organizationId: string; departmentName: string }) =>
      s.organizationId === access.organizationId && s.departmentName === "Maske",
  );
  second = scopes.find(
    (s: { organizationId: string; departmentName: string }) =>
      s.organizationId !== scope.organizationId && s.departmentName === "Maske",
  );
  if (!second) {
    const tenant = await json(admin, "/api/platform/tenants", {
      name: marker + " zweites Theater",
      slug: "qa-" + key,
    });
    const joined = await json(admin, "/api/register", {
      existingAccount: true,
      invitation: new URL(tenant.invitationUrl).searchParams.get("invitation"),
    });
    await switchTo(admin, joined.scope);
    const makeup = tenant.departments.find(
      (department: { name: string }) => department.name === "Maske",
    );
    const invitation = await json(admin, "/api/platform/configuration", {
      action: "invite",
      data: { departmentId: makeup.id, role: "employee" },
    });
    await json(admin, "/api/register", {
      existingAccount: true,
      invitation: new URL(invitation.url).searchParams.get("invitation"),
    });
    second = { organizationId: tenant.id, departmentId: makeup.id };
  }
  expect(second).toBeTruthy();
  await switchTo(admin, scope);
  const a = await member("alice"),
    b = await member("bob");
  alice = a.api;
  aliceId = a.id;
  bob = b.api;
  bobId = b.id;
  const prod = await json(admin, "/api/records/productions", {
    data: { title: marker + " Produktion", status: "active", memberIds: [aliceId, bobId] },
  });
  production = prod.id;
  const c = await json(alice, "/api/records/conversations", {
    data: { title: marker + " Privat", mode: "group", participantIds: [aliceId, bobId] },
  });
  chat = c.id;
  const m = await json(alice, "/api/records/messages", {
    data: { text: marker + " private Nachricht", conversationId: chat },
  });
  message = m.id;
  fs.writeFileSync(
    ".local/acceptance-ids.json",
    JSON.stringify({ scope, second, aliceId, bobId, production, chat, message }),
  );
});
test.afterAll(async () => {
  await Promise.all([admin?.dispose(), alice?.dispose(), bob?.dispose()]);
});
test("employees only manage their own work and attendance; stale edits cannot overwrite a booking", async () => {
  for (const kind of ["time", "attendance"]) {
    const data = {
      title: marker + " " + kind,
      date: "2026-08-12",
      start: "2026-08-12T07:00:00.000Z",
      end: "2026-08-12T09:00:00.000Z",
      durationSeconds: 7200,
      pauseSeconds: 0,
      category: "other",
      idempotencyKey: randomUUID(),
    };
    const first = await json(alice, `/api/records/${kind}`, { data });
    const retried = await json(alice, `/api/records/${kind}`, { data });
    expect(retried.id).toBe(first.id);
    expect(
      (
        await bob.patch(`/api/records/${kind}/${first.id}`, {
          data: { data: { title: "Forbidden" }, version: 1 },
        })
      ).status(),
    ).toBe(403);
    const edited = await json(
      alice,
      `/api/records/${kind}/${first.id}`,
      { data: { title: marker + " korrigiert", pauseSeconds: 900 }, version: first.version },
      "PATCH",
    );
    expect(edited.data.durationSeconds).toBe(6300);
    expect(
      (
        await alice.patch(`/api/records/${kind}/${first.id}`, {
          data: { data: { title: "Stale" }, version: 1 },
        })
      ).status(),
    ).toBe(409);
    expect((await alice.delete(`/api/records/${kind}/${first.id}?version=1`)).status()).toBe(409);
    await json(
      alice,
      `/api/records/${kind}/${first.id}?version=${edited.version}`,
      undefined,
      "DELETE",
    );
  }
});
test("private chats, attachments, document tickets and exports respect current participants", async () => {
  const doc = await json(alice, "/api/documents", {
    recordKind: "messages",
    recordId: message,
    name: marker + " Dokument",
    format: "text",
  });
  file = doc.id;
  expect((await alice.get(`/api/files/${file}`)).status()).toBe(200);
  const opened = await json(bob, `/api/documents/${file}/session`, {});
  ticket = opened.access.ticket;
  expect(opened.canEdit).toBe(true);
  const document = new Y.Doc();
  Y.applyUpdate(document, Buffer.from(opened.state, "base64"));
  document.getMap("qa").set("value", marker);
  const update = Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64");
  document.destroy();
  const saved = await json(bob, `/api/documents/${file}/updates`, {
    ticket,
    update,
    sinceRevision: opened.revision,
  });
  expect(saved.revision).toBeGreaterThan(opened.revision);
  for (const url of [
    `/api/files/${file}`,
    `/api/documents/${file}/session`,
    `/api/export?kind=messages&format=json&conversationId=${chat}`,
  ]) {
    const r = url.endsWith("/session") ? await admin.post(url, { data: {} }) : await admin.get(url);
    expect([403, 404]).toContain(r.status());
  }
  const current = (
    await json(alice, "/api/workspace", undefined, "GET")
  ).records.conversations.find((c: { id: string }) => c.id === chat);
  expect(
    (
      await alice.patch(`/api/records/conversations/${chat}`, {
        data: { version: current.version, data: { participantIds: [aliceId] } },
      })
    ).status(),
  ).toBe(400);
  // Replace Bob with the theater admin: Bob's still-unexpired ticket must stop working.
  const adminIdentity = (await json(admin, "/api/platform/scopes", undefined, "GET")).user.id;
  await json(
    alice,
    `/api/records/conversations/${chat}`,
    { version: current.version, data: { participantIds: [aliceId, adminIdentity] } },
    "PATCH",
  );
  expect((await bob.get(`/api/files/${file}`)).status()).toBe(403);
  expect(
    (
      await bob.post(`/api/documents/${file}/updates`, {
        data: { ticket, update, sinceRevision: saved.revision },
      })
    ).status(),
  ).toBe(403);
  const exported = await alice.get(`/api/documents/${file}/export?format=docx`);
  expect(exported.status()).toBe(200);
  expect((await exported.body()).subarray(0, 2).toString()).toBe("PK");
  fs.writeFileSync(".local/acceptance-document.json", JSON.stringify({ file, marker, scope }));
});
test("cross-theater IDs cannot be reached through queries, writes, files, documents or export", async () => {
  await switchTo(admin, second);
  const workspace = await json(admin, "/api/workspace", undefined, "GET");
  expect(workspace.records.productions.some((p: { id: string }) => p.id === production)).toBe(
    false,
  );
  expect(
    (
      await admin.patch(`/api/records/productions/${production}`, {
        data: { version: 1, data: { title: "Cross theater" } },
      })
    ).status(),
  ).toBe(404);
  for (const url of [
    `/api/files/${file}`,
    `/api/documents/${file}/session`,
    `/api/export?kind=messages&format=json&conversationId=${chat}`,
  ])
    expect([403, 404]).toContain(
      (url.endsWith("/session")
        ? await admin.post(url, { data: {} })
        : await admin.get(url)
      ).status(),
    );
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "schedule",
          data: {
            action: "performance",
            data: { productionId: production, curtainAt: "2026-12-10T17:00:00.000Z" },
          },
        },
      })
    ).status(),
  ).toBe(404);
  await switchTo(admin, scope);
});
test("resources, readiness and published plan versions reject conflicting or stale planning", async () => {
  const resource = await json(admin, "/api/theater", {
    action: "save-resource",
    data: {
      name: marker + " Probebühne",
      type: "stage",
      capacity: 1,
      departmentId: null,
      setupMinutes: 15,
      teardownMinutes: 15,
    },
  });
  const booking = {
    resourceId: resource.id,
    startAt: "2026-12-17T10:00:00.000Z",
    endAt: "2026-12-17T12:00:00.000Z",
  };
  await json(admin, "/api/theater", { action: "reserve-resource", data: booking });
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "reserve-resource",
          data: {
            ...booking,
            startAt: "2026-12-17T12:00:00.000Z",
            endAt: "2026-12-17T13:00:00.000Z",
          },
        },
      })
    ).status(),
  ).toBe(409);
  const stage = await admin.post("/api/theater", {
    data: {
      action: "schedule",
      data: {
        action: "production-metadata",
        data: { recordId: production, stage: "dress-rehearsal" },
      },
    },
  });
  expect(stage.status()).toBe(409);
  const draft = await json(admin, "/api/theater", {
    action: "schedule",
    data: { action: "schedule-draft", data: { from: "2026-12-01", to: "2026-12-31" } },
  });
  const show = await json(admin, "/api/theater", {
    action: "schedule",
    data: {
      action: "performance",
      data: { productionId: production, curtainAt: "2026-12-18T17:00:00.000Z", status: "planned" },
    },
  });
  expect(show.eventId).toBeTruthy();
  expect(
    (
      await admin.post("/api/theater", {
        data: { action: "schedule", data: { action: "schedule-approve", id: draft.id } },
      })
    ).status(),
  ).toBe(409);
  const fresh = await json(admin, "/api/theater", {
    action: "schedule",
    data: { action: "schedule-draft", data: { from: "2026-12-01", to: "2026-12-31" } },
  });
  await json(admin, "/api/theater", {
    action: "schedule",
    data: { action: "schedule-approve", id: fresh.id },
  });
  const published = await json(admin, "/api/theater", {
    action: "schedule",
    data: { action: "schedule-publish", id: fresh.id },
  });
  expect(published.state).toBe("published");
});
test("tenant membership withdrawal invalidates existing document and calendar access", async () => {
  // Bob receives the group again, opens a fresh ticket and personal calendar subscription.
  const current = (
    await json(alice, "/api/workspace", undefined, "GET")
  ).records.conversations.find((c: { id: string }) => c.id === chat);
  await json(
    alice,
    `/api/records/conversations/${chat}`,
    { version: current.version, data: { participantIds: [aliceId, bobId] } },
    "PATCH",
  );
  const opened = await json(bob, `/api/documents/${file}/session`, {});
  const token = await json(bob, "/api/actions", { action: "calendar-token", data: {} });
  const calendarPath = new URL(token.url).pathname;
  expect((await bob.get(calendarPath)).status()).toBe(200);
  await json(admin, "/api/platform/configuration", {
    action: "member",
    data: { userId: bobId, status: "disabled" },
  });
  for (const url of ["/api/workspace", `/api/files/${file}`, calendarPath])
    expect([401, 403, 404]).toContain((await bob.get(url)).status());
  expect([401, 403, 404]).toContain(
    (
      await bob.post(`/api/documents/${file}/state`, { data: { ticket: opened.access.ticket } })
    ).status(),
  );
  await json(admin, "/api/platform/configuration", {
    action: "member",
    data: { userId: bobId, status: "active" },
  });
});
test("production readiness gates final rehearsals and budgets cannot be self-approved or overspent", async () => {
  const overview = await json(admin, `/api/theater?productionId=${production}`, undefined, "GET");
  for (const module of overview.readiness.filter((m: { required: boolean }) => m.required)) {
    await switchTo(admin, {
      organizationId: scope.organizationId,
      departmentId: module.departmentId,
    });
    await json(admin, "/api/theater", {
      action: "save-item",
      data: {
        moduleId: module.moduleId,
        type: "readiness",
        title: marker + " Bereit",
        productionId: production,
        status: "ready",
        data: { ready: true, notes: "Synthetische Abnahme" },
      },
    });
  }
  await switchTo(admin, scope);
  const stage = await json(admin, "/api/theater", {
    action: "schedule",
    data: {
      action: "production-metadata",
      data: { recordId: production, stage: "dress-rehearsal" },
    },
  });
  expect(stage.stage).toBe("dress-rehearsal");
  const budget = await json(admin, "/api/theater", {
    action: "save-item",
    data: {
      moduleId: "administration",
      type: "budget",
      title: marker + " Budget",
      productionId: production,
      status: "published",
      data: { amountCents: 10000, department: scope.departmentId, costCentre: "QA" },
    },
  });
  const purchase = async (api: APIRequestContext, amount: number) =>
    json(api, "/api/theater", {
      action: "save-item",
      data: {
        moduleId: "administration",
        type: "purchase",
        title: marker + " Bedarf",
        productionId: production,
        status: "review",
        data: { item: "Synthetischer Bedarf", budgetId: budget.id, amountCents: amount },
      },
    });
  const own = await purchase(admin, 1000);
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "approve-purchase",
          data: { id: own.id, expectedVersion: own.version, decision: "approved" },
        },
      })
    ).status(),
  ).toBe(403);
  const requested = await purchase(alice, 8000);
  expect(
    (
      await json(admin, "/api/theater", {
        action: "approve-purchase",
        data: { id: requested.id, expectedVersion: requested.version, decision: "approved" },
      })
    ).status,
  ).toBe("approved");
  const extra = await purchase(alice, 3000);
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "approve-purchase",
          data: { id: extra.id, expectedVersion: extra.version, decision: "approved" },
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
            id: budget.id,
            expectedVersion: budget.version,
            moduleId: "administration",
            type: "budget",
            title: marker + " kleiner",
            productionId: production,
            status: "published",
            data: { amountCents: 5000, department: scope.departmentId, costCentre: "QA" },
          },
        },
      })
    ).status(),
  ).toBe(409);
});
test("Svelte screens render on desktop, light, dark and mobile without runtime errors", async ({
  page,
}) => {
  const state = await admin.storageState();
  await page.context().addCookies(state.cookies);
  await json(admin, "/api/actions", {
    action: "profile-update",
    data: { onboardingCompleted: true },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const module of [
    "today",
    "productions",
    "calendar",
    "tasks",
    "time",
    "chat",
    "people",
    "actors",
    "documentation",
    "inventory",
    "handovers",
    "exports",
    "help",
    "settings",
    "theater",
  ]) {
    await page.goto(module === "today" ? "/" : `/?module=${module}`);
    await expect(page.locator(".workspace")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("h1").first()).toBeVisible();
    await page.screenshot({ path: `.local/screens/${module}-desktop.png`, fullPage: true });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.screenshot({ path: ".local/screens/today-light.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  for (const module of ["today", "calendar", "time", "chat", "theater"]) {
    await page.goto(`/?module=${module}`);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.screenshot({ path: `.local/screens/${module}-mobile.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});
test("booked work and attendance can be edited and deleted through the interface", async ({
  page,
}) => {
  await page.context().addCookies((await admin.storageState()).cookies);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  for (const kind of ["time", "attendance"]) {
    const name = marker + " Oberfläche " + kind;
    const record = await json(admin, `/api/records/${kind}`, {
      data: {
        title: name,
        date: today,
        durationSeconds: 3600,
        pauseSeconds: 0,
        category: "other",
        ...(kind === "attendance"
          ? { start: today + "T07:00:00.000Z", end: today + "T08:00:00.000Z" }
          : {}),
      },
    });
    await page.goto(`/?module=time&record=${record.id}`);
    const detail = page.getByRole("dialog").last();
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Bearbeiten", exact: true }).click();
    const editor = page.getByRole("dialog").last();
    await editor
      .getByLabel(kind === "time" ? "Tätigkeit" : "Bezeichnung (optional)", { exact: true })
      .fill(name + " korrigiert");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/records/${kind}/${record.id}`) && r.request().method() === "PATCH",
    );
    await editor.getByRole("button", { name: "Speichern", exact: true }).click();
    const saved = await response;
    expect(saved.status()).toBe(200);
    expect((await saved.json()).data.title).toBe(name + " korrigiert");
    await page.goto(`/?module=time&record=${record.id}`);
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Bearbeiten", exact: true })
      .click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Buchung löschen" }).click();
    await expect(page.getByRole("button", { name: "Buchung löschen" })).toHaveCount(0);
    const workspace = await json(admin, "/api/workspace", undefined, "GET");
    expect(workspace.records[kind].some((r: { id: string }) => r.id === record.id)).toBe(false);
  }
});
test("keyboard navigation restores focus across search, mobile menus, calendars and document dialogs", async ({ page }) => {
  await json(admin, "/api/actions", { action: "profile-update", data: { onboardingCompleted: true } });
  await page.context().addCookies((await admin.storageState()).cookies);
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("console", (message) => { if (message.type() === "warning" && message.text().includes("SvelteKit's router")) warnings.push("Router warning"); });
  await openWorkspace(page, "/");
  const searchTrigger = page.locator(".global-search-button");
  await searchTrigger.focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("textbox", { name: "Suchbegriff" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchTrigger).toBeFocused();
  await page.locator('.sidebar button[aria-label="Produktionen"]').click();
  await expect(page.locator("h1").first()).toHaveText("Produktionen");
  await page.goBack();
  await expect(page.locator(".nav-item.active")).toHaveAttribute("aria-label", "Heute");
  await page.goForward();
  await expect(page.locator("h1").first()).toHaveText("Produktionen");

  await page.setViewportSize({ width: 390, height: 844 });
  const menuTrigger = page.getByRole("button", { name: "Menü öffnen", exact: true });
  await menuTrigger.focus();
  await menuTrigger.press("Enter");
  await expect(page.locator(".sidebar.mobile-open")).toBeVisible();
  await page.screenshot({ path: ".local/screens/warnings-mobile-menu.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
  await expect(menuTrigger).toBeFocused();

  await openWorkspace(page, "/?module=productions");
  const more = page.getByLabel("Weitere Aktionen", { exact: true });
  await more.focus();
  await more.press("Enter");
  await expect(more.locator("..")).toHaveAttribute("open", "");
  await more.press("Escape");
  await expect(more.locator("..")).not.toHaveAttribute("open");
  await expect(more).toBeFocused();
  await more.press("Space");
  await page.getByRole("button", { name: "Exportieren", exact: true }).press("Enter");
  await expect(page.getByRole("dialog").last()).toBeVisible();
  await expect(more.locator("..")).not.toHaveAttribute("open");
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();

  await openWorkspace(page, "/?module=calendar");
  const calendarActions = page.locator(".calendar-mobile-actions summary");
  await calendarActions.press("Enter");
  await expect(calendarActions.locator("..")).toHaveAttribute("open", "");
  await calendarActions.press("Escape");
  await expect(calendarActions.locator("..")).not.toHaveAttribute("open");
  await expect(calendarActions).toBeFocused();
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "Teammonat", exact: true }).click();
  const region = page.getByRole("region", { name: "Teammonatskalender", exact: true });
  await expect(region).toHaveAttribute("tabindex", "0");
  await region.focus();
  await region.press("Home");
  await region.press("ArrowRight");
  await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await region.press("Home");
  const day = page.locator(".team-day-heading").first();
  await day.press("Enter");
  await expect(page.getByRole("button", { name: "Tagesdetails schließen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(day).toBeFocused();

  await openWorkspace(page, "/?module=chat");
  const attachments = page.getByRole("button", { name: "Anhänge und Dokumente", exact: true });
  await attachments.press("Enter");
  await page.getByRole("button", { name: "Gemeinsames Dokument anlegen", exact: true }).press("Enter");
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
  await page.screenshot({ path: ".local/screens/warnings-document-focus.png" });
  await expect(attachments).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(attachments).toBeFocused();
  await attachments.press("Enter");
  await page.keyboard.press("Escape");
  await expect(attachments).toBeFocused();
  await expect(attachments).toHaveAttribute("aria-expanded", "false");

  await openWorkspace(page, "/?module=help");
  await page.getByRole("button", { name: "Einführung neu starten" }).press("Enter");
  await expect(page.locator(".onboarding-body h3")).toBeFocused();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});

test("mask plan placement works with keyboard and pointer; embedded contacts submit with Enter", async ({ page }) => {
  await json(admin, "/api/actions", { action: "profile-update", data: { onboardingCompleted: true } });
  await page.context().addCookies((await admin.storageState()).cookies);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const lanes = Array.from({ length: 5 }, (_, index) => ({
    id: randomUUID(), label: "QA Spalte " + (index + 1), memberIds: [], staffNames: [],
  }));
  const plan = await json(admin, "/api/records/maskPlans", {
    data: { productionId: production, title: marker + " Tastatur", windowMinutes: 90, stepMinutes: 5, lanes, blocks: [] },
  });
  await page.setViewportSize({ width: 900, height: 1000 });
  await openWorkspace(page, `/?module=productions&productionId=${production}&tab=mask-plan&record=${plan.id}`);
  const region = page.getByRole("region", { name: "Maskenplan-Zeittabelle, horizontal und vertikal scrollbar" });
  await expect(region).toHaveAttribute("tabindex", "0");
  await page.getByRole("button", { name: "Plan bearbeiten", exact: true }).press("Enter");
  const place = page.getByRole("button", { name: "Zeitblock platzieren", exact: true });
  const descriptionId = await place.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  await expect(page.locator(`[id="${descriptionId}"]`)).toContainText("Zum Bearbeiten");
  await place.press("Enter");
  const target = page.getByRole("button", { name: "Neuen Zeitblock platzieren bei QA Spalte 1", exact: true });
  await target.focus();
  await target.press("Space");
  let editor = page.getByRole("dialog").last();
  await expect(editor.getByRole("combobox", { name: "Personalspalte", exact: true })).toHaveValue(lanes[0].id);
  await editor.getByLabel("Tätigkeit / Zusatz (optional)").fill(marker + " Tastaturblock");
  await editor.getByRole("button", { name: "Übernehmen", exact: true }).press("Enter");
  await expect(page.locator("[data-mask-block]")).toHaveCount(1);

  await page.getByRole("button", { name: "Zeitblock platzieren", exact: true }).click();
  const pointerTarget = page.getByRole("button", { name: "Neuen Zeitblock platzieren bei QA Spalte 2", exact: true });
  await pointerTarget.scrollIntoViewIfNeeded();
  await pointerTarget.click({ position: { x: 40, y: 320 } });
  editor = page.getByRole("dialog").last();
  await expect(editor.getByRole("combobox", { name: "Personalspalte", exact: true })).toHaveValue(lanes[1].id);
  expect(Number(await editor.getByLabel("Minuten vor Beginn").inputValue())).toBeGreaterThan(30);
  await editor.getByLabel("Tätigkeit / Zusatz (optional)").fill(marker + " Mausblock");
  await editor.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(page.locator("[data-mask-block]")).toHaveCount(2);
  await page.screenshot({ path: ".local/screens/warnings-mask-plan.png", fullPage: true });
  const saving = page.waitForResponse((response) => response.url().endsWith(`/api/records/maskPlans/${plan.id}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Speichern", exact: true }).filter({ visible: true }).click();
  const saved = await saving;
  expect(saved.ok()).toBeTruthy();
  expect((await saved.json()).data.blocks).toHaveLength(2);

  await openWorkspace(page, `/?module=productions&productionId=${production}&tab=team`);
  await page.getByRole("button", { name: "Team & Kontakte bearbeiten", exact: true }).click();
  editor = page.getByRole("dialog").last();
  await editor.getByRole("button", { name: "Kontakt hinzufügen", exact: true }).click();
  const contact = editor.locator(".production-contact-form").last();
  await contact.getByRole("button", { name: "Person anlegen", exact: true }).click();
  const personName = contact.getByLabel("Name *", { exact: true });
  await personName.fill(marker + " Kontakt");
  const creating = page.waitForResponse((response) => response.url().endsWith("/api/records/people") && response.request().method() === "POST");
  await personName.press("Enter");
  expect((await creating).ok()).toBeTruthy();
  await expect(contact.locator("strong").filter({ hasText: marker + " Kontakt" })).toBeVisible();
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("a guest only sees the assigned production and loses tickets and exports after expiry", async () => {
  const document = await json(admin, "/api/documents", {
    recordKind: "productions",
    recordId: production,
    name: marker + " Gastdokument",
    format: "sheet",
  });
  const configuration = await json(admin, "/api/platform/configuration", undefined, "GET");
  for (const grant of configuration.grants.filter((g: { userId: string }) => g.userId === bobId))
    await json(admin, "/api/platform/configuration", {
      action: "grant-revoke",
      data: { id: grant.id },
    });
  const expiresAt = Date.now() + 12000;
  await json(admin, "/api/platform/configuration", {
    action: "grant",
    data: {
      userId: bobId,
      role: "guest",
      scope: "production",
      scopeId: production,
      expiresAt: new Date(expiresAt).toISOString(),
    },
  });
  const opened = await json(bob, `/api/documents/${document.id}/session`, {});
  expect(opened.canEdit).toBe(false);
  const workspace = await json(bob, "/api/workspace", undefined, "GET");
  expect(workspace.records.productions.map((p: { id: string }) => p.id)).toEqual([production]);
  expect(workspace.records.time).toHaveLength(0);
  const secondProduction =
    configuration.modules.length &&
    (await json(admin, "/api/records/productions", {
      data: { title: marker + " andere Produktion", status: "active", memberIds: [aliceId] },
    }));
  expect((await bob.get(`/api/theater?productionId=${secondProduction.id}`)).status()).toBe(403);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, expiresAt - Date.now() + 500)));
  for (const url of [
    `/api/files/${document.id}`,
    `/api/export?kind=productions&format=json&productionId=${production}`,
  ])
    expect([401, 403, 404]).toContain((await bob.get(url)).status());
  expect([401, 403, 404]).toContain(
    (
      await bob.post(`/api/documents/${document.id}/state`, {
        data: { ticket: opened.access.ticket },
      })
    ).status(),
  );
});
test("Office editors persist typed text and spreadsheet cells through the Svelte interface", async ({
  page,
}) => {
  await page.context().addCookies((await alice.storageState()).cookies);
  await json(alice, "/api/actions", {
    action: "profile-update",
    data: { onboardingCompleted: true },
  });
  const sheet = await json(alice, "/api/documents", {
    recordKind: "messages",
    recordId: message,
    name: marker + " Tabelle",
    format: "sheet",
  });
  const open = async (name: string) => {
    await page.goto("/?module=chat");
    await page
      .getByText(marker + " Privat", { exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".document-editor-dialog")).toBeVisible();
  };
  await open(marker + " Dokument");
  const editor = page.getByLabel("Dokumenttext");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  let updated = page.waitForResponse(
    (response) => response.url().endsWith(`/api/documents/${file}/updates`) && response.ok(),
  );
  await editor.fill(marker + " Textinhalt");
  await updated;
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await open(marker + " Dokument");
  await expect(editor).toContainText(marker + " Textinhalt");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await open(marker + " Tabelle");
  const cell = page.getByLabel("Zelle A1 bearbeiten");
  await expect(cell).toBeEnabled();
  updated = page.waitForResponse(
    (response) => response.url().endsWith(`/api/documents/${sheet.id}/updates`) && response.ok(),
  );
  await cell.fill(marker + " Zellwert");
  await cell.press("Enter");
  await updated;
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await open(marker + " Tabelle");
  await expect(page.getByText(marker + " Zellwert", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
});

test("each of the twenty trades can persist its own typed workflow and publish a show report", async () => {
  const overview = await json(admin, `/api/theater?productionId=${production}`, undefined, "GET");
  expect(overview.modules).toHaveLength(20);
  for (const [index, activation] of overview.modules.entries()) {
    await switchTo(admin, {
      organizationId: scope.organizationId,
      departmentId: activation.config.departmentId,
    });
    const feature = activation.manifest.features[0],
      data: Record<string, unknown> = {};
    for (const field of feature.fields) {
      if (["record", "resource", "budget", "department", "member"].includes(field.type)) continue;
      data[field.key] =
        field.type === "datetime"
          ? new Date(Date.UTC(2029, 0, 2, 8 + index, field.key === "end" ? 30 : 0)).toISOString()
          : field.type === "date"
            ? "2029-01-02"
            : field.type === "number"
              ? field.key === "pauseMinutes"
                ? 0
                : 100
              : field.type === "checkbox"
                ? false
                : field.type === "members"
                  ? []
                  : field.type === "select"
                    ? field.options[0]
                    : marker + " Fachinhalt";
    }
    const item = await json(admin, "/api/theater", {
      action: "save-item",
      data: {
        moduleId: activation.moduleId,
        type: feature.id,
        title: marker + " " + activation.manifest.label,
        productionId: production,
        status: "draft",
        data,
      },
    });
    expect(item.moduleId).toBe(activation.moduleId);
    expect(item.departmentId).toBe(activation.config.departmentId);
  }
  const inspizienz = overview.modules.find(
    (entry: { moduleId: string }) => entry.moduleId === "stage-management",
  );
  expect(inspizienz).toBeTruthy();
  await switchTo(admin, {
    organizationId: scope.organizationId,
    departmentId: inspizienz.config.departmentId,
  });
  const report = await json(admin, "/api/theater", {
    action: "save-item",
    data: {
      moduleId: inspizienz.moduleId,
      type: "show-report",
      title: marker + " Vorstellungsbericht",
      productionId: production,
      status: "published",
      data: {
        date: "2029-01-02",
        changes: "Synthetischer Vorstellungsbericht",
        incidents: "Keine Störung",
        targetDepartments: "lighting",
      },
    },
  });
  expect(report.status).toBe("published");
  await switchTo(admin, scope);
});

test("work, season and series references survive versioned production phase changes", async ({
  page,
}) => {
  await switchTo(admin, scope);
  const command = (
    action: string,
    data: Record<string, unknown>,
    options: Record<string, unknown> = {},
  ) => json(admin, "/api/theater", { action: "schedule", data: { action, data, ...options } });
  const core = await json(admin, "/api/records/productions", {
    data: { title: marker + " Theaterkern", status: "active", memberIds: [aliceId] },
  });
  const work = await command("work", {
    title: marker + " Werk",
    author: "Synthetische Autorenschaft",
  });
  const season = await command("season", {
    label: marker + " Spielzeit",
    start: "2028-08-01",
    end: "2029-07-31",
  });
  const initial = await command("production-metadata", {
    recordId: core.id,
    workId: work.id,
    seasonId: season.id,
    stage: "concept",
  });
  const changed = await command(
    "production-metadata",
    { recordId: core.id, stage: "development" },
    { expectedVersion: initial.version },
  );
  expect(changed.workId).toBe(work.id);
  expect(changed.seasonId).toBe(season.id);
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "schedule",
          data: {
            action: "production-metadata",
            expectedVersion: initial.version,
            data: { recordId: core.id, stage: "workshop" },
          },
        },
      })
    ).status(),
  ).toBe(409);
  const run = await command("run", {
    productionId: core.id,
    label: marker + " Serie",
    start: "2029-01-01",
    end: "2029-03-01",
  });
  const show = await command("performance", {
    productionId: core.id,
    runId: run.id,
    curtainAt: "2029-01-20T19:00:00.000Z",
    participantIds: [],
  });
  expect(show.runId).toBe(run.id);
  const before = await json(admin, `/api/theater?productionId=${core.id}`, undefined, "GET");
  expect(
    before.productionMetadata.some(
      (row: { workId: string; seasonId: string }) =>
        row.workId === work.id && row.seasonId === season.id,
    ),
  ).toBe(true);
  await json(admin, "/api/actions", {
    action: "profile-update",
    data: { onboardingCompleted: true },
  });
  await page.context().addCookies((await admin.storageState()).cookies);
  await page.goto("/?module=theater");
  await page.getByRole("tab", { name: "Spielplan", exact: true }).click();
  const phaseForm = page.locator("form").filter({ has: page.locator('select[name="recordId"]') });
  await phaseForm.locator('select[name="recordId"]').selectOption(core.id);
  await expect(phaseForm.locator('select[name="workId"]')).toHaveValue(work.id);
  await expect(phaseForm.locator('select[name="seasonId"]')).toHaveValue(season.id);
  await phaseForm.locator('select[name="stage"]').selectOption("workshop");
  const savedInUI = page.waitForResponse(
    (response) => response.url().endsWith("/api/theater") && response.request().method() === "POST",
  );
  await phaseForm.getByRole("button", { name: "Phase und Zuordnung speichern" }).click();
  expect((await savedInUI).status()).toBe(201);
  const afterUI = await json(admin, `/api/theater?productionId=${core.id}`, undefined, "GET");
  expect(
    afterUI.productionMetadata.find((row: { recordId: string }) => row.recordId === core.id),
  ).toMatchObject({ workId: work.id, seasonId: season.id, stage: "workshop" });
  const configuration = await json(admin, "/api/platform/configuration", undefined, "GET");
  for (const type of [
    "TheaterWorkCreatedV1",
    "TheaterSeasonCreatedV1",
    "ProductionMetadataChangedV1",
    "ProductionRunCreatedV1",
  ])
    expect(configuration.events.some((event: { type: string }) => event.type === type)).toBe(true);
  await switchTo(admin, second);
  expect(
    (
      await admin.post("/api/theater", {
        data: {
          action: "schedule",
          data: {
            action: "production-metadata",
            data: { recordId: core.id, workId: work.id, seasonId: season.id, stage: "concept" },
          },
        },
      })
    ).status(),
  ).toBe(404);
  await switchTo(admin, scope);
});

test("only deliberately forwarded feedback reaches platform support; theater suspension revokes sessions", async () => {
  const feedback = await json(alice, "/api/records/feedback", {
    data: {
      type: "bug",
      title: marker + " Support",
      description: "Synthetische ausdrücklich freigegebene Rückmeldung.",
    },
  });
  expect(
    (await json(admin, "/api/platform/support", undefined, "GET")).some(
      (entry: { title: string }) => entry.title === feedback.data.title,
    ),
  ).toBe(false);
  expect((await alice.get("/api/platform/support")).status()).toBe(403);
  expect(
    (await admin.post("/api/support", { data: { id: feedback.id, consent: true } })).status(),
  ).toBe(403);
  const submitted = await json(alice, "/api/support", { id: feedback.id, consent: true });
  expect(
    (await json(admin, "/api/platform/support", undefined, "GET")).some(
      (entry: { id: string }) => entry.id === submitted.id,
    ),
  ).toBe(true);
  expect(
    (
      await alice.patch("/api/platform/support", {
        data: { id: submitted.id, version: submitted.version, status: "done" },
      })
    ).status(),
  ).toBe(403);
  await json(
    admin,
    "/api/platform/support",
    { id: submitted.id, version: submitted.version, status: "done" },
    "PATCH",
  );
  expect(
    (await json(alice, "/api/support", undefined, "GET")).find(
      (entry: { id: string }) => entry.id === submitted.id,
    ).status,
  ).toBe("done");
  expect(
    (
      await alice.patch("/api/platform/tenants", {
        data: { id: second.organizationId, status: "disabled" },
      })
    ).status(),
  ).toBe(403);
  await switchTo(admin, second);
  await json(
    admin,
    "/api/platform/tenants",
    { id: second.organizationId, status: "disabled" },
    "PATCH",
  );
  expect([403, 409]).toContain((await admin.get("/api/workspace")).status());
  await json(
    admin,
    "/api/platform/tenants",
    { id: second.organizationId, status: "active" },
    "PATCH",
  );
  await switchTo(admin, scope);
});
