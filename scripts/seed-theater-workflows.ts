/** Extend an existing, explicit demo tenant. Uses runtime roles and ordinary domain commands. */
import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Context } from "../src/platform/context";
import type { CollaborationEntry } from "../src/shared/collaboration";

const [environment, organizationId, actorId, confirmation] = process.argv.slice(2);
if (
  !["development", "preview", "production"].includes(environment) ||
  !organizationId ||
  !actorId ||
  confirmation !== "--apply"
)
  throw new Error(
    "Usage: seed-theater-workflows.ts <environment> <demo-tenant-id> <authorized-actor-id> --apply",
  );
const runtime = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
Object.assign(process.env, runtime);
delete process.env.VERCEL;
const demo = JSON.parse(
  fs.readFileSync(`.local/theater-demo-${environment}-${organizationId}.json`, "utf8"),
);
if (demo.organizationId !== organizationId || !demo.complete)
  throw new Error("A completed, explicitly provisioned demo is required");
const statePath = `.local/theater-workflows-${environment}-${organizationId}.json`;
const state: { organizationId: string; entries: Record<string, string>; complete?: boolean } =
  fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, "utf8"))
    : { organizationId, entries: {} };
if (state.organizationId !== organizationId) throw new Error("Workflow state tenant mismatch");
const checkpoint = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const { authDb, controlDb, authSql, controlSql, appSql, workerSql } =
  await import("../src/platform/db/connections");
const tables = await import("../src/platform/db/schema");
const { db } = await import("../src/platform/db");
const { tenantTransaction } = await import("../src/platform/db/tenant");
const { requestScope } = await import("../src/platform/request");
const { runWorkerScope } = await import("../src/platform/events/worker");
const { effectiveGrants, availableScopes } = await import("../src/platform/context");
const { rolePermissions } = await import("../src/platform/access");
const { migratedId } = await import("../src/platform/migration/digitalmask");
const { createCollaboration, replyCollaboration, collaborationDetail } =
  await import("../src/modules/theater/collaborations");
const { scheduleAction, saveTradeItem } = await import("../src/modules/theater/service");
const { leadershipOverview } = await import("../src/modules/theater/overview");
const { uploadFile } = await import("../src/modules/files/service");
const { processEvents } = await import("../src/platform/events");
const { and, eq, sql } = await import("drizzle-orm");
const request = new Request(runtime.APP_URL + "/api/theater/collaborations", {
  method: "POST",
  headers: { origin: runtime.APP_URL },
});
const run = <T>(context: Context, work: () => Promise<T>) =>
  requestScope.run({ request, context, after: [] }, () => tenantTransaction(context, work, true));
let stage = "authorize";
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
  const departments = await controlDb
    .select()
    .from(tables.departments)
    .where(eq(tables.departments.organizationId, organizationId));
  const modules = await controlDb
    .select()
    .from(tables.moduleActivations)
    .where(
      and(
        eq(tables.moduleActivations.organizationId, organizationId),
        eq(tables.moduleActivations.enabled, true),
      ),
    );
  const departmentFor = (moduleId: string) => {
    const id = String(
      modules.find((module) => module.moduleId === moduleId)?.config.departmentId || "",
    );
    if (!departments.some((department) => department.id === id))
      throw new Error("Explicit active trade required");
    return id;
  };
  async function contextFor(userId: string, moduleId: string): Promise<Context> {
    const departmentId = departmentFor(moduleId),
      scopes = await availableScopes(userId);
    const active = scopes.filter(
      (scope) => scope.organizationId === organizationId && scope.status === "active",
    );
    if (!active.some((scope) => scope.departmentId === departmentId))
      throw new Error("Explicit active membership required");
    const grants = await effectiveGrants(userId, organizationId, scopes);
    const permissions = [
      ...new Set(
        grants
          .filter(
            (grant) =>
              grant.scope === "tenant" ||
              (grant.scope === "department" && grant.scopeId === departmentId),
          )
          .flatMap((grant) => rolePermissions[grant.role]),
      ),
    ];
    const [person] = await authDb.select().from(tables.user).where(eq(tables.user.id, userId));
    if (!person) throw new Error("Known actor required");
    const activeDepartmentIds = active.map((scope) => scope.departmentId);
    return {
      organizationId,
      organizationName: organization!.name,
      departmentId,
      departmentName: departments.find((department) => department.id === departmentId)!.name,
      grants,
      activeDepartmentIds,
      user: {
        id: person.id,
        username: person.username || "",
        name: person.name,
        role: permissions.includes("task.manage") ? "admin" : "user",
        status: "active",
        departmentId,
        permissions,
        grants,
        activeDepartmentIds,
      },
    };
  }
  const admin = await contextFor(actorId, "makeup");
  if (!admin.grants.some((grant) => grant.scope === "tenant" && grant.role === "intendance"))
    throw new Error("Explicit tenant provisioning grant required");
  const account = (moduleId: string) => {
    const person = demo.accounts["trade:" + moduleId];
    if (!person?.userId || !person.name.startsWith("DEMO"))
      throw new Error("Synthetic trade account required");
    return contextFor(person.userId, moduleId);
  };
  const productionId = demo.entries["production:0"];
  await run(admin, async () => {
    const [production] = await db
      .select()
      .from(tables.records)
      .where(and(eq(tables.records.id, productionId), eq(tables.records.kind, "productions")));
    if (!String(production?.data.title).startsWith("DEMO"))
      throw new Error("Synthetic production required");
  });
  const day = (offset: number) =>
    new Date(Date.parse(demo.createdAt.slice(0, 10) + "T00:00:00Z") + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  async function existing(context: Context, id: string) {
    return run(context, () => collaborationDetail(context, id));
  }
  async function reply(
    key: string,
    context: Context,
    entry: CollaborationEntry,
    action: "comment" | "request-changes" | "revise" | "approve" | "acknowledge",
    message: string,
    brief?: string,
  ) {
    if (state.entries[key]) return (await existing(context, entry.id)).entry;
    const current = await existing(context, entry.id);
    // History is the durable checkpoint if the local file was interrupted after a commit.
    const delivered = await run(
      context,
      async () =>
        (
          await db
            .select({ id: tables.tradeItemHistory.id })
            .from(tables.tradeItemHistory)
            .where(
              and(
                eq(tables.tradeItemHistory.itemId, entry.id),
                eq(tables.tradeItemHistory.createdBy, context.user.id),
                sql`${tables.tradeItemHistory.data}->>'message'=${message}`,
              ),
            )
            .limit(1)
        )[0],
    );
    if (!delivered)
      entry = await run(context, () =>
        replyCollaboration(context, {
          id: entry.id,
          expectedVersion: current.entry.version,
          action,
          message,
          ...(brief ? { brief } : {}),
        }),
      );
    else entry = current.entry;
    state.entries[key] = entry.id;
    checkpoint();
    return entry;
  }
  const specifications = [
    {
      key: "figurine",
      sender: "costume",
      target: "makeup",
      title: "DEMO · Ausstattung an Maske: Figurine und Perücke",
      kind: "approval",
      offset: 4,
      brief:
        "Für die Figur im zweiten Akt sind hoher Kragen und helle Perücke vorgesehen. Bitte prüft Silhouette, Halt und den Wechsel in 90 Sekunden gemeinsam mit der Kostümanprobe.",
      acceptance:
        "Maske bestätigt Silhouette, Befestigung und Wechselzeit. Das Kostümteam hat den aktuellen Stand eingesehen.",
      outcome: "open",
    },
    {
      key: "revision",
      sender: "costume",
      target: "makeup",
      title: "DEMO · Überarbeitung: Kragen und Perückenwechsel",
      kind: "approval",
      offset: 2,
      brief:
        "Bitte prüft den Abstand zwischen Kragen und Perücke und den geplanten schnellen Wechsel.",
      acceptance: "Gemeinsame Anprobe und Wechsel sind abgestimmt.",
      outcome: "approved",
    },
    {
      key: "sound-cue",
      sender: "stage-management",
      target: "sound",
      title: "DEMO · Probenänderung: Toneinsatz vor Szene 3",
      kind: "change",
      offset: -2,
      brief:
        "Aus der letzten Probe: Der Toneinsatz soll erst nach dem Lichtwechsel erfolgen. Bitte nennt die neue Cue-Nummer und prüft den Übergang vor der nächsten Durchlaufprobe.",
      acceptance: "Inspizienz und Ton verwenden dieselbe Cue-Nummer.",
      outcome: "open",
    },
    {
      key: "workshop",
      sender: "workshops",
      target: "stage",
      title: "DEMO · Übergabe: Tisch für die Bauprobe",
      kind: "handover",
      offset: 3,
      brief:
        "Der Prototyp des Bühnentischs ist in der Werkstatt bereit. Bitte stimmt Transportweg und Aufstellung für die Bauprobe ab. Technische Prüfungen und Sicherheitsabnahmen erfolgen durch die verantwortlichen Fachpersonen.",
      acceptance: "Bühnentechnik bestätigt die Übernahme und nennt offene Punkte.",
      outcome: "acknowledged",
    },
    {
      key: "press",
      sender: "dramaturgy",
      target: "marketing",
      title: "DEMO · Feedback: Kurztext zum Programmheft",
      kind: "feedback",
      offset: 5,
      brief:
        "Entwurf: Eine Insel, ein Sturm und ein Neuanfang. Bitte prüft den Kurztext für die Ankündigung auf Länge und Verständlichkeit.",
      acceptance: "Text und Veröffentlichungstermin sind abgestimmt.",
      outcome: "changes",
    },
    {
      key: "foh",
      sender: "stage-management",
      target: "front-of-house",
      title: "DEMO · Übergabe: Pause und Einlasshinweise",
      kind: "handover",
      offset: 7,
      brief:
        "Für die Vorstellung ist eine Pause von 20 Minuten nach Akt 2 geplant. Bitte übernehmt die Hinweise zur verspäteten Platznahme in den Einlassablauf.",
      acceptance: "Das Vorderhaus bestätigt den erhaltenen Ablauf.",
      outcome: "open",
    },
  ] as const;
  for (const spec of specifications) {
    stage = "workflow:" + spec.key;
    const sender = await account(spec.sender),
      target = await account(spec.target);
    let entry = await run(sender, () =>
      createCollaboration(sender, {
        id: migratedId(organizationId, "demo-workflow:" + spec.key),
        title: spec.title,
        kind: spec.kind,
        recipientDepartmentId: target.departmentId,
        productionId,
        brief: spec.brief,
        acceptance: spec.acceptance,
        dueDate: day(spec.offset),
      }),
    );
    state.entries["workflow:" + spec.key] = entry.id;
    checkpoint();
    if (spec.key === "figurine") {
      const detail = await existing(sender, entry.id);
      if (!detail.files.some((file) => file.data.name === "DEMO Ausstattung und Maske.pdf")) {
        const pdf = await PDFDocument.create(),
          font = await pdf.embedFont(StandardFonts.Helvetica),
          bold = await pdf.embedFont(StandardFonts.HelveticaBold),
          page = pdf.addPage([595, 842]);
        page.drawText("DEMO: Ausstattung und Maske", {
          x: 48,
          y: 780,
          size: 22,
          font: bold,
          color: rgb(0.08, 0.35, 0.28),
        });
        const lines = [
          "Fiktives Abstimmungsblatt | Der Sturm | Figur im zweiten Akt",
          "",
          "KOSTUEM",
          "Hoher Kragen, sandfarbener Mantel, verdeckte Verschluesse.",
          "Anprobe: Kragenfreiheit und schnelle Verschluesse gemeinsam pruefen.",
          "",
          "MASKE",
          "Helle Peruecke, klarer Scheitel, dezente Alterung.",
          "Befestigung darf den Kragen beim Wechsel nicht beruehren.",
          "",
          "WECHSEL",
          "90 Sekunden zwischen Szene 2 und Szene 3.",
          "1. Kostuem loest den Mantelverschluss.",
          "2. Maske prueft Halt und Silhouette.",
          "3. Beide Teams bestaetigen den gemeinsam erprobten Ablauf.",
          "",
          "OFFENE FRAGEN",
          "Reicht der Abstand zum Kragen?",
          "Ist die Wechselzeit in der naechsten Probe realistisch?",
          "",
          "Dieses Dokument enthaelt ausschliesslich synthetische Beispieldaten.",
        ];
        lines.forEach((text, index) =>
          page.drawText(text, { x: 48, y: 735 - index * 25, size: 11, font }),
        );
        const bytes = await pdf.save();
        const file = await runWorkerScope(request, sender, () =>
          uploadFile(
            sender,
            new File([new Uint8Array(bytes)], "DEMO Ausstattung und Maske.pdf", {
              type: "application/pdf",
            }),
            "handovers",
            entry.id,
          ),
        );
        state.entries["attachment:figurine"] = file.id;
        checkpoint();
      }
      entry = (await existing(sender, entry.id)).entry;
      await reply(
        "comment:figurine",
        target,
        entry,
        "comment",
        "DEMO · Wir prüfen die Figurine bei der nächsten gemeinsamen Anprobe. Bitte bringt den Musterkragen mit.",
      );
    }
    if (spec.outcome === "approved") {
      entry = await reply(
        "changes:revision",
        target,
        entry,
        "request-changes",
        "DEMO · Bitte senkt den Kragen um zwei Zentimeter und beschreibt die Befestigung der Perücke.",
      );
      entry = await reply(
        "revise:revision",
        sender,
        entry,
        "revise",
        "DEMO · Kragen angepasst; neue Wechselbeschreibung liegt vor.",
        "Überarbeiteter Stand: Der Kragen ist zwei Zentimeter niedriger. Die Perücke wird vor dem Mantelwechsel auf Halt geprüft; gemeinsame Anprobe abgeschlossen.",
      );
      await reply(
        "approve:revision",
        target,
        entry,
        "approve",
        "DEMO · Silhouette, Befestigung und Wechselzeit gemeinsam geprüft. Dieser Stand ist freigegeben.",
      );
    }
    if (spec.outcome === "acknowledged")
      await reply(
        "ack:" + spec.key,
        target,
        entry,
        "acknowledge",
        "DEMO · Übergabe erhalten. Transport und Aufstellung für die Bauprobe sind abgestimmt.",
      );
    if (spec.outcome === "changes")
      await reply(
        "changes:" + spec.key,
        target,
        entry,
        "request-changes",
        "DEMO · Bitte ergänzt den Termin und kürzt den Text auf 180 Zeichen.",
      );
    console.log(JSON.stringify({ stage, success: true }));
  }
  stage = "audience-report";
  if (!state.entries["performance:past"]) {
    const show = await run(admin, async () => {
      const [saved] = await db
        .select()
        .from(tables.performances)
        .where(
          and(
            eq(tables.performances.productionId, productionId),
            eq(tables.performances.curtainAt, new Date(day(-3) + "T17:30:00Z")),
          ),
        );
      return (
        saved ||
        scheduleAction(admin, {
          action: "performance",
          data: {
            productionId,
            curtainAt: day(-3) + "T17:30:00Z",
            durationMinutes: 120,
            pauseMinutes: 20,
            status: "confirmed",
          },
        })
      );
    });
    if (!("id" in show)) throw new Error("Performance identity required");
    state.entries["performance:past"] = String(show.id);
    checkpoint();
  }
  const front = await account("front-of-house");
  if (!state.entries["audience-report"]) {
    const report = await run(front, async () => {
      const [saved] = await db
        .select()
        .from(tables.tradeItems)
        .where(
          and(
            eq(tables.tradeItems.type, "audience-report"),
            sql`${tables.tradeItems.data}->>'performanceId'=${state.entries["performance:past"]}`,
          ),
        );
      return (
        saved ||
        saveTradeItem(front, {
          moduleId: "front-of-house",
          type: "audience-report",
          title: "DEMO · Besucher- und Kassenbericht Der Sturm",
          productionId,
          status: "done",
          data: {
            performanceId: state.entries["performance:past"],
            offeredSeats: 400,
            visitors: 328,
            paidTickets: 312,
            complimentaryTickets: 16,
            amountCents: 624000,
            notes:
              "DEMO · Rein fiktive Zahlen zum Erkunden des Dashboards; keine echten Kartenerlöse.",
          },
        })
      );
    });
    state.entries["audience-report"] = report.id;
    checkpoint();
  }
  stage = "delivery-and-verification";
  for (let page = 0; page < 60; page++) {
    const result = await runWorkerScope(request, admin, () => processEvents());
    if (!result.processed) break;
    if (page === 59) throw new Error("Workflow events did not settle");
  }
  const overview = await run(admin, () =>
    leadershipOverview(admin, { from: day(-30), to: day(60) }),
  );
  if (overview.audience.reports < 1 || overview.audience.occupancy !== 82)
    throw new Error("Seeded actual audience report must appear in the dashboard");
  state.complete = true;
  checkpoint();
  const evidence = {
    success: true,
    environment,
    organizationId,
    workflows: specifications.length,
    attachments: 1,
    audienceReports: 1,
    occupancy: overview.audience.occupancy,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    `.local/theater-workflow-evidence-${environment}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(
    JSON.stringify({
      success: false,
      stage,
      error: error instanceof Error ? error.name : "Unknown",
    }),
  );
  process.exitCode = 1;
} finally {
  await Promise.all([authSql.end(), controlSql.end(), appSql.end(), workerSql.end()]);
}
