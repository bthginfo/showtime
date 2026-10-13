/** Deliberately provision synthetic theater accounts/data; no owner connection or source access. */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import type { Context } from "../src/platform/context";
import type { TheaterRole, Grant } from "../src/platform/access";
import type { RecordData, RecordKind } from "../src/shared/contracts";

const [environment, organizationId, actorId, confirmation] = process.argv.slice(2);
if (
  !["development", "preview", "production"].includes(environment) ||
  !organizationId ||
  !actorId ||
  confirmation !== "--apply"
)
  throw new Error(
    "Usage: seed-theater-demo.ts <environment> <tenant-id> <authorized-actor-id> --apply",
  );
const runtime = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
Object.assign(process.env, runtime);
delete process.env.VERCEL;
const { auth } = await import("../src/platform/auth");
const { authDb, controlDb, authSql, controlSql, appSql, workerSql } =
  await import("../src/platform/db/connections");
const tables = await import("../src/platform/db/schema");
const { db } = await import("../src/platform/db");
const { tenantTransaction } = await import("../src/platform/db/tenant");
const { requestScope } = await import("../src/platform/request");
const { runWorkerScope } = await import("../src/platform/events/worker");
const { emit, processEvents, auditChange } = await import("../src/platform/events");
const { effectiveGrants, availableScopes } = await import("../src/platform/context");
const { rolePermissions } = await import("../src/platform/access");
const { migratedId } = await import("../src/platform/migration/digitalmask");
const { moduleRegistry } = await import("../src/modules/theater/registry");
const { roleLabels } = await import("../src/modules/theater/types");
const { saveRecord } = await import("../src/modules/records/service");
const { saveTradeItem, saveResource, scheduleAction } =
  await import("../src/modules/theater/service");
const { and, eq, sql, ne } = await import("drizzle-orm");
type DemoAccount = {
  key: string;
  username: string;
  password: string;
  name: string;
  userId?: string;
  roles: TheaterRole[];
  departments: string[];
  scope: Grant["scope"] | "platform";
};
type State = {
  organizationId: string;
  accounts: Record<string, DemoAccount>;
  entries: Record<string, string>;
  createdAt: string;
  complete?: boolean;
};
const statePath = `.local/theater-demo-${environment}-${organizationId}.json`;
const state: State = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { organizationId, accounts: {}, entries: {}, createdAt: new Date().toISOString() };
const saveState = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const request = new Request(runtime.APP_URL + "/api/theater", {
  method: "POST",
  headers: { origin: runtime.APP_URL },
});
let stage = "authorize";
let activeStep = "";
let newEntries = 0;

// Defer delivery until the phase finishes, while each entry and its event commit atomically.
const run = <T>(context: Context, work: () => Promise<T>) =>
  requestScope.run({ request, after: [] }, () => tenantTransaction(context, work, true));
async function drain(context: Context) {
  for (let page = 0; page < 80; page++) {
    const result = await runWorkerScope(request, context, () => processEvents());
    if (!result.processed) return;
  }
  throw new Error("Demo event delivery did not settle");
}
try {
  const [platform] = await controlDb
    .select()
    .from(tables.platformAdmins)
    .where(eq(tables.platformAdmins.userId, actorId));
  const [organization] = await controlDb
    .select()
    .from(tables.organizations)
    .where(eq(tables.organizations.id, organizationId));
  const [settings] = await controlDb
    .select()
    .from(tables.tenantSettings)
    .where(eq(tables.tenantSettings.organizationId, organizationId));
  if (!platform || !organization || settings?.status !== "active")
    throw new Error("Active tenant and authorized platform actor required");
  if (state.organizationId !== organizationId) throw new Error("Demo state tenant mismatch");
  const departments = await controlDb
    .select()
    .from(tables.departments)
    .where(eq(tables.departments.organizationId, organizationId));
  const activations = await controlDb
    .select()
    .from(tables.moduleActivations)
    .where(eq(tables.moduleActivations.organizationId, organizationId));
  const departmentFor = (moduleId: string) => {
    const id = String(
      activations.find((a) => a.moduleId === moduleId && a.enabled)?.config.departmentId || "",
    );
    if (!departments.some((d) => d.id === id))
      throw new Error("Enabled module department required");
    return id;
  };
  const namespace =
    settings.slug === "stadttheater-ingolstadt"
      ? "in.demo."
      : `demo.${organizationId.slice(0, 6)}.`;
  async function contextFor(userId: string, departmentId: string): Promise<Context> {
    const scopes = await availableScopes(userId);
    if (
      !scopes.some(
        (s) =>
          s.organizationId === organizationId &&
          s.departmentId === departmentId &&
          s.status === "active",
      )
    )
      throw new Error("Explicit active department membership required");
    const grants = await effectiveGrants(userId, organizationId, scopes);
    const permissions = [
      ...new Set(
        grants
          .filter(
            (g) => g.scope === "tenant" || (g.scope === "department" && g.scopeId === departmentId),
          )
          .flatMap((g) => rolePermissions[g.role]),
      ),
    ];
    const [person] = await authDb.select().from(tables.user).where(eq(tables.user.id, userId));
    return {
      organizationId,
      organizationName: organization.name,
      departmentId,
      departmentName: departments.find((d) => d.id === departmentId)!.name,
      grants,
      user: {
        id: userId,
        username: person.username || "",
        name: person.name,
        role: permissions.includes("task.manage") ? "admin" : "user",
        status: "active",
        departmentId,
        permissions,
        grants,
      },
    };
  }
  const admin = await contextFor(actorId, departmentFor("makeup"));
  if (
    !admin.grants.some((g) => g.scope === "tenant" && g.role === "production_lead") ||
    !admin.grants.some((g) => g.scope === "tenant" && g.role === "intendance")
  )
    throw new Error("Explicit tenant data provisioning grants required");

  stage = "demo-accounts";
  const roleDepartments: Record<TheaterRole, string> = {
    employee: "makeup",
    team_lead: "makeup",
    production_lead: "direction",
    disposition: "disposition",
    technical_lead: "stage",
    intendance: "administration",
    theater_admin: "administration",
    personnel: "administration",
    privacy_officer: "administration",
    costume_specialist: "costume",
    guest: "ensemble",
  };
  const theaterWide = new Set<TheaterRole>([
    "production_lead",
    "disposition",
    "technical_lead",
    "intendance",
    "theater_admin",
    "personnel",
    "privacy_officer",
  ]);
  const specs: Omit<DemoAccount, "password" | "userId">[] = (
    Object.keys(roleDepartments) as TheaterRole[]
  ).map((role) => ({
    key: role,
    username: namespace + role,
    name: "DEMO · " + roleLabels[role],
    roles: [role],
    departments: theaterWide.has(role)
      ? departments.map((d) => d.id)
      : [departmentFor(roleDepartments[role])],
    scope: role === "guest" ? "production" : theaterWide.has(role) ? "tenant" : "department",
  }));
  for (const module of moduleRegistry) {
    const roles: TheaterRole[] = ["team_lead"];
    if (module.id === "disposition") roles.push("disposition");
    if (["ensemble", "music", "dance", "administration"].includes(module.id))
      roles.push("production_lead");
    if (module.id === "costume") roles.push("costume_specialist");
    specs.push({
      key: "trade:" + module.id,
      username: namespace + "g." + module.id,
      name: "DEMO · Leitung " + module.department,
      roles,
      departments: [departmentFor(module.id)],
      scope: "department",
    });
  }
  specs.push({
    key: "superadmin",
    username: namespace + "superadmin",
    name: "DEMO · Plattformadministration",
    roles: [],
    departments: [],
    scope: "platform",
  });
  for (const spec of specs) {
    activeStep = spec.key;
    let credential = state.accounts[spec.key];
    if (!credential) {
      credential = { ...spec, password: randomBytes(24).toString("base64url") };
      state.accounts[spec.key] = credential;
      saveState();
    }
    const [existing] = await authDb
      .select()
      .from(tables.user)
      .where(eq(tables.user.username, credential.username));
    let person = existing;
    if (person && credential.userId && credential.userId !== person.id)
      throw new Error("Existing demo identity mismatch");
    if (person && !credential.userId) {
      // A saved password proves an interrupted signup; verify it without resetting any existing account.
      const session = await auth.api.signInUsername({
        body: { username: credential.username, password: credential.password },
      });
      if (session.user.id !== person.id)
        throw new Error("Existing identity is not this demo account");
      await authDb.delete(tables.session).where(eq(tables.session.token, session.token));
    }
    if (!person) {
      const result = await auth.api.signUpEmail({
        body: {
          username: credential.username,
          email: credential.username + "@demo.showtime.invalid",
          name: credential.name,
          password: credential.password,
        },
      });
      person = result.user as typeof existing;
      credential.userId = person.id;
      saveState();
      if (result.token)
        await authDb.delete(tables.session).where(eq(tables.session.token, result.token));
    }
    credential.userId = person.id;
    saveState();
    if (credential.scope === "platform") {
      await controlDb
        .insert(tables.platformAdmins)
        .values({ userId: person.id })
        .onConflictDoNothing();
      continue;
    }
    const scope = credential.scope;
    await controlDb.transaction(async (tx) => {
      await tx
        .insert(tables.tenantMembers)
        .values({ organizationId, userId: person.id, status: "active" })
        .onConflictDoNothing();
      for (const departmentId of credential.departments)
        await tx
          .insert(tables.memberships)
          .values({
            id: migratedId(organizationId, `demo:member:${person.id}:${departmentId}`),
            organizationId,
            userId: person.id,
            departmentId,
            role: "user",
            status: "active",
          })
          .onConflictDoNothing();
      if (scope !== "production")
        for (const role of credential.roles)
          await tx
            .insert(tables.permissionGrants)
            .values({
              id: migratedId(organizationId, `demo:grant:${person.id}:${role}`),
              organizationId,
              userId: person.id,
              role,
              scope,
              scopeId: scope === "department" ? credential.departments[0] : null,
            })
            .onConflictDoNothing();
    });
  }
  console.log(JSON.stringify({ stage, count: specs.length, passwordsOmitted: true }));
  async function scheduled(context: Context, input: Parameters<typeof scheduleAction>[1]) {
    const result = await scheduleAction(context, input);
    if (!("id" in result)) throw new Error("Expected a newly created planning entity");
    return result;
  }

  async function step(
    key: string,
    context: Context,
    table:
      | typeof tables.records
      | typeof tables.tradeItems
      | typeof tables.venueResources
      | typeof tables.theaterSeasons
      | typeof tables.theaterWorks
      | typeof tables.theaterProductions
      | typeof tables.performances,
    work: () => Promise<{ id: string }>,
    match?: () => Promise<{ id: string } | undefined>,
  ) {
    activeStep = key;
    const id = await run(context, async () => {
      if (state.entries[key]) {
        const [saved] = await db
          .select({ id: table.id })
          .from(table)
          .where(eq(table.id, state.entries[key]))
          .limit(1);
        if (!saved) throw new Error("Saved demo entry was removed; refusing silent recreation");
        return saved.id;
      }
      const previous = await match?.();
      return (previous || (await work())).id;
    });
    if (!state.entries[key]) newEntries++;
    state.entries[key] = id;
    saveState();
    return id;
  }
  async function record(key: string, context: Context, kind: RecordKind, data: RecordData) {
    return step(
      key,
      context,
      tables.records,
      () => saveRecord(context, kind, data),
      async () =>
        (
          await db
            .select({ id: tables.records.id })
            .from(tables.records)
            .where(
              and(
                eq(tables.records.kind, kind),
                eq(tables.records.departmentId, context.departmentId),
                data.title
                  ? sql`${tables.records.data}->>'title'=${String(data.title)}`
                  : data.name
                    ? sql`${tables.records.data}->>'name'=${String(data.name)}`
                    : eq(tables.records.id, "no-demo-name-match"),
              ),
            )
            .limit(1)
        )[0],
    );
  }
  const demoUsers = Object.values(state.accounts)
    .filter((a) => a.scope !== "platform")
    .map((a) => a.userId!);
  const day = (offset = 0) =>
    new Date(Date.parse(state.createdAt.slice(0, 10) + "T00:00:00Z") + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  stage = "demo-productions";
  const titles = ["DEMO · Der Sturm", "DEMO · Eine Sommernacht", "DEMO · Hinter den Kulissen"];
  const productions: string[] = [];
  for (let index = 0; index < titles.length; index++)
    productions.push(
      await record("production:" + index, admin, "productions", {
        title: titles[index],
        description:
          "Fiktive Beispielproduktion zum Erkunden der Gewerke. Alle DEMO-Einträge und Personen sind synthetisch.",
        season: "2026/2027",
        status: "preparation",
        premiere: day(40 + index * 7),
        durationMinutes: 120,
        memberIds: [
          actorId,
          ...demoUsers.filter((id) => id !== state.accounts.guest.userId || index === 0),
        ],
        color: ["#357b68", "#b07448", "#6866a4"][index],
      }),
    );
  const guest = state.accounts.guest;
  await controlDb
    .insert(tables.permissionGrants)
    .values({
      id: migratedId(organizationId, "demo:guest:" + guest.userId),
      organizationId,
      userId: guest.userId!,
      role: "guest",
      scope: "production",
      scopeId: productions[0],
      expiresAt: new Date(Date.parse(state.createdAt) + 30 * 86400000),
    })
    .onConflictDoNothing();
  // Imported legacy production events are archival. Create fresh idempotent projection pointers only.
  await run(admin, async () => {
    const imported = await db
      .select()
      .from(tables.records)
      .where(
        and(
          eq(tables.records.kind, "productions"),
          ne(tables.records.id, productions[0]),
          ne(tables.records.id, productions[1]),
          ne(tables.records.id, productions[2]),
        ),
      );
    for (const production of imported) {
      const pointerId = migratedId(organizationId, "digitalmask-projection:" + production.id);
      await db
        .insert(tables.outbox)
        .values({
          id: pointerId,
          organizationId,
          departmentId: production.departmentId,
          type: "ProductionCreatedV1",
          payload: {
            recordId: production.id,
            actorId,
            organizationId,
            schemaVersion: 1,
            aggregateVersion: production.version,
          },
        })
        .onConflictDoNothing();
    }
  });
  await drain(admin);
  const seasonId = await step("season", admin, tables.theaterSeasons, () =>
    scheduled(admin, {
      action: "season",
      data: { label: "DEMO · Spielzeit 2026/2027", start: "2026-08-01", end: "2027-07-31" },
    }),
  );
  for (let index = 0; index < productions.length; index++) {
    const workId = await step("work:" + index, admin, tables.theaterWorks, () =>
      scheduled(admin, {
        action: "work",
        data: { title: titles[index], author: "DEMO · Fiktives Produktionsteam" },
      }),
    );
    await step("metadata:" + index, admin, tables.theaterProductions, () =>
      scheduled(admin, {
        action: "production-metadata",
        data: {
          recordId: productions[index],
          workId,
          seasonId,
          stage: ["rehearsal", "workshop", "development"][index],
        },
      }),
    );
  }
  const resources: string[] = [];
  for (const [index, spec] of [
    { name: "DEMO · Große Bühne", type: "stage", capacity: 600 },
    { name: "DEMO · Probensaal A", type: "rehearsal-room", capacity: 30 },
    { name: "DEMO · Tanzstudio", type: "studio", capacity: 20 },
  ].entries())
    resources.push(
      await step("resource:" + index, admin, tables.venueResources, () =>
        saveResource(admin, { ...spec, departmentId: null, setupMinutes: 15, teardownMinutes: 15 }),
      ),
    );
  const actor = await record("actor", admin, "actors", {
    name: "DEMO · Alex Bühnenlicht",
    biography: "Fiktives Ensemblemitglied für die Demo-Produktion.",
    ensembleStatus: "DEMO",
    notes: "Synthetisches Profil. Keine reale Person.",
  });
  const character = await record("character", admin, "characters", {
    name: "DEMO · Prospero",
    productionId: productions[0],
    description: "Fiktive Besetzungsfigur im Beispielprojekt.",
  });
  await record("casting", admin, "casting", {
    productionId: productions[0],
    characterId: character,
    actorId: actor,
    actorName: "DEMO · Alex Bühnenlicht",
    characterName: "DEMO · Prospero",
  });
  const sprint = await record("sprint", admin, "sprints", {
    title: "DEMO · Probenwoche 1",
    productionId: productions[0],
    goal: "Gewerke abstimmen und die erste technische Probe vorbereiten.",
    start: day(1),
    end: day(7),
    status: "active",
  });
  const task = await record("task", admin, "tasks", {
    title: "DEMO · Perücke für Prospero vorbereiten",
    description: "Perücke aufarbeiten und zur Anprobe bereitstellen.",
    productionId: productions[0],
    sprintId: sprint,
    assigneeIds: [state.accounts.employee.userId],
    priority: "high",
    status: "doing",
    due: day(3),
    checklist: [
      { text: "Fundusstück prüfen", done: true },
      { text: "Anprobe abstimmen", done: false },
    ],
  });
  await record("handover", admin, "handovers", {
    title: "DEMO · Übergabe Frühdienst an Spätdienst",
    productionId: productions[0],
    date: day(),
    notes: "Perücke ist vorbereitet. Für die Anprobe bitte Prospero einplanen.",
    status: "open",
    checklist: [{ text: "Fundus und Arbeitsplatz vorbereitet", done: true }],
  });
  await record("material", admin, "materials", {
    name: "DEMO · Perücke Prospero",
    category: "other",
    location: "DEMO · Fundus Regal A",
    quantity: 2,
    minQuantity: 1,
    notes: "Fiktiver Fundusbestand zur Erprobung der Bestandsverwaltung.",
  });
  console.log(
    JSON.stringify({ stage, productions: productions.length, resources: resources.length }),
  );

  stage = "demo-trades";
  const featureNotes: Record<string, string> = {
    disposition: "Szenen 1–3 proben; anschließend Absprachen mit Licht und Ton.",
    direction:
      "Auftritte und Wege der Sturm-Szene präzisiert. Technische Probe mit Inspizienz abstimmen.",
    dramaturgy:
      "Recherche zu Insel, Macht und Vergebung. Programmheft-Beitrag in redaktioneller Prüfung.",
    ensemble: "DEMO-Besetzung und Alternative stehen für die Probenwoche bereit.",
    "stage-management": "Cue 10: Nach dem letzten Satz der Sturm-Szene Licht und Ton abrufen.",
    stage: "Inselpodest nach Szene 2 drehen; Fahrwege freihalten und Bremsen prüfen.",
    lighting: "Gegenlicht blau, warmer Fokus auf Prospero; Überblendung über drei Sekunden.",
    sound: "Sturm-Zuspielung auf Cue 10; Sprachverständlichkeit im Saal prüfen.",
    video: "Wellenprojektion synchron zu Cue 10; Fassung v2 verwenden.",
    workshops: "Inselpodest herstellen und zur technischen Probe an Bühnentechnik übergeben.",
    costume: "Mantel Prospero anpassen; Schnellwechsel nach Szene 3 proben.",
    makeup: "Perücke Prospero auffrischen und Bart vorbereiten. Anprobe mit Kostüm abstimmen.",
    props: "Zauberstab vor Szene 1 links bereitstellen und nach der Vorstellung zurücknehmen.",
    music: "Streichergruppe zur Szenenprobe einteilen; Partitur Fassung v2 bereitstellen.",
    dance: "Bewegungsablauf der Sturm-Szene mit der alternativen Besetzung proben.",
    "front-of-house":
      "Einlass 30 Minuten vor Beginn; Wege, Garderobe und barrierefreie Plätze prüfen.",
    marketing:
      "Synthetischer Premierenbeitrag zur Freigabe; Nutzungsrechte der Demo-Medien geprüft.",
    education:
      "Fiktiver Schulworkshop: Sturm-Szene als Einstieg, anschließend Gespräch über Rollenbilder.",
    administration:
      "Synthetisches Produktionsbudget; Antrag und Freigabe durch unterschiedliche Personen.",
    facilities: "Projektionsanlage und Zugangskarten vor der technischen Probe prüfen.",
  };
  let tradeCount = 0;
  let budgetId = "";
  for (const [moduleIndex, module] of moduleRegistry.entries()) {
    const departmentId = departmentFor(module.id);
    const context = await contextFor(actorId, departmentId);
    for (const [featureIndex, feature] of module.features.entries()) {
      // Audience reports need an actual past performance; seed-theater-workflows handles that.
      if (feature.id === "audience-report") continue;
      const creator =
        feature.id === "purchase"
          ? await contextFor(state.accounts["trade:administration"].userId!, departmentId)
          : feature.id === "availability"
            ? await contextFor(state.accounts["trade:ensemble"].userId!, departmentId)
            : context;
      const data: RecordData = {};
      for (const field of feature.fields) {
        if (field.type === "record") {
          if (field.source === "actors") data[field.key] = actor;
          else if (field.source === "characters") data[field.key] = character;
          continue;
        }
        if (field.type === "resource") {
          data[field.key] = resources[1];
          continue;
        }
        if (field.type === "budget") {
          data[field.key] = budgetId;
          continue;
        }
        if (field.type === "department") {
          data[field.key] = "";
          continue;
        }
        if (field.type === "member") {
          data[field.key] = state.accounts["trade:" + module.id].userId;
          continue;
        }
        if (field.type === "members") {
          data[field.key] = [state.accounts["trade:" + module.id].userId];
          continue;
        }
        if (field.type === "select") {
          data[field.key] = field.options![Math.min(1, field.options!.length - 1)];
          continue;
        }
        if (field.type === "checkbox") {
          data[field.key] = module.id !== "lighting";
          continue;
        }
        if (field.type === "number") {
          data[field.key] =
            field.key === "amountCents"
              ? feature.id === "budget"
                ? 2500000
                : 45000
              : field.key === "level"
                ? -12
                : field.key.includes("duration")
                  ? 45
                  : field.key === "fadeSeconds"
                    ? 3
                    : field.key === "sequence"
                      ? 10
                      : field.key === "pauseMinutes"
                        ? 15
                        : 2;
          continue;
        }
        if (field.type === "datetime") {
          data[field.key] =
            day(2 + moduleIndex) + (field.key === "end" ? "T11:00:00Z" : "T09:00:00Z");
          continue;
        }
        if (field.type === "date") {
          data[field.key] =
            field.key === "rightsUntil" ? "2027-07-31" : day(field.key === "end" ? 7 : 2);
          continue;
        }
        data[field.key] =
          field.type === "textarea"
            ? featureNotes[module.id]
            : field.key === "actor"
              ? "DEMO · Alex Bühnenlicht"
              : field.key === "character"
                ? "DEMO · Prospero"
                : field.key === "scene"
                  ? "Akt 1 · Sturm-Szene"
                  : field.key === "trigger"
                    ? "Letzter Satz in Akt 1"
                    : "DEMO · " + field.label;
      }
      if (feature.id === "readiness")
        data.notes =
          module.id === "lighting"
            ? "DEMO · Fokusprobe und Cue-Abnahme stehen noch aus."
            : "DEMO · Vorbereitung abgeschlossen; für die technische Probe freigegeben.";
      if (feature.id === "measurements")
        data.measurements =
          "DEMO · Ausschließlich synthetische Maße: Größe 178 cm, Brustumfang 96 cm.";
      const title = `DEMO · ${feature.label} · ${module.department}`;
      const savedId = await step(
        `trade:${module.id}:${feature.id}`,
        creator,
        tables.tradeItems,
        () =>
          saveTradeItem(creator, {
            moduleId: module.id,
            type: feature.id,
            title,
            status:
              feature.id === "budget"
                ? "published"
                : feature.id === "readiness"
                  ? module.id === "lighting"
                    ? "blocked"
                    : "ready"
                  : feature.id === "purchase"
                    ? "review"
                    : featureIndex % 2
                      ? "review"
                      : "draft",
            productionId: productions[0],
            data,
          }),
        async () =>
          (
            await db
              .select({ id: tables.tradeItems.id })
              .from(tables.tradeItems)
              .where(
                and(
                  eq(tables.tradeItems.title, title),
                  eq(tables.tradeItems.departmentId, departmentId),
                  eq(tables.tradeItems.productionId, productions[0]),
                ),
              )
              .limit(1)
          )[0],
      );
      if (feature.id === "budget") budgetId = savedId;
      tradeCount++;
    }
    // A second production gives the readiness view a complete, independent example.
    if (module.features.some((feature) => feature.id === "readiness"))
      await step(`ready:second:${module.id}`, context, tables.tradeItems, () =>
        saveTradeItem(context, {
          moduleId: module.id,
          type: "readiness",
          title: `DEMO · Freigabe Sommernacht · ${module.department}`,
          status: "ready",
          productionId: productions[1],
          data: { ready: true, notes: "DEMO · Abnahme abgeschlossen." },
        }),
      );
    console.log(
      JSON.stringify({
        stage,
        module: module.id,
        completed: moduleIndex + 1,
        total: moduleRegistry.length,
      }),
    );
  }
  for (let index = 0; index < 2; index++)
    await step("performance:" + index, admin, tables.performances, () =>
      scheduled(admin, {
        action: "performance",
        data: {
          productionId: productions[index],
          curtainAt: day(40 + index * 7) + "T17:30:00Z",
          resourceId: resources[0],
          participantIds: [state.accounts["trade:stage-management"].userId],
          durationMinutes: 120,
          pauseMinutes: 20,
          status: "planned",
        },
      }),
    );

  stage = "demo-time-and-chat";
  const employee = await contextFor(state.accounts.employee.userId!, departmentFor("makeup"));
  for (let index = 0; index < 3; index++) {
    const date = day(-index - 1);
    await record("time:" + index, employee, "time", {
      title: "DEMO · Maskenvorbereitung " + (index + 1),
      productionId: productions[0],
      taskId: task,
      category: "production",
      start: date + "T08:00:00Z",
      end: date + "T10:00:00Z",
      durationSeconds: 7200,
      pauseSeconds: 0,
      userId: employee.user.id,
      date,
      idempotencyKey: "demo-time-" + index,
    });
    await record("attendance:" + index, employee, "attendance", {
      title: "DEMO · Anwesenheit " + (index + 1),
      start: date + "T08:00:00Z",
      end: date + "T12:30:00Z",
      durationSeconds: 14400,
      pauseSeconds: 1800,
      userId: employee.user.id,
      date,
      idempotencyKey: "demo-attendance-" + index,
    });
  }
  const theaterChannel = await record("chat:theater", admin, "conversations", {
    title: "DEMO · Hausweite Abstimmung",
    mode: "team",
    scope: "theater",
  });
  const departmentChannel = await record("chat:makeup", admin, "conversations", {
    title: "DEMO · Maskenteam",
    mode: "team",
    scope: "department",
  });
  const privateChannel = await record("chat:private", employee, "conversations", {
    title: "DEMO · Private Übergabe",
    mode: "group",
    scope: "department",
    participantIds: [employee.user.id, state.accounts.team_lead.userId],
  });
  for (const [index, conversationId] of [
    theaterChannel,
    departmentChannel,
    privateChannel,
  ].entries()) {
    const context = index === 2 ? employee : admin;
    await step("message:" + index, context, tables.records, () =>
      saveRecord(context, "messages", {
        conversationId,
        text: [
          "DEMO · Willkommen im Beispieltheater! In den Gewerken liegen Vorbereitungen, Proben und Freigaben für „Der Sturm“.",
          "DEMO · Die Perücke ist vorbereitet. Die Fokusprobe im Licht ist noch offen; bitte vor der technischen Probe abstimmen.",
          "DEMO · Diese Nachricht sehen nur die beiden Teilnehmenden dieses privaten Demo-Chats.",
        ][index],
      }),
    );
  }
  stage = "demo-documents";
  if (!state.entries["document:text"]) {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const { uploadFile } = await import("../src/modules/files/service");
    const { ensureSharedDocument } = await import("../src/modules/documents/service");
    const bytes = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "DEMO · Produktionsleitfaden Der Sturm", bold: true }),
                ],
              }),
              new Paragraph(
                "Dies ist ein synthetisches, gemeinsam bearbeitbares Beispieldokument.",
              ),
              new Paragraph("1. Disposition stimmt Proben und Räume ab."),
              new Paragraph("2. Gewerke bereiten ihre Fachaufträge vor."),
              new Paragraph("3. Licht meldet die ausstehende Fokusprobe."),
              new Paragraph(
                "4. Vor der Generalprobe bestätigen alle erforderlichen Gewerke ihre Bereitschaft.",
              ),
            ],
          },
        ],
      }),
    );
    const saved = await runWorkerScope(request, admin, async () => {
      const file = await uploadFile(
        admin,
        new File([new Uint8Array(bytes)], "DEMO Produktionsleitfaden.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        "productions",
        productions[0],
      );
      await ensureSharedDocument(admin, file.id);
      return file;
    });
    state.entries["document:text"] = saved.id;
    saveState();
  }
  await drain(admin);
  await run(admin, async () => {
    await emit(db as never, admin, "TheaterDemoSeededV1", {
      recordId: organizationId,
      accounts: specs.length,
      productionCount: productions.length,
    });
    await auditChange(db as never, admin, "TheaterDemoSeededV1", organizationId);
  });
  await controlDb
    .update(tables.tenantSettings)
    .set({
      permissionVersion: sql`${tables.tenantSettings.permissionVersion}+1`,
      updatedAt: new Date(),
    })
    .where(eq(tables.tenantSettings.organizationId, organizationId));
  await drain(admin);
  state.complete = true;
  saveState();
  const credentialsPath = `.local/DEMO-ZUGAENGE-${settings.slug.toUpperCase()}.txt`;
  const lines = [
    "SHOWTIME · DEMO-ZUGÄNGE",
    `Theater: ${organization.name}`,
    `Login: ${runtime.APP_URL}/login`,
    "",
    "Alle DEMO-Namen und fachlichen Beispieldaten sind fiktiv. Die kopierten DigitalMask-Daten sind getrennt erkennbar.",
    "Der Demo-Superadmin hat nur Plattformrechte und keine Theaterzuordnung. Gastzugang: erste Demo-Produktion, 30 Tage.",
    "Passwörter sind individuell und stehen ausschließlich in dieser lokalen, nicht versionierten Datei.",
    "",
  ];
  for (const credential of Object.values(state.accounts))
    lines.push(
      credential.name,
      `Benutzername: ${credential.username}`,
      `Passwort: ${credential.password}`,
      `Bereich: ${credential.scope === "platform" ? "Plattform" : credential.scope === "tenant" ? "Gesamtes Theater" : credential.departments.map((id) => departments.find((d) => d.id === id)?.name).join(", ")}`,
      `Rollen: ${credential.roles.map((role) => roleLabels[role]).join(", ") || "Superadmin"}`,
      "",
    );
  fs.writeFileSync(credentialsPath, lines.join("\n"));
  const evidence = {
    success: true,
    environment,
    organizationId,
    accounts: specs.length,
    tenantRoleTypes: 10,
    trades: moduleRegistry.length,
    productions: productions.length,
    featureEntries: tradeCount,
    readinessExamples:
      moduleRegistry.filter((module) =>
        module.features.some((feature) => feature.id === "readiness"),
      ).length * 2,
    ownTimeEntries: 6,
    channels: 3,
    nativeDemoDocuments: 1,
    newEntries,
    credentialsFile: credentialsPath,
  };
  fs.writeFileSync(
    `.local/theater-demo-evidence-${environment}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(
    JSON.stringify({
      success: false,
      stage,
      step: activeStep,
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code,
      detailsOmitted: true,
    }),
  );
  process.exitCode = 1;
} finally {
  await Promise.all([authSql.end(), controlSql.end(), appSql.end(), workerSql.end()]);
}
