/** Add a labelled, linked demonstration; never changes DigitalMask or existing credentials. */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Context } from "../src/platform/context";
import type { Grant, TheaterRole } from "../src/platform/access";
import type { RecordData } from "../src/shared/contracts";

const [environment, organizationId, username, confirmation] = process.argv.slice(2);
if (
  !["development", "preview", "production"].includes(environment) ||
  !organizationId ||
  !username ||
  confirmation !== "--apply"
)
  throw new Error(
    "Usage: seed-theater-expansion.ts <environment> <tenant-id> <authorized-username> --apply",
  );
Object.assign(
  process.env,
  JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8")),
);
delete process.env.VERCEL;
const { authDb, controlDb, authSql, controlSql, appSql, workerSql } =
  await import("../src/platform/db/connections");
const t = await import("../src/platform/db/schema"),
  { eq, and, sql } = await import("drizzle-orm");
const { auth } = await import("../src/platform/auth"),
  { db } = await import("../src/platform/db");
const { requestScope } = await import("../src/platform/request"),
  { tenantTransaction } = await import("../src/platform/db/tenant");
const { availableScopes, effectiveGrants, can } = await import("../src/platform/context");
const { allowedPermissions } = await import("../src/platform/access");
const { moduleRegistry } = await import("../src/modules/theater/registry");
const { saveRecord } = await import("../src/modules/records/service");
const { saveTradeItem, saveResource, scheduleAction, approvePurchase } =
  await import("../src/modules/theater/service");
const { createCollaboration, replyCollaboration, collaborationDetail } =
  await import("../src/modules/theater/collaborations");
const { ensureTradeFileParent } = await import("../src/modules/theater/files");
const { uploadFile } = await import("../src/modules/files/service");
const { processEvents } = await import("../src/platform/events");
const { migratedId } = await import("../src/platform/migration/digitalmask");
const { theaterInstant } = await import("../src/shared/theater-time");
const demoPath = `.local/theater-demo-${environment}-${organizationId}.json`;
type Account = {
  key: string;
  username: string;
  password: string;
  name: string;
  userId?: string;
  roles: TheaterRole[];
  departments: string[];
  scope: Grant["scope"] | "platform";
};
const demo: {
  organizationId: string;
  accounts: Record<string, Account>;
  entries: Record<string, string>;
  createdAt: string;
  complete?: boolean;
} = fs.existsSync(demoPath)
  ? JSON.parse(fs.readFileSync(demoPath, "utf8"))
  : { organizationId, accounts: {}, entries: {}, createdAt: new Date().toISOString() };
const statePath = `.local/theater-expansion-${environment}-${organizationId}.json`;
const state: {
  organizationId: string;
  entries: Record<string, string>;
  createdAt: string;
  complete?: boolean;
} = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { organizationId, entries: {}, createdAt: new Date().toISOString() };
const checkpoint = () => {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(demoPath, JSON.stringify(demo, null, 2));
};
const request = new Request(process.env.APP_URL + "/api/theater", {
  method: "POST",
  headers: { origin: process.env.APP_URL! },
});
const run = <T>(context: Context, work: () => Promise<T>) =>
  requestScope.run({ request, context, after: [] }, () => tenantTransaction(context, work, true));
let stage = "authorize",
  newEntries = 0,
  newAccounts = 0;
try {
  const [actor] = await authDb
    .select()
    .from(t.user)
    .where(sql`lower(${t.user.username}) = ${username.toLowerCase()}`);
  const [platform] = actor
    ? await controlDb.select().from(t.platformAdmins).where(eq(t.platformAdmins.userId, actor.id))
    : [];
  const [settings] = await controlDb
    .select()
    .from(t.tenantSettings)
    .where(eq(t.tenantSettings.organizationId, organizationId));
  const [organization] = await controlDb
    .select()
    .from(t.organizations)
    .where(eq(t.organizations.id, organizationId));
  if (
    !actor ||
    !platform ||
    !organization ||
    settings?.status !== "active" ||
    state.organizationId !== organizationId ||
    demo.organizationId !== organizationId
  )
    throw new Error("Explicit active demo tenant and authorized platform actor required");
  const departments = await controlDb
    .select()
    .from(t.departments)
    .where(eq(t.departments.organizationId, organizationId));
  const modules = await controlDb
    .select()
    .from(t.moduleActivations)
    .where(
      and(
        eq(t.moduleActivations.organizationId, organizationId),
        eq(t.moduleActivations.enabled, true),
      ),
    );
  const departmentFor = (id: string) => {
    const value = String(modules.find((m) => m.moduleId === id)?.config.departmentId || "");
    if (!departments.some((d) => d.id === value)) throw new Error("Active trade required");
    return value;
  };
  // This explicit synthetic-data operation extends the existing admin affiliation to the new trade.
  const existingGrants = await effectiveGrants(
    actor.id,
    organizationId,
    await availableScopes(actor.id),
  );
  if (
    !existingGrants.some((g) => g.role === "theater_admin" && g.scope === "tenant") ||
    !existingGrants.some((g) => g.role === "production_lead" && g.scope === "tenant")
  )
    throw new Error(
      "Existing explicit theater administration and production provisioning grants required",
    );
  await controlDb
    .insert(t.memberships)
    .values({
      id: migratedId(organizationId, `expansion:admin:${actor.id}:design`),
      organizationId,
      departmentId: departmentFor("design"),
      userId: actor.id,
      role: "user",
      status: "active",
    })
    .onConflictDoNothing();
  const namespace =
    settings.slug === "stadttheater-ingolstadt"
      ? "in.demo."
      : `demo.${organizationId.slice(0, 6)}.`;
  for (const module of moduleRegistry) {
    const key = "trade:" + module.id,
      departmentId = departmentFor(module.id);
    if (demo.accounts[key]?.userId) continue;
    stage = "account:" + module.id;
    const credential = demo.accounts[key] || {
      key,
      username: namespace + "g." + module.id,
      password: randomBytes(24).toString("base64url"),
      name: "DEMO · Leitung " + module.department,
      roles: ["team_lead"] as TheaterRole[],
      departments: [departmentId],
      scope: "department" as const,
    };
    demo.accounts[key] = credential;
    checkpoint();
    let [person] = await authDb
      .select()
      .from(t.user)
      .where(eq(t.user.username, credential.username));
    if (
      person &&
      (person.email !== credential.username + "@demo.showtime.invalid" ||
        person.name !== credential.name)
    )
      throw new Error("Demo username belongs to a different identity");
    if (!person) {
      const result = await auth.api.signUpEmail({
        body: {
          username: credential.username,
          name: credential.name,
          email: credential.username + "@demo.showtime.invalid",
          password: credential.password,
        },
      });
      person = result.user as typeof person;
      if (result.token) await authDb.delete(t.session).where(eq(t.session.token, result.token));
      newAccounts++;
    }
    credential.userId = person.id;
    checkpoint();
    await controlDb.transaction(async (tx) => {
      await tx
        .insert(t.tenantMembers)
        .values({ organizationId, userId: person.id, status: "active" })
        .onConflictDoNothing();
      await tx
        .insert(t.memberships)
        .values({
          id: migratedId(organizationId, "expansion:member:" + person.id),
          organizationId,
          departmentId,
          userId: person.id,
          status: "active",
          role: "user",
        })
        .onConflictDoNothing();
      await tx
        .insert(t.permissionGrants)
        .values({
          id: migratedId(organizationId, "expansion:grant:" + person.id),
          organizationId,
          userId: person.id,
          role: "team_lead",
          scope: "department",
          scopeId: departmentId,
        })
        .onConflictDoNothing();
    });
  }
  async function contextFor(userId: string, moduleId: string): Promise<Context> {
    const departmentId = departmentFor(moduleId),
      scopes = await availableScopes(userId);
    if (
      !scopes.some(
        (s) =>
          s.organizationId === organizationId &&
          s.departmentId === departmentId &&
          s.status === "active",
      )
    )
      throw new Error("Current explicit department membership required");
    const grants = await effectiveGrants(userId, organizationId, scopes),
      [person] = await authDb.select().from(t.user).where(eq(t.user.id, userId));
    return {
      organizationId,
      organizationName: organization.name,
      departmentId,
      departmentName: departments.find((d) => d.id === departmentId)!.name,
      timezone: settings.timezone,
      grants,
      activeDepartmentIds: scopes
        .filter((s) => s.organizationId === organizationId && s.status === "active")
        .map((s) => s.departmentId),
      user: {
        id: userId,
        username: person.username || "",
        name: person.name,
        role: "user",
        status: "active",
        departmentId,
        grants,
        permissions: allowedPermissions({ id: userId, grants }, { departmentId }),
      },
    };
  }
  const admin = await contextFor(actor.id, "disposition"),
    contexts: Record<string, Context> = {};
  for (const module of moduleRegistry)
    contexts[module.id] = await contextFor(demo.accounts["trade:" + module.id].userId!, module.id);
  async function step(key: string, context: Context, work: () => Promise<{ id: string }>) {
    if (state.entries[key]) return state.entries[key];
    stage = key;
    const result = await run(context, work);
    state.entries[key] = result.id;
    newEntries++;
    checkpoint();
    return result.id;
  }
  const day = (offset: number) =>
    new Date(Date.parse(state.createdAt.slice(0, 10) + "T12:00Z") + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const instant = (offset: number, clock = "10:00") =>
    theaterInstant(day(offset) + "T" + clock, settings.timezone)!;
  const productionId = await step("production", admin, () =>
    saveRecord(admin, "productions", {
      title: "DEMO · Fachabläufe 2026/27",
      status: "active",
      memberIds: [
        actor.id,
        ...Object.values(demo.accounts)
          .filter((a) => a.scope !== "platform" && a.scope !== "production")
          .map((a) => a.userId!)
          .filter(Boolean),
      ],
      contacts: [],
      description: "Ausschließlich synthetische Beispiele für den erweiterten Fachbetrieb.",
    }),
  );
  const add = async (
    moduleId: string,
    type: string,
    key: string,
    data: RecordData,
    status = "draft",
    author?: Context,
  ) => {
    const feature = moduleRegistry
      .find((m) => m.id === moduleId)!
      .features.find((f) => f.id === type)!;
    const context =
      author ||
      (can(contexts[moduleId], feature.permission, productionId, departmentFor(moduleId))
        ? contexts[moduleId]
        : await contextFor(actor.id, moduleId));
    return step(key, context, () =>
      saveTradeItem(context, {
        moduleId,
        type,
        title: "DEMO · " + feature.label,
        productionId,
        status,
        data,
      }),
    );
  };
  const record = async (kind: Parameters<typeof saveRecord>[1], key: string, data: RecordData) =>
    step(key, admin, () => saveRecord(admin, kind, data));
  const actorId = await record("actors", "actor:main", { name: "DEMO · Alex Bühnenperson" }),
    alternateId = await record("actors", "actor:alternative", { name: "DEMO · Sam Bühnenperson" });
  const characterId = await record("characters", "character", {
    name: "DEMO · Die Reisende",
    productionId,
  });
  await record("casting", "casting", { actorId, characterId, productionId });
  const roomId = await step("resource:room", admin, () =>
    saveResource(admin, {
      name: "DEMO · Fachprobebühne",
      type: "rehearsal-room",
      capacity: 1,
      departmentId: null,
    }),
  );
  const studioId = await step("resource:studio", admin, () =>
    saveResource(admin, {
      name: "DEMO · Tanzstudio Fachausbau",
      type: "studio",
      capacity: 1,
      departmentId: null,
    }),
  );
  const facilityId = await step("resource:facility", admin, () =>
    saveResource(admin, {
      name: "DEMO · Lüftungsanlage Fachausbau",
      type: "equipment",
      departmentId: null,
      capacity: 1,
    }),
  );
  const show = await step(
    "performance:future",
    admin,
    () =>
      scheduleAction(admin, {
        action: "performance",
        data: {
          productionId,
          curtainAt: instant(60, "19:00"),
          durationMinutes: 120,
          participantIds: [],
          resourceId: roomId,
        },
      }) as Promise<{ id: string }>,
  );
  const pastShow = await step(
    "performance:past",
    admin,
    () =>
      scheduleAction(admin, {
        action: "performance",
        data: {
          productionId,
          curtainAt: instant(-10, "19:00"),
          durationMinutes: 120,
          participantIds: [],
          resourceId: roomId,
        },
      }) as Promise<{ id: string }>,
  );
  const assets: Record<string, string> = {};
  for (const module of moduleRegistry) {
    const resourceId =
      module.id === "dance" ? studioId : module.id === "facilities" ? facilityId : undefined;
    assets[module.id] = await add(module.id, "asset", "asset:" + module.id, {
      inventoryNumber: "DEMO-FACH-" + module.id.toUpperCase(),
      quantity: 10,
      condition: "available",
      kind: "Synthetisches Teil / Gerät",
      ...(resourceId ? { resourceId } : {}),
      ...(module.id === "dance" ? { roomFeatures: "Schwingboden\nTanzspiegel" } : {}),
    });
  }
  const slot = (moduleId: string, offset: number, resourceId = roomId) => ({
    start: instant(offset),
    end: instant(offset, "11:30"),
    participantIds: [contexts[moduleId].user.id],
    resourceId,
  });
  await add("disposition", "scenario", "disposition:scenario", {
    revision: "V1 · Probe vor Bauprobe",
    notes: "DEMO · Im Kalender lässt sich die Variante per Sammeländerung prüfen.",
  });
  await add("disposition", "milestone", "disposition:milestone", {
    deadline: day(30),
    responsibleId: contexts.design.user.id,
    notes: "DEMO · Modell, Zeichnung und Wechselkonzept zur Abstimmung bereitstellen.",
  });
  await add("disposition", "tour", "disposition:tour", {
    venue: "DEMO · Gastspielhaus Beispielstadt",
    ...slot("disposition", 50),
    contact: "Fiktive Gastspielkoordination",
    requirements: "Technischer Rider als private Anlage; Reiseplan abstimmen.",
  });
  const scene = await add("direction", "scene", "direction:scene", {
    revision: "V1",
    sequence: 1,
    blocking: "DEMO · Eintritt links; Kragenwechsel nach Signal 2.",
  });
  const report = await add("direction", "rehearsal-report", "direction:report", {
    sceneId: scene,
    date: day(1),
    notes: "DEMO · Wechsel bei gemeinsamer Probe prüfen.",
    changes: "Kragen und Perückenhalt koordinieren.",
    responsibleId: contexts.makeup.user.id,
    deadline: day(7),
  });
  await add("dramaturgy", "text-edition", "dramaturgy:text", {
    revision: "Lektorat V1",
    text: "DEMO · Synthetische Programmheftnotiz.",
    editorId: contexts.dramaturgy.user.id,
    rightsUntil: day(180),
  });
  await add("ensemble", "daily-sheet", "ensemble:daily", {
    date: day(2),
    actorId,
    characterId,
    participantIds: [contexts.ensemble.user.id],
    notes: "DEMO · Kostüm und Maske zur Bauprobe mitbringen.",
  });
  await add("ensemble", "availability", "ensemble:availability", {
    start: day(12),
    end: day(12),
    availability: "limited",
    allowedFrom: "12:00",
    allowedTo: "20:00",
  });
  await add("stage", "decoration", "stage:drawing", {
    assetId: assets.stage,
    drawingRevision: "Z-01 / V1",
    instructions: "DEMO · Aufbau gemäß Anlage prüfen.",
  });
  await add("lighting", "device-profile", "lighting:gdtf", {
    manufacturer: "DEMO",
    model: "Fiktiver Profilscheinwerfer",
    mode: "8 Kanal",
    footprint: 8,
    notes: "Synthetisches Profil; echter GDTF-Import unter Schnittstellen.",
  });
  const patch = await add("lighting", "patch", "lighting:patch", {
    fixture: "DEMO Profil 01",
    assetId: assets.lighting,
    dmxUniverse: 1,
    dmxAddress: 101,
    footprint: 8,
    gdtfMode: "8 Kanal",
    position: "Portal links",
  });
  await add("lighting", "focus-check", "lighting:focus", {
    patchId: patch,
    position: "Vorderbühne",
    checked: false,
    checkedBy: contexts.lighting.user.id,
    notes: "DEMO · Fokus bei der Technikprobe prüfen.",
  });
  const lightCue = await add("lighting", "cue", "lighting:cue", {
    sequence: 1,
    trigger: "Die Reisende tritt ein",
    fadeSeconds: 3,
    look: "Warmweiß auf Portal",
  });
  const channel = await add("sound", "channel", "sound:channel", {
    actorId,
    characterId,
    assetId: assets.sound,
    channelNumber: 1,
    frequencyMHz: 550.1,
    routing: "DEMO · Funk → Pult 1 → Saal",
  });
  await add("sound", "routing-edition", "sound:routing", {
    channelIds: [channel],
    revision: "Routing V1",
    notes: "DEMO · Ersatzweg bei Ausfall prüfen.",
  });
  const media = await add("video", "media", "video:media", {
    revision: "V1",
    source: "DEMO · Original als private Anlage",
    rightsOwner: "Synthetische Demo",
    rightsUntil: day(180),
    codec: "H.264",
    resolution: "1920×1080",
    frameRate: 25,
    durationSeconds: 30,
  });
  await add("video", "delivery", "video:delivery", {
    mediaId: media,
    targetSystem: "DEMO · Projektionsrechner",
    codec: "H.264",
    resolution: "1920×1080",
    frameRate: 25,
    durationSeconds: 30,
  });
  const inspCue = await add("stage-management", "cue", "stage-management:cue", {
    sequence: 1,
    technicalCueId: lightCue,
    trigger: "Eintritt Reisende",
  });
  await add("stage-management", "cue-edition", "stage-management:edition", {
    cueIds: [inspCue, lightCue],
    revision: "Vorstellungsfassung V1",
    notes: "DEMO · Gemeinsamer Stand zur Freigabe.",
  });
  const order = await add("workshops", "order", "workshops:order", {
    workshop: "Tischlerei",
    drawingRevision: "Z-01",
    deadline: day(30),
    materials: "DEMO · Portalrahmen",
  });
  await add("workshops", "bom-line", "workshops:bom", {
    orderId: order,
    assetId: assets.workshops,
    quantity: 2,
    supplier: "DEMO · Werkstattlager",
  });
  await add("workshops", "manufacturing-step", "workshops:step", {
    orderId: order,
    responsibleId: contexts.workshops.user.id,
    hours: 1.5,
    sequence: 1,
    ...slot("workshops", 22),
    instructions: "DEMO · Zuschnitt und Maßkontrolle",
  });
  const costume = await add("costume", "costume", "costume:assignment", {
    actorId,
    characterId,
    assetId: assets.costume,
    changes: "DEMO · Bewegungsfreiheit beim Wechsel prüfen.",
  });
  await add("costume", "fitting", "costume:fitting", {
    actorId,
    characterId,
    costumeId: costume,
    ...slot("costume", 23),
  });
  await add("costume", "care-cycle", "costume:care", {
    assetId: assets.costume,
    care: "clean",
    nextService: day(5),
    instructions: "DEMO · Reinigung dokumentieren, anschließend abschließen.",
  });
  await add("makeup", "preparation", "makeup:preparation", {
    actorId,
    characterId,
    assetId: assets.makeup,
    wig: "DEMO · Reisende V1",
    notes: "Befestigung und Kragen gemeinsam prüfen.",
  });
  await add("makeup", "wig-care", "makeup:care", {
    actorId,
    assetId: assets.makeup,
    care: "clean",
    nextService: day(5),
    notes: "DEMO · Pflegezyklus vor erneuter Verwendung abschließen.",
  });
  await add("props", "stock-movement", "props:loan", {
    assetId: assets.props,
    movement: "loan",
    quantity: 2,
    reason: "DEMO · Ausleihe für die Probe",
  });
  await add("props", "stock-movement", "props:return", {
    assetId: assets.props,
    movement: "return",
    quantity: 1,
    reason: "DEMO · Teilrückgabe",
  });
  await add("props", "loan", "props:linked-loan", {
    assetId: assets.props,
    lender: "DEMO · Theaterfundus",
    quantity: 1,
    deadline: day(20),
  });
  const prop = await add("props", "scene-prop", "props:prop", {
    item: "DEMO · Reisekoffer",
    assetId: assets.props,
    scene: "Eintritt",
    preset: "Linke Gasse",
    return: "Fundusregal A",
  });
  await add("props", "show-check", "props:check", {
    performanceId: show,
    propId: prop,
    presetChecked: false,
    returnChecked: false,
    responsibleId: contexts.props.user.id,
  });
  const score = await add("music", "score-edition", "music:score", {
    revision: "Partitur V1",
    participantIds: [contexts.music.user.id],
    rightsUntil: day(180),
    notes: "DEMO · Geprüfte Verteilung per Abstimmung.",
  });
  await add("music", "service", "music:service", {
    type: "rehearsal",
    scoreId: score,
    ...slot("music", 24),
  });
  await add("dance", "training", "dance:training", {
    style: "DEMO · Szenisches Bewegungstraining",
    requiredRoomFeature: "Schwingboden",
    ...slot("dance", 25, studioId),
  });
  await add("dance", "variant", "dance:variant", {
    actorId,
    alternativeActorId: alternateId,
    sceneId: scene,
    revision: "Variante B",
    sequence: "DEMO · Vereinfachter Bewegungsweg.",
  });
  await add("front-of-house", "briefing", "front-of-house:briefing", {
    performanceId: show,
    participantIds: [contexts["front-of-house"].user.id],
    entry: "30 Minuten vor Beginn",
    groups: "DEMO · Fiktive Besuchergruppe, 18 Personen",
    accessibility: "Zwei barrierefreie Zugänge vor Einlass prüfen.",
  });
  await add(
    "front-of-house",
    "audience-report",
    "front-of-house:report",
    {
      performanceId: pastShow,
      visitors: 180,
      offeredSeats: 220,
      paidTickets: 160,
      complimentaryTickets: 20,
      amountCents: 320000,
      notes: "DEMO · Synthetischer Kassenbericht",
    },
    "done",
    await contextFor(actor.id, "front-of-house"),
  );
  await add("marketing", "asset-edition", "marketing:asset", {
    revision: "Redaktion V1",
    rightsOwner: "Synthetische Demo",
    rightsUntil: day(180),
    publishAt: day(20),
  });
  const workshop = await add("education", "workshop", "education:workshop", {
    targetGroup: "DEMO · Schulgruppe",
    capacity: 24,
    ...slot("education", 26),
    materials: "DEMO · Szenenarbeit ohne persönliche Gesundheitsdaten.",
  });
  const group = await add("education", "group-booking", "education:booking", {
    workshopId: workshop,
    groupName: "DEMO · Beispielklasse",
    participants: 18,
    requirements: "Fiktiver Gruppenbedarf, keine realen Kontaktdaten.",
  });
  await add("education", "participant", "education:participant", {
    bookingId: group,
    name: "DEMO · Teilnehmer A",
    consentGiven: true,
    consentPurpose: "Synthetische Demonstration",
    consentUntil: day(30),
  });
  const finance = await contextFor(actor.id, "administration");
  const budget = await add(
    "administration",
    "budget",
    "administration:budget",
    { amountCents: 250000, costCentre: "DEMO-FACH" },
    "published",
    finance,
  );
  const purchase = await add(
    "administration",
    "purchase",
    "administration:purchase",
    {
      budgetId: budget,
      item: "DEMO · Portalmaterial",
      supplier: "Fiktiver Materiallieferant",
      amountCents: 85000,
    },
    "review",
    contexts.administration,
  );
  if (!state.entries["administration:approval"]) {
    await run(finance, async () => {
      const [entry] = await db.select().from(t.tradeItems).where(eq(t.tradeItems.id, purchase));
      if (entry.status === "review")
        await approvePurchase(finance, purchase, entry.version, "approved");
    });
    state.entries["administration:approval"] = purchase;
    checkpoint();
  }
  await add(
    "administration",
    "procurement",
    "administration:procurement",
    {
      purchaseId: purchase,
      phase: "ordered",
      supplier: "Fiktiver Materiallieferant",
      orderNumber: "DEMO-2026-01",
      amountCents: 85000,
      costCentre: "DEMO-FACH",
      date: day(0),
    },
    "draft",
    finance,
  );
  await add(
    "administration",
    "contract",
    "administration:contract",
    {
      partner: "DEMO · Gastspielhaus",
      revision: "Entwurf V1",
      start: day(50),
      end: day(51),
      deadline: day(20),
      amountCents: 150000,
      notes: "Synthetischer Vertragsstand; keine echte Verpflichtung.",
    },
    "draft",
    finance,
  );
  await add("facilities", "maintenance-series", "facilities:series", {
    assetId: assets.facilities,
    nextService: day(15),
    intervalDays: 90,
    responsibleId: contexts.facilities.user.id,
    checklist: "DEMO · Filter, Funktion und Sichtprüfung dokumentieren.",
  });
  const design = await add("design", "design", "design:concept", {
    revision: "Modell V1",
    concept: "DEMO · Portalrahmen, Reisekoffer und heller Perückenstand.",
    deadline: day(7),
  });
  await add("design", "model-rehearsal", "design:model", {
    designId: design,
    ...slot("design", 27),
    findings: "DEMO · Kragen, Perücke und Portal gemeinsam betrachten.",
  });
  if (!state.entries["design:attachment"]) {
    stage = "design:attachment";
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica),
      page = pdf.addPage([595, 842]);
    page.drawText("DEMO - Ausstattung und Maske - Modell V1", { x: 48, y: 740, font, size: 16 });
    page.drawText("Synthetische Vorlage: Portal, Kragen, Perueckenhalt.", {
      x: 48,
      y: 700,
      font,
      size: 12,
    });
    const bytes = await pdf.save();
    const file = await run(contexts.design, async () => {
      const parent = await ensureTradeFileParent(contexts.design, design);
      return uploadFile(
        contexts.design,
        new File([new Uint8Array(bytes)], "DEMO Modell und Maske V1.pdf", {
          type: "application/pdf",
        }),
        "handovers",
        parent,
      );
    });
    state.entries["design:attachment"] = file.id;
    checkpoint();
  }
  const approval = await step("design:approval-request", contexts.design, () =>
    createCollaboration(contexts.design, {
      id: migratedId(organizationId, "expansion:design-approval"),
      title: "DEMO · Modellstand an Maske freigeben",
      kind: "approval",
      recipientDepartmentId: departmentFor("makeup"),
      productionId,
      sourceItemId: design,
      brief:
        "DEMO · Bitte diesen Modellstand mit Anlage hinsichtlich Kragen, Silhouette und Perückenhalt prüfen.",
      dueDate: day(7),
    }),
  );
  if (!state.entries["design:approved"]) {
    await run(contexts.makeup, async () => {
      const detail = await collaborationDetail(contexts.makeup, approval);
      if (detail.entry.status === "review")
        await replyCollaboration(contexts.makeup, {
          id: approval,
          expectedVersion: detail.entry.version,
          action: "approve",
          message:
            "DEMO · Der unveränderte Modellstand und die Anlage wurden für diesen synthetischen Beispielablauf geprüft.",
        });
    });
    state.entries["design:approved"] = approval;
    checkpoint();
  }
  const { followups } = await import("../src/modules/theater/operations");
  await step("direction:followup", contexts.direction, async () => {
    const [item] = await db.select().from(t.tradeItems).where(eq(t.tradeItems.id, report));
    await followups(contexts.direction, {
      operationId: migratedId(organizationId, "expansion:followup:" + report),
      id: report,
      expectedVersion: item.version,
      targets: [departmentFor("costume"), departmentFor("makeup")],
      brief: "DEMO · Wechsel aus dem Probenbericht gemeinsam prüfen.",
      dueDate: day(7),
    });
    return { id: report };
  });
  for (const module of moduleRegistry.filter((module) =>
    module.features.some((feature) => feature.id === "readiness"),
  ))
    await add(module.id, "readiness", "readiness:" + module.id, {
      ready: false,
      notes: "DEMO · Fachstand und offene Aufgaben vor Bestätigung prüfen.",
    });
  stage = "events";
  for (let page = 0; page < 30; page++) {
    const result = await run(admin, () => processEvents());
    if (!result.processed) break;
    if (page === 29) throw new Error("Synthetic event delivery did not settle");
  }
  state.complete = true;
  checkpoint();
  console.log(
    JSON.stringify({
      environment,
      organizationId,
      complete: true,
      newAccounts,
      newEntries,
      entries: Object.keys(state.entries).length,
      trades: moduleRegistry.length,
      passwordsOmitted: true,
      sourceUntouched: true,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      stage,
      failed: true,
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number }).status,
    }),
  );
  process.exitCode = 1;
} finally {
  await Promise.all([authSql.end(), controlSql.end(), appSql.end(), workerSql.end()]);
}
