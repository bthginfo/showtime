import { getTableColumns } from "drizzle-orm";
import { pageTimestamp } from "@/platform/db/page-timestamp";
import { and, eq, desc, sql, ne, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { planningSnapshot, snapshotIdentity } from "./snapshot";
import { decodePosition, encodePosition } from "@/platform/pagination";
import { collectionPage, collections, planningWindow, type PlanningWindow } from "./collections";
import { assertPlanning } from "./planning-rules";
import { assertStageReady, productionReadiness, dependencyCheck } from "./readiness";
import { approvalContentHash, verifiedApproval, approvalCurrent } from "./approval";
import { validateFach, applyFachEffects } from "./fach-logic";
import { readReferences } from "@/modules/records/pages";
import { db } from "@/platform/db";
import {
  departments,
  tradeItems,
  tradeItemHistory,
  moduleActivations,
  records,
  venueResources,
  resourceBookings,
  performances,
  productionRuns,
  theaterProductions,
  theaterWorks,
  theaterSeasons,
  scheduleVersions,
  tenantSettings,
  memberships,
} from "@/platform/db/schema";
import { can, requirePermission, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { emit, auditChange, scheduleEvents } from "@/platform/events";
import { invalidateWorkspace } from "@/modules/records/workspace";
import { assertProject, findRecord, projectVisible } from "@/modules/records/repository";
import { assertRead } from "@/modules/records/service";
import { validateFeature, moduleById, moduleRegistry } from "./registry";
import { collaborationReadable } from "@/shared/collaboration";
const inputSchema = z.object({
  id: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
  moduleId: z.string(),
  type: z.string(),
  title: z.string().trim().min(1).max(200),
  productionId: z.string().optional(),
  performanceId: z.string().optional(),
  ownerId: z.string().optional(),
  dependencyIds: z.array(z.string().max(100)).max(50).default([]),
  dueAt: z.iso.datetime().optional(),
  deputyId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "review", "published", "ready", "done", "blocked"]).default("draft"),
});
async function changedEntity<T extends { id: string; version?: number }>(
  context: Context,
  type: string,
  row: T,
  productionId?: string,
) {
  await emit(db as never, context, type, {
    recordId: row.id,
    version: row.version || 1,
    ...(productionId ? { productionId } : {}),
  });
  await auditChange(db as never, context, type, row.id);
  invalidateWorkspace(context.departmentId);
  scheduleEvents();
  return row;
}
export function tradeReadable(context: Context, item: typeof tradeItems.$inferSelect) {
  if (item.type === "collaboration")
    return collaborationReadable(
      { ...context.user, grants: context.grants, activeDepartmentIds: context.activeDepartmentIds },
      item,
    );
  const feature = moduleById(item.moduleId)?.features.find((f) => f.id === item.type);
  if (item.type === "workspace") return can(context, "production.read", item.productionId || "");
  if (!feature) return false;
  if (
    !feature.private &&
    ["cue", "scene"].includes(item.type) &&
    item.productionId &&
    can(
      context,
      item.type === "cue" ? "cue.read" : "scene.read",
      item.productionId,
      context.departmentId,
    ) &&
    can(context, "production.read", item.productionId)
  )
    return true;
  if (!feature.private)
    return can(context, "document.read", item.productionId || "", item.departmentId);
  if (item.type === "measurements")
    return can(context, "measurements.read", item.productionId || "", item.departmentId);
  if (item.type === "participant")
    return can(context, "education.participants.read", item.productionId || "", item.departmentId);
  if (item.type === "audience-report")
    return (
      item.createdBy === context.user.id ||
      can(context, "budget.read", item.productionId || "", item.departmentId) ||
      can(context, "schedule.manage", item.productionId || "", item.departmentId)
    );
  if (item.type === "availability")
    return (
      item.createdBy === context.user.id ||
      can(context, "schedule.manage", item.productionId || "", item.departmentId)
    );
  if (item.type === "purchase")
    return (
      item.createdBy === context.user.id ||
      can(context, "budget.read", item.productionId || "", item.departmentId) ||
      can(context, "budget.approve", item.productionId || "", item.departmentId)
    );
  return (
    can(context, "budget.read", item.productionId || "", item.departmentId) ||
    can(context, "budget.approve", item.productionId || "", item.departmentId)
  );
}
export async function theaterWorkspace(
  context: Context,
  productionId?: string,
  cursor?: string,
  window: PlanningWindow = {},
) {
  if (productionId) await assertProject(context, productionId);
  const range = planningWindow(window),
    position = decodePosition(cursor, context, "trade:" + String(productionId || ""));
  const items = await db
    .select({ ...getTableColumns(tradeItems), positionAt: pageTimestamp(tradeItems.updatedAt) })
    .from(tradeItems)
    .where(
      and(
        eq(tradeItems.organizationId, context.organizationId),
        productionId ? eq(tradeItems.productionId, productionId) : undefined,
        position
          ? sql`(${tradeItems.updatedAt},${tradeItems.id})<(${position[0]},${position[1]})`
          : undefined,
      ),
    )
    .orderBy(desc(tradeItems.updatedAt), desc(tradeItems.id))
    .limit(301);
  const refs = await readReferences(context),
    permitted = (id: string | null) => !id || refs.projectIds.has(id);
  const modules = await db
    .select()
    .from(moduleActivations)
    .where(eq(moduleActivations.enabled, true));
  const result: Record<string, unknown> = {};
  const [tenantConfiguration] = await db.select().from(tenantSettings).limit(1);
  const blocks = await db
    .select()
    .from(tradeItems)
    .where(
      and(
        sql`${tradeItems.data}->>'resourceId' is not null`,
        sql`${tradeItems.status} not in ('done','archived','cancelled')`,
        sql`((${tradeItems.data}->>'blockResource'='true' and (${tradeItems.type}='incident' or ${tradeItems.data}->>'result'='failed')) or (${tradeItems.type}='asset' and ${tradeItems.data}->>'condition' in ('blocked','maintenance')))`,
      ),
    )
    .limit(1001);
  if (blocks.length > 1000)
    throw new HttpError(413, "Zu viele Ressourcensperren. Kläre abgeschlossene Störungen zuerst.");
  const pages: Record<string, string | null> = {};
  for (const name of collections) {
    const page = await collectionPage(context, name, undefined, productionId, range, refs);
    result[name] = page.entries;
    pages[name] = page.nextCursor;
  }
  const funding = await db
    .select()
    .from(tradeItems)
    .where(and(eq(tradeItems.type, "budget"), eq(tradeItems.status, "published")));
  const visibleItems = items
    .slice(0, 300)
    .filter((i) => tradeReadable(context, i) && permitted(i.productionId));
  const tradeFiles = visibleItems.length
    ? await db
        .select({ id: records.id, data: records.data })
        .from(records)
        .where(
          and(
            eq(records.kind, "files"),
            inArray(
              sql`${records.data}->>'recordId'`,
              visibleItems.map((i) => "trade-files:" + i.id),
            ),
            sql`${records.data}->>'pendingDeletionOperation' is null`,
          ),
        )
        .limit(2000)
    : [];
  return {
    ...result,
    timezone: tenantConfiguration?.timezone || "Europe/Berlin",
    resourceBlocks: blocks
      .filter((i) => tradeReadable(context, i) && permitted(i.productionId))
      .map((i) => ({ itemId: i.id, resourceId: String(i.data.resourceId), title: i.title })),
    tradeFiles: tradeFiles.map((file) => ({
      id: file.id,
      data: {
        name: file.data.name,
        title: file.data.name,
        recordId: file.data.recordId,
        size: file.data.size,
      },
    })),
    pages,
    window: range,
    departments: modules.map((m) => ({
      id: String(m.config.departmentId || ""),
      name: moduleById(m.moduleId)?.department || m.moduleId,
    })),
    funding: can(context, "budget.request", productionId)
      ? funding
          .filter(
            (b) =>
              permitted(b.productionId) &&
              (!b.data.department || b.data.department === context.departmentId),
          )
          .map((b) => ({
            id: b.id,
            title: b.title,
            productionId: b.productionId,
            department: b.data.department || "",
            costCentre: b.data.costCentre || "",
          }))
      : [],
    items: await Promise.all(
      items
        .slice(0, 300)
        .filter((i) => tradeReadable(context, i) && permitted(i.productionId))
        .map(async (i) => ({ ...i, approvalVerified: await approvalCurrent(i, db) })),
    ),
    nextCursor:
      items.length > 300
        ? encodePosition(
            [items[299].positionAt, items[299].id],
            context,
            "trade:" + String(productionId || ""),
          )
        : null,
    modules: modules.map((m) => ({ ...m, manifest: moduleById(m.moduleId) })),
    readiness: productionId ? await productionReadiness(context, productionId) : [],
  };
}
export async function saveTradeItem(context: Context, input: unknown) {
  const body = inputSchema.parse(input);
  const { feature, data } = validateFeature(body.moduleId, body.type, body.data);
  await assertProject(context, body.productionId);
  const [activation] = await db
    .select()
    .from(moduleActivations)
    .where(and(eq(moduleActivations.moduleId, body.moduleId), eq(moduleActivations.enabled, true)))
    .limit(1);
  if (!activation) throw new HttpError(403, "Dieses Modul ist nicht freigeschaltet.");
  if (body.performanceId) {
    const [show] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, body.performanceId))
      .limit(1);
    if (!show || show.productionId !== body.productionId)
      throw new HttpError(400, "Die Vorstellung gehört nicht zu dieser Produktion.");
  }

  const dateRange =
    feature.fields.some((field) => field.key === "start" && field.type === "date") &&
    feature.fields.some((field) => field.key === "end" && field.type === "date");
  if (
    data.start &&
    data.end &&
    (new Date(String(data.start)) > new Date(String(data.end)) ||
      (!dateRange &&
        new Date(String(data.start)).getTime() === new Date(String(data.end)).getTime()))
  )
    throw new HttpError(400, "Das Ende muss nach dem Beginn liegen.");
  if (
    ["marketing", "dramaturgy", "video"].includes(body.moduleId) &&
    body.status === "published" &&
    data.rightsUntil &&
    String(data.rightsUntil) < new Date().toISOString().slice(0, 10)
  )
    throw new HttpError(409, "Die Nutzungsrechte sind abgelaufen.");
  const result = await db.transaction(async (tx) => {
    if (body.type === "budget")
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":budget"}))`,
      );
    if (feature.permission === "schedule.manage" || body.type === "cast-change")
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
      );
    const [existing] = body.id
      ? await tx.select().from(tradeItems).where(eq(tradeItems.id, body.id)).limit(1).for("update")
      : [];
    if (body.id && !existing) throw new HttpError(404, "Eintrag nicht gefunden.");
    const departmentId = existing?.departmentId || context.departmentId;
    if (body.type === "audience-report") {
      const performanceId = String(data.performanceId);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":audience:" + performanceId}))`,
      );
      const [show] = await tx
        .select()
        .from(performances)
        .where(eq(performances.id, performanceId))
        .limit(1);
      if (
        !show ||
        show.productionId !== body.productionId ||
        show.status === "cancelled" ||
        show.curtainAt > new Date()
      )
        throw new HttpError(400, "Wähle eine bereits gespielte Vorstellung dieser Produktion.");
      if (
        Number(data.visitors) > Number(data.offeredSeats) ||
        Number(data.paidTickets) + Number(data.complimentaryTickets) > Number(data.offeredSeats)
      )
        throw new HttpError(
          400,
          "Besucher und ausgegebene Karten dürfen die angebotenen Plätze nicht überschreiten.",
        );
      const [duplicate] = await tx
        .select({ id: tradeItems.id })
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.type, "audience-report"),
            sql`${tradeItems.data}->>'performanceId'=${performanceId}`,
            existing ? ne(tradeItems.id, existing.id) : undefined,
          ),
        )
        .limit(1);
      if (duplicate)
        throw new HttpError(
          409,
          "Für diese Vorstellung gibt es bereits einen Bericht. Bearbeite den vorhandenen Eintrag.",
        );
    }
    if (
      body.status === "published" &&
      !can(
        context,
        body.type === "budget"
          ? "budget.approve"
          : feature.permission === "schedule.manage"
            ? "schedule.publish"
            : "document.publish",
        body.productionId,
        departmentId,
      )
    )
      throw new HttpError(403, "Keine Veröffentlichungsberechtigung für diesen Bereich.");
    if (
      body.status === "ready" &&
      !can(context, "readiness.manage", body.productionId, departmentId)
    )
      throw new HttpError(403, "Keine Bereitschaftsberechtigung für diesen Bereich.");
    await dependencyCheck(context, body.dependencyIds, body.id, body.productionId, body.status, tx);
    if (!can(context, feature.permission, body.productionId, departmentId))
      throw new HttpError(403, "Keine Berechtigung für diese Fachfunktion.");
    if (
      !["budget", "purchase"].includes(body.type) &&
      activation.config.departmentId !== departmentId
    )
      throw new HttpError(403, "Dieses Fachmodul gehört zu einem anderen Gewerk.");
    if (existing) {
      if (["archived", "cancelled"].includes(existing.status))
        throw new HttpError(
          409,
          "Stelle diesen Fachstand zuerst mit einer Begründung wieder her oder lege einen Nachfolgestand an.",
        );
      if (body.type === "purchase" && ["approved", "rejected"].includes(existing.status))
        throw new HttpError(
          409,
          "Ein entschiedener Bedarfsantrag bleibt unverändert. Lege für einen neuen Bedarf einen neuen Antrag an.",
        );
      if (
        !tradeReadable(context, existing) ||
        existing.moduleId !== body.moduleId ||
        existing.type !== body.type
      )
        throw new HttpError(403, "Keine Berechtigung für diesen Eintrag.");
      if (
        existing.createdBy !== context.user.id &&
        !can(
          context,
          body.type === "budget"
            ? "budget.approve"
            : body.type === "measurements"
              ? "measurements.manage"
              : feature.permission === "schedule.manage"
                ? "schedule.manage"
                : "document.manage",
          body.productionId,
          departmentId,
        )
      )
        throw new HttpError(403, "Du kannst diesen Eintrag nicht verwalten.");
      if (existing.version !== body.expectedVersion)
        throw new HttpError(409, "Der Eintrag wurde inzwischen geändert.");
    }
    if (body.type === "budget" && existing) {
      const approved = await tx
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.type, "purchase"),
            eq(tradeItems.status, "approved"),
            sql`${tradeItems.data}->>'budgetId'=${existing.id}`,
          ),
        );
      if (
        approved.length &&
        (body.status !== "published" ||
          existing.productionId !== (body.productionId || null) ||
          data.department !== existing.data.department ||
          approved.reduce((sum, r) => sum + Number(r.data.amountCents || 0), 0) >
            Number(data.amountCents || 0))
      )
        throw new HttpError(409, "Der Budgetrahmen muss bestehende Freigaben weiterhin abdecken.");
    }
    if (body.type === "purchase") {
      const [budget] = await tx
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.id, String(data.budgetId)),
            eq(tradeItems.type, "budget"),
            eq(tradeItems.status, "published"),
          ),
        )
        .limit(1);
      if (
        !budget ||
        budget.productionId !== (body.productionId || null) ||
        (budget.data.department && budget.data.department !== departmentId)
      )
        throw new HttpError(400, "Wähle einen passenden freigegebenen Budgetrahmen.");
    }
    if (body.type === "budget" && data.department) {
      const { departments } = await import("@/platform/db/schema");
      const [department] = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, String(data.department)))
        .limit(1);
      if (!department) throw new HttpError(400, "Gewerk nicht gefunden.");
    }
    const castDay = new Intl.DateTimeFormat("sv-SE", {
      timeZone: context.timezone || "Europe/Berlin",
    }).format(new Date());
    if (body.type === "cast-change") {
      const [assignment] = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.kind, "casting"),
            sql`${records.data}->>'productionId'=${body.productionId || ""}`,
            sql`${records.data}->>'characterId'=${String(data.characterId)}`,
          ),
        )
        .limit(1);
      if (assignment && (!existing?.data._castApplied || data.actorId !== existing.data.actorId))
        data.previousActorId = String(assignment.data.actorId);
      data._castApplied = !data.effectiveFrom || String(data.effectiveFrom) <= castDay;
      data._castAuthorId = context.user.id;
    }
    for (const field of feature.fields.filter((f) => f.type === "record"))
      if (data[field.key])
        await assertRead(
          context,
          await findRecord(context, String(data[field.key]), field.source, tx),
          tx,
        );
    await validateFach(context, body, data, feature, existing, tx, (item) =>
      tradeReadable(context, item),
    );
    if (body.type === "readiness" && data.ready === true) {
      if (!body.productionId)
        throw new HttpError(400, "Wähle eine Produktion, deren Bereitschaft du bestätigst.");
      const sources = await tx
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.productionId, body.productionId),
            eq(tradeItems.moduleId, body.moduleId),
          ),
        );
      if (
        sources.some(
          (i) =>
            i.status === "blocked" &&
            !moduleById(i.moduleId)?.features.find((f) => f.id === i.type)?.private,
        )
      )
        throw new HttpError(
          409,
          "Ein blockierter Fachstand verhindert die Bereitschaft. Kläre ihn zuerst.",
        );
      data._checkedSources = Object.fromEntries(
        sources
          .filter(
            (i) =>
              !["readiness", "workspace", "collaboration"].includes(i.type) &&
              !moduleById(i.moduleId)?.features.find((f) => f.id === i.type)?.private &&
              !["archived", "cancelled"].includes(i.status),
          )
          .map((i) => [i.id, i.version]),
      );
      data._checkedBy = context.user.id;
      data._checkedAt = new Date().toISOString();
    }
    const ownerId = body.ownerId || existing?.ownerId || context.user.id;
    for (const memberId of [ownerId, body.deputyId].filter(Boolean) as string[]) {
      if (
        memberId !== context.user.id &&
        !can(context, "task.assign", body.productionId, departmentId)
      )
        throw new HttpError(
          403,
          "Keine Berechtigung, andere Personen als Verantwortliche einzusetzen.",
        );
      const [member] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.userId, memberId), eq(memberships.status, "active")))
        .limit(1);
      if (!member)
        throw new HttpError(400, "Eine verantwortliche Person ist kein aktives Theatermitglied.");
    }
    if (body.deputyId) data._deputyId = body.deputyId;
    data.dependencyIds = body.dependencyIds;
    if (existing?.data._fileVersion !== undefined) data._fileVersion = existing.data._fileVersion;
    if (existing?.data.eventId) data.eventId = existing.data.eventId;
    if (feature.permission === "schedule.manage" && data.start && data.end) {
      const { saveRecord } = await import("@/modules/records/service");
      const original = existing?.data.eventId
        ? await findRecord(context, String(existing.data.eventId), "events", tx)
        : undefined;
      const categoryId = "scheduled:" + context.organizationId + ":" + departmentId;
      await tx
        .insert(records)
        .values({
          id: categoryId,
          organizationId: context.organizationId,
          departmentId,
          kind: "calendarCategories",
          createdBy: context.user.id,
          data: {
            key: "theater-activity",
            name: "Theatertermin",
            color: "#43735a",
            allDay: false,
            blocksTime: true,
          },
        })
        .onConflictDoNothing();
      const calendar = await saveRecord(
        context,
        "events",
        {
          ...(original?.data || {}),
          title: body.title,
          category: "theater-activity",
          productionId: body.productionId || "",
          start: String(data.start),
          end: String(data.end),
          participantIds: Array.isArray(data.participantIds)
            ? data.participantIds
            : [context.user.id],
          resourceId: data.resourceId || "",
          location: "",
          recurrence: "none",
          actorIds: [],
          pauseMinutes: Number(data.pauseMinutes || 0),
        },
        original?.id,
        original?.version,
        { transaction: tx },
      );
      data.eventId = calendar.id;
    }
    const approvalField = feature.fields.find((field) => field.managed === "approval");
    const proposedSource = {
      moduleId: body.moduleId,
      type: body.type,
      title: body.title,
      productionId: body.productionId,
      data,
    };
    const unchangedApproval =
      existing &&
      (await approvalCurrent(existing, tx)) &&
      approvalContentHash(existing) === approvalContentHash(proposedSource);
    if (approvalField) {
      const claimingApproval =
        data[approvalField.key] === "approved" || data[approvalField.key] === true;
      if (claimingApproval && !unchangedApproval)
        throw new HttpError(
          409,
          "Fordere die Freigabe des Fachstands unter Zusammenarbeit an. Eine Selbstfreigabe ist nicht möglich.",
        );
      data[approvalField.key] = unchangedApproval
        ? approvalField.type === "checkbox"
          ? true
          : "approved"
        : approvalField.type === "checkbox"
          ? false
          : "draft";
      if (["published", "ready", "done"].includes(body.status) && !unchangedApproval)
        throw new HttpError(
          409,
          "Für die Veröffentlichung fehlt die Freigabe dieser unveränderten Fassung.",
        );
    }
    if (unchangedApproval) data._approval = existing!.data._approval;
    const values = {
      organizationId: context.organizationId,
      departmentId,
      moduleId: body.moduleId,
      type: body.type,
      title: body.title,
      productionId: body.productionId || null,
      performanceId: body.performanceId || null,
      ownerId,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      status: body.status,
      data,
      version: (existing?.version || 0) + 1,
      updatedAt: new Date(),
    };
    const [saved] = existing
      ? await tx
          .update(tradeItems)
          .set(values)
          .where(and(eq(tradeItems.id, existing.id), eq(tradeItems.version, existing.version)))
          .returning()
      : await tx
          .insert(tradeItems)
          .values({ ...values, createdBy: context.user.id })
          .returning();
    if (!saved) throw new HttpError(409, "Der Eintrag wurde inzwischen geändert.");
    await applyFachEffects(context, saved, tx, existing);
    await tx.insert(tradeItemHistory).values({
      organizationId: context.organizationId,
      itemId: saved.id,
      version: saved.version,
      data: { title: saved.title, status: saved.status, data: saved.data },
      createdBy: context.user.id,
    });
    if (
      body.type === "cast-change" &&
      data._castApplied &&
      (!existing?.data._castApplied ||
        data.actorId !== existing.data.actorId ||
        data.characterId !== existing.data.characterId)
    ) {
      if (!body.productionId)
        throw new HttpError(400, "Wähle eine Produktion für die Umbesetzung.");
      const { saveRecord } = await import("@/modules/records/service");
      const assignment = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.kind, "casting"),
            sql`${records.data}->>'productionId'=${body.productionId}`,
            sql`${records.data}->>'characterId'=${String(data.characterId)}`,
          ),
        )
        .limit(1);
      await saveRecord(
        context,
        "casting",
        {
          ...(assignment[0]?.data || {}),
          productionId: body.productionId,
          characterId: String(data.characterId),
          actorId: String(data.actorId),
        },
        assignment[0]?.id,
        assignment[0]?.version,
      );
    }
    await emit(
      tx,
      context,
      body.type === "show-report" && body.status === "published"
        ? "ShowReportPublishedV1"
        : body.type === "readiness"
          ? "DepartmentReadinessChangedV1"
          : "TradeItemChangedV1",
      {
        recordId: saved.id,
        productionId: saved.productionId || "",
        moduleId: body.moduleId,
        ready: body.status === "ready" || data.ready === true,
        title: saved.title,
        targetModules: data.targetDepartments || "",
        version: saved.version,
      },
    );
    await auditChange(tx, context, "trade-item.saved", saved.id);
    return saved;
  });
  invalidateWorkspace(context.departmentId);
  scheduleEvents();
  return result;
}
export async function approvePurchase(
  context: Context,
  id: string,
  expectedVersion: number,
  decision: "approved" | "rejected",
) {
  const saved = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":budget"}))`,
    );
    const [item] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, id))
      .limit(1)
      .for("update");
    if (!item || item.type !== "purchase")
      throw new HttpError(404, "Bedarfsantrag nicht gefunden.");
    if (!can(context, "budget.approve", item.productionId || "", item.departmentId))
      throw new HttpError(403, "Keine Freigabeberechtigung für diesen Antrag.");
    await assertProject(context, item.productionId);
    if (item.status !== "review")
      throw new HttpError(409, "Nur zur Prüfung eingereichte Anträge können entschieden werden.");
    if (item.createdBy === context.user.id)
      throw new HttpError(403, "Eigene Bedarfsanträge dürfen nicht selbst genehmigt werden.");
    if (item.version !== expectedVersion)
      throw new HttpError(409, "Der Antrag wurde inzwischen geändert.");
    if (decision === "approved") {
      const [budget] = await tx
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.id, String(item.data.budgetId)),
            eq(tradeItems.type, "budget"),
            eq(tradeItems.status, "published"),
          ),
        )
        .limit(1)
        .for("update");
      if (
        !budget ||
        budget.productionId !== item.productionId ||
        (budget.data.department && budget.data.department !== item.departmentId)
      )
        throw new HttpError(
          409,
          "Der Budgetrahmen ist nicht mehr freigegeben oder gehört zu einem anderen Bereich.",
        );
      const requests = await tx
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.type, "purchase"),
            eq(tradeItems.status, "approved"),
            sql`${tradeItems.data}->>'budgetId'=${budget.id}`,
            ne(tradeItems.id, id),
          ),
        );
      const ceiling = Number(budget.data.amountCents || 0),
        used = requests.reduce((sum, r) => sum + Number(r.data.amountCents || 0), 0);
      if (!ceiling || used + Number(item.data.amountCents || 0) > ceiling)
        throw new HttpError(409, "Der Antrag überschreitet den freigegebenen Budgetrahmen.");
    }
    const [result] = await tx
      .update(tradeItems)
      .set({
        status: decision,
        version: item.version + 1,
        updatedAt: new Date(),
        data: { ...item.data, approvedBy: context.user.id, decidedAt: new Date().toISOString() },
      })
      .where(eq(tradeItems.id, id))
      .returning();
    await emit(tx, context, "PurchaseDecidedV1", {
      recordId: id,
      productionId: item.productionId || "",
      userIds: [item.createdBy],
      title: item.title,
    });
    await auditChange(tx, context, "purchase.decided", id);
    return result;
  });
  scheduleEvents();
  invalidateWorkspace(context.departmentId);
  return saved;
}
export async function saveResource(context: Context, input: unknown) {
  requirePermission(context, "inventory.manage");
  const body = z
    .object({
      id: z.string().optional(),
      expectedVersion: z.number().int().optional(),
      name: z.string().min(1).max(150),
      type: z.enum(["stage", "rehearsal-room", "studio", "equipment", "vehicle", "storage"]),
      capacity: z.number().int().min(1).max(10000),
      departmentId: z.string().nullable().optional(),
      setupMinutes: z.number().int().min(0).max(1440).default(0),
      teardownMinutes: z.number().int().min(0).max(1440).default(0),
    })
    .parse(input);
  const { id, expectedVersion, ...values } = body;
  const targetDepartment =
    body.departmentId === null ? null : body.departmentId || context.departmentId;
  if (!can(context, "inventory.manage", undefined, targetDepartment || ""))
    throw new HttpError(
      403,
      "Keine Berechtigung für das gewählte Gewerk oder die hausweite Ressource.",
    );
  if (targetDepartment) {
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, targetDepartment))
      .limit(1);
    if (!department) throw new HttpError(400, "Das Gewerk gehört nicht zu diesem Theater.");
  }
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
    );
    if (id) {
      const [existing] = await tx
        .select()
        .from(venueResources)
        .where(eq(venueResources.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw new HttpError(404, "Ressource nicht gefunden.");
      if (!can(context, "inventory.manage", undefined, existing.departmentId || ""))
        throw new HttpError(403, "Keine Berechtigung für diese Ressource.");
      if (existing.version !== expectedVersion)
        throw new HttpError(409, "Die Ressource wurde inzwischen geändert.");
      const bookings = await tx
        .select()
        .from(resourceBookings)
        .where(
          and(
            eq(resourceBookings.resourceId, id),
            sql`${resourceBookings.endAt}>${new Date().toISOString()}`,
          ),
        );
      if (
        bookings.length &&
        (existing.setupMinutes !== values.setupMinutes ||
          existing.teardownMinutes !== values.teardownMinutes ||
          existing.departmentId !== targetDepartment)
      )
        throw new HttpError(
          409,
          "Für eine Änderung von Rüstzeiten oder Gewerk müssen bestehende Belegungen zuerst neu geplant werden.",
        );
      const edges = bookings
        .flatMap((b) => [
          { at: b.startAt.getTime(), delta: b.quantity },
          { at: b.endAt.getTime(), delta: -b.quantity },
        ])
        .sort((a, b) => a.at - b.at || a.delta - b.delta);
      let used = 0;
      for (const edge of edges) {
        used += edge.delta;
        if (used > values.capacity)
          throw new HttpError(
            409,
            "Die neue Kapazität reicht für bestehende Belegungen nicht aus.",
          );
      }
      return (
        await tx
          .update(venueResources)
          .set({ ...values, departmentId: targetDepartment, version: existing.version + 1 })
          .where(eq(venueResources.id, id))
          .returning()
      )[0];
    }
    return (
      await tx
        .insert(venueResources)
        .values({ ...values, departmentId: targetDepartment })
        .returning()
    )[0];
  });
  invalidateWorkspace(context.departmentId);
  return changedEntity(context, "VenueResourceChangedV1", result);
}
export async function reserveResource(
  context: Context,
  input: unknown,
  options: { activityId?: string } = {},
) {
  requirePermission(context, "inventory.reserve");
  const body = z
    .object({
      resourceId: z.string(),
      productionId: z.string().optional(),
      startAt: z.iso.datetime(),
      endAt: z.iso.datetime(),
      quantity: z.number().int().min(1).max(10000).default(1),
    })
    .parse(input);
  await assertProject(context, body.productionId);
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
    );
    const [resource] = await tx
      .select()
      .from(venueResources)
      .where(eq(venueResources.id, body.resourceId))
      .limit(1)
      .for("update");
    if (!resource) throw new HttpError(404, "Ressource nicht gefunden.");
    const blocks = await tx
      .select({ id: tradeItems.id })
      .from(tradeItems)
      .where(
        and(
          sql`${tradeItems.data}->>'resourceId'=${resource.id}`,
          sql`${tradeItems.status} not in ('done','archived','cancelled')`,
          sql`((${tradeItems.data}->>'blockResource'='true' and (${tradeItems.type}='incident' or ${tradeItems.data}->>'result'='failed')) or (${tradeItems.type}='asset' and ${tradeItems.data}->>'condition' in ('blocked','maintenance')))`,
        ),
      )
      .limit(1);
    if (blocks.length)
      throw new HttpError(
        409,
        "Die Ressource ist wegen einer offenen Störung oder fehlgeschlagenen Prüfung gesperrt.",
      );
    if (
      !can(
        context,
        "inventory.reserve",
        body.productionId,
        resource.departmentId || context.departmentId,
      )
    )
      throw new HttpError(403, "Keine Berechtigung für diese Ressource.");
    if (new Date(body.startAt) >= new Date(body.endAt))
      throw new HttpError(400, "Das Ende muss nach dem Beginn liegen.");
    const start = new Date(new Date(body.startAt).getTime() - resource.setupMinutes * 60000),
      end = new Date(new Date(body.endAt).getTime() + resource.teardownMinutes * 60000);
    const bookings = await tx
      .select()
      .from(resourceBookings)
      .where(
        and(
          eq(resourceBookings.resourceId, resource.id),
          sql`${resourceBookings.startAt}<${end.toISOString()}`,
          sql`${resourceBookings.endAt}>${start.toISOString()}`,
        ),
      );
    const edges = bookings
      .flatMap((b) => [
        { at: Math.max(start.getTime(), b.startAt.getTime()), delta: b.quantity },
        { at: Math.min(end.getTime(), b.endAt.getTime()), delta: -b.quantity },
      ])
      .sort((a, b) => a.at - b.at || a.delta - b.delta);
    let used = body.quantity;
    for (const edge of edges) {
      used += edge.delta;
      if (used > resource.capacity)
        throw new HttpError(409, "Die Ressource ist in diesem Zeitraum bereits belegt.");
    }
    if (body.quantity > resource.capacity)
      throw new HttpError(409, "Die Menge überschreitet die Kapazität.");
    const [saved] = await tx
      .insert(resourceBookings)
      .values({
        resourceId: resource.id,
        activityId: options.activityId || null,
        productionId: body.productionId || null,
        startAt: start,
        endAt: end,
        quantity: body.quantity,
        createdBy: context.user.id,
      })
      .returning();
    await emit(tx, context, "ResourceReservedV1", {
      recordId: saved.id,
      productionId: body.productionId || "",
    });
    return saved;
  });
  scheduleEvents();
  invalidateWorkspace(context.departmentId);
  return result;
}
export async function scheduleAction(context: Context, input: unknown) {
  const body = z
    .object({
      action: z.enum([
        "work",
        "season",
        "production-metadata",
        "run",
        "performance",
        "schedule-draft",
        "schedule-approve",
        "schedule-publish",
        "cancel-booking",
      ]),
      id: z.string().optional(),
      expectedVersion: z.number().int().optional(),
      data: z.record(z.string(), z.unknown()).default({}),
    })
    .parse(input);
  const data = body.data;
  if (body.action === "cancel-booking") {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
    );
    const [booking] = await db
      .select()
      .from(resourceBookings)
      .where(eq(resourceBookings.id, body.id || ""))
      .limit(1);
    if (!booking) throw new HttpError(404, "Reservierung nicht gefunden.");
    if (booking.activityId)
      throw new HttpError(
        409,
        "Ändere den zugehörigen Kalendertermin, um diese Belegung anzupassen.",
      );
    if (body.expectedVersion !== booking.version)
      throw new HttpError(409, "Die Reservierung wurde inzwischen geändert.");
    const [resource] = await db
      .select()
      .from(venueResources)
      .where(eq(venueResources.id, booking.resourceId))
      .limit(1);
    if (!resource) throw new HttpError(404, "Ressource nicht gefunden.");
    await assertProject(context, booking.productionId);
    if (
      booking.createdBy !== context.user.id &&
      !can(
        context,
        "inventory.manage",
        booking.productionId || "",
        resource.departmentId || context.departmentId,
      )
    )
      throw new HttpError(403, "Keine Berechtigung für diese Reservierung.");
    await db.delete(resourceBookings).where(eq(resourceBookings.id, booking.id));
    await changedEntity(
      context,
      "ResourceReservationCancelledV1",
      booking,
      booking.productionId || undefined,
    );
    return { ok: true };
  }
  if (body.action === "work") {
    requirePermission(context, "production.manage");
    const parsed = z
      .object({ title: z.string().min(1).max(200), author: z.string().max(150).optional() })
      .parse(data);
    return changedEntity(
      context,
      "TheaterWorkCreatedV1",
      (await db.insert(theaterWorks).values(parsed).returning())[0],
    );
  }
  if (body.action === "season") {
    requirePermission(context, "production.manage");
    const parsed = z
      .object({ label: z.string().min(1).max(100), start: z.iso.date(), end: z.iso.date() })
      .parse(data);
    if (parsed.end < parsed.start) throw new HttpError(400, "Ungültige Spielzeit.");
    const saved = (
      await db
        .insert(theaterSeasons)
        .values({
          label: parsed.label,
          startAt: new Date(parsed.start),
          endAt: new Date(parsed.end),
        })
        .returning()
    )[0];
    return changedEntity(context, "TheaterSeasonCreatedV1", saved);
  }
  if (body.action === "production-metadata") {
    requirePermission(context, "production.manage", String(data.recordId));
    const parsed = z
      .object({
        recordId: z.string(),
        workId: z.string().optional(),
        seasonId: z.string().optional(),
        stage: z.enum([
          "concept",
          "development",
          "workshop",
          "rehearsal",
          "technical-rehearsal",
          "dress-rehearsal",
          "performance",
          "revival",
          "archived",
        ]),
      })
      .parse(data);
    await assertProject(context, parsed.recordId);
    await assertStageReady(context, parsed.recordId, parsed.stage);
    const [existingMetadata] = await db
      .select()
      .from(theaterProductions)
      .where(eq(theaterProductions.recordId, parsed.recordId))
      .limit(1)
      .for("update");
    if (existingMetadata && existingMetadata.version !== body.expectedVersion)
      throw new HttpError(409, "Der Produktionsstand wurde inzwischen geändert.");
    const workId =
      parsed.workId === undefined ? existingMetadata?.workId || null : parsed.workId || null;
    const seasonId =
      parsed.seasonId === undefined ? existingMetadata?.seasonId || null : parsed.seasonId || null;
    for (const [table, id] of [
      [theaterWorks, workId],
      [theaterSeasons, seasonId],
    ] as const) {
      if (
        id &&
        !(await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1)).length
      )
        throw new HttpError(400, "Werk oder Spielzeit gehört nicht zu diesem Theater.");
    }
    const saved = (
      await db
        .insert(theaterProductions)
        .values({ ...parsed, workId, seasonId })
        .onConflictDoUpdate({
          target: [theaterProductions.organizationId, theaterProductions.recordId],
          set: {
            stage: parsed.stage,
            workId,
            seasonId,
            version: sql`${theaterProductions.version}+1`,
          },
        })
        .returning()
    )[0];
    return changedEntity(context, "ProductionMetadataChangedV1", saved, parsed.recordId);
  }
  requirePermission(context, "schedule.manage", String(data.productionId || ""));
  if (body.action === "run") {
    const parsed = z
      .object({
        productionId: z.string(),
        label: z.string().min(1).max(100),
        start: z.iso.date(),
        end: z.iso.date(),
      })
      .parse(data);
    if (parsed.end < parsed.start)
      throw new HttpError(400, "Ungültiger Zeitraum der Vorstellungsserie.");
    await assertProject(context, parsed.productionId);
    const saved = (
      await db
        .insert(productionRuns)
        .values({
          productionId: parsed.productionId,
          label: parsed.label,
          startAt: new Date(parsed.start),
          endAt: new Date(parsed.end),
        })
        .returning()
    )[0];
    return changedEntity(context, "ProductionRunCreatedV1", saved, parsed.productionId);
  }
  if (body.action === "performance") {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
    );
    const parsed = z
      .object({
        productionId: z.string(),
        runId: z.string().optional(),
        eventId: z.string().optional(),
        curtainAt: z.iso.datetime(),
        participantIds: z.array(z.string().max(100)).max(200).optional(),
        resourceId: z.string().optional(),
        pauseMinutes: z.number().int().min(0).max(480).default(0),
        durationMinutes: z.number().int().min(1).max(480).default(120),
        status: z.enum(["planned", "confirmed", "cancelled"]).default("planned"),
      })
      .parse(data);
    await assertProject(context, parsed.productionId);
    const [previous] = body.id
      ? await db
          .select()
          .from(performances)
          .where(eq(performances.id, body.id))
          .limit(1)
          .for("update")
      : [];
    if (body.id && !previous) throw new HttpError(404, "Vorstellung nicht gefunden.");
    if (previous) {
      await assertProject(context, previous.productionId);
      requirePermission(context, "schedule.manage", previous.productionId);
      if (previous.productionId !== parsed.productionId)
        throw new HttpError(400, "Die Produktion einer Vorstellung kann nicht geändert werden.");
      if (previous.version !== body.expectedVersion)
        throw new HttpError(409, "Die Vorstellung wurde inzwischen geändert.");
    }
    if (parsed.runId) {
      const [run] = await db
        .select()
        .from(productionRuns)
        .where(eq(productionRuns.id, parsed.runId))
        .limit(1);
      if (!run || run.productionId !== parsed.productionId)
        throw new HttpError(400, "Diese Vorstellungsserie gehört zu einer anderen Produktion.");
    }
    const production = await findRecord(context, parsed.productionId, "productions");
    const assignments = await db
      .select()
      .from(records)
      .where(and(eq(records.kind, "casting"), eq(records.productionId, parsed.productionId)));
    const actorIds = [
      ...new Set(assignments.map((a) => String(a.data.actorId || "")).filter(Boolean)),
    ];
    let eventId = previous?.eventId || parsed.eventId;
    const event = eventId ? await findRecord(context, eventId, "events") : undefined;
    if (event) {
      await assertRead(context, event);
      if (event.data.productionId !== parsed.productionId)
        throw new HttpError(400, "Der Termin gehört zu einer anderen Produktion.");
    }
    const categoryId =
      "category:" + context.organizationId + ":" + context.departmentId + ":performance";
    await db
      .insert(records)
      .values({
        id: categoryId,
        organizationId: context.organizationId,
        departmentId: context.departmentId,
        createdBy: context.user.id,
        kind: "calendarCategories",
        data: {
          key: "performance",
          name: "Vorstellung",
          color: "#43735a",
          allDay: false,
          blocksTime: false,
        },
      })
      .onConflictDoNothing();
    const { saveRecord } = await import("@/modules/records/service");
    const calendar = await saveRecord(
      context,
      "events",
      {
        ...(event?.data || {}),
        title: String(production.data.title) + " · Vorstellung",
        productionId: parsed.productionId,
        category: "performance",
        start: parsed.curtainAt,
        end: new Date(
          new Date(parsed.curtainAt).getTime() + parsed.durationMinutes * 60000,
        ).toISOString(),
        participantIds: parsed.participantIds || event?.data.participantIds || [],
        actorIds,
        resourceId: parsed.resourceId ?? event?.data.resourceId ?? "",
        pauseMinutes: parsed.pauseMinutes,
        blocksTime: true,
        cancelled: parsed.status === "cancelled",
        location: event?.data.location || "",
        recurrence: "none",
        exceptions: [],
        until: "",
        leaveId: "",
      },
      event?.id,
      event?.version,
    );
    eventId = calendar.id;
    const values = {
      productionId: parsed.productionId,
      runId: parsed.runId || null,
      eventId,
      curtainAt: new Date(parsed.curtainAt),
      status: parsed.status,
    };
    const [saved] = previous
      ? await db
          .update(performances)
          .set({ ...values, version: previous.version + 1 })
          .where(and(eq(performances.id, previous.id), eq(performances.version, previous.version)))
          .returning()
      : await db.insert(performances).values(values).returning();
    if (!saved) throw new HttpError(409, "Die Vorstellung wurde inzwischen geändert.");
    await emit(
      db as never,
      context,
      previous ? "PerformanceRescheduledV1" : "PerformanceCreatedV1",
      {
        recordId: saved.id,
        productionId: saved.productionId,
        curtainAt: parsed.curtainAt,
        version: saved.version,
      },
    );
    scheduleEvents();
    invalidateWorkspace(context.departmentId);
    return saved;
  }
  if (body.action.startsWith("schedule-") && !can(context, "schedule.manage", undefined, ""))
    throw new HttpError(403, "Die Theaterplanung benötigt eine theaterweite Dispositionsrolle.");
  if (body.action === "schedule-draft") {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":schedule"}))`,
    );
    const versions = await db
      .select()
      .from(scheduleVersions)
      .orderBy(desc(scheduleVersions.version))
      .limit(1);
    const snapshot = await planningSnapshot(data);
    return (
      await db
        .insert(scheduleVersions)
        .values({ version: (versions[0]?.version || 0) + 1, state: "draft", snapshot })
        .returning()
    )[0];
  }
  if (body.action === "schedule-approve" || body.action === "schedule-publish") {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":schedule"}))`,
    );
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
    );
    const publish = body.action === "schedule-publish";
    if (publish) requirePermission(context, "schedule.publish");
    const [version] = await db
      .select()
      .from(scheduleVersions)
      .where(eq(scheduleVersions.id, body.id || ""))
      .limit(1)
      .for("update");
    if (!version || version.state !== (publish ? "approved" : "draft"))
      throw new HttpError(409, "Diese Planversion kann nicht freigegeben werden.");
    const current = await planningSnapshot((version.snapshot.window || {}) as PlanningWindow);
    if (snapshotIdentity(current) !== snapshotIdentity(version.snapshot))
      throw new HttpError(
        409,
        "Die Planung hat sich seit diesem Entwurf geändert. Erstelle eine aktuelle Planversion.",
      );
    const [saved] = await db
      .update(scheduleVersions)
      .set({
        state: publish ? "published" : "approved",
        ...(publish ? { publishedAt: new Date(), publishedBy: context.user.id } : {}),
      })
      .where(eq(scheduleVersions.id, version.id))
      .returning();
    if (publish) {
      await emit(db as never, context, "SchedulePublishedV1", {
        recordId: version.id,
        version: version.version,
        userIds: [],
        title: "Neuer veröffentlichter Theaterplan",
        link: "/?module=theater",
      });
      scheduleEvents();
    }
    return saved;
  }
  throw new HttpError(400, "Unbekannter Arbeitsablauf.");
}
