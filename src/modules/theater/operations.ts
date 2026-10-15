import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/platform/db";
import {
  tradeItems,
  tradeItemHistory,
  records,
  tenantSettings,
  resourceBookings,
} from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { assertProject } from "@/modules/records/repository";
import { tradeReadable, saveTradeItem } from "./service";
import { moduleById } from "./registry";
import { approvalCurrent } from "./approval";
import { shiftedSeriesDates } from "@/shared/theater-time";
import { createCollaboration } from "./collaborations";
import { emit, auditChange, scheduleEvents } from "@/platform/events";
import { invalidateWorkspace } from "@/modules/records/workspace";
import { applyFachEffects } from "./fach-logic";

export async function readableTrade(context: Context, id: string, lock = false) {
  const query = db.select().from(tradeItems).where(eq(tradeItems.id, id)).limit(1);
  const [item] = await (lock ? query.for("update") : query);
  if (!item || !tradeReadable(context, item))
    throw new HttpError(404, "Der Fachstand ist nicht zugänglich.");
  await assertProject(context, item.productionId);
  return item;
}
export async function tradeHistory(context: Context, id: string, before?: number) {
  const item = await readableTrade(context, id);
  const history = await db
    .select()
    .from(tradeItemHistory)
    .where(
      and(
        eq(tradeItemHistory.itemId, id),
        before ? sql`${tradeItemHistory.version}<${before}` : undefined,
      ),
    )
    .orderBy(desc(tradeItemHistory.version))
    .limit(51);
  const files = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.kind, "files"),
        sql`${records.data}->>'recordId'=${"trade-files:" + id}`,
        sql`${records.data}->>'pendingDeletionOperation' is null`,
      ),
    );
  return {
    item: { ...item, approvalVerified: await approvalCurrent(item, db) },
    history: history.slice(0, 50),
    nextBefore: history.length > 50 ? history[49].version : null,
    files: files.map((file) => ({
      ...file,
      data: Object.fromEntries(
        Object.entries(file.data).filter(([key]) =>
          ["name", "size", "mimeType", "sha256", "recordId"].includes(key),
        ),
      ),
    })),
  };
}
export async function lifecycle(context: Context, input: unknown) {
  const body = z
    .object({
      id: z.string(),
      expectedVersion: z.number().int().positive(),
      action: z.enum(["archive", "cancel", "restore", "successor"]),
      reason: z.string().trim().min(3).max(2000),
    })
    .parse(input);
  const item = await readableTrade(context, body.id, true),
    feature = moduleById(item.moduleId)?.features.find((f) => f.id === item.type);
  if (
    !feature ||
    item.type === "collaboration" ||
    item.type === "workspace" ||
    item.type === "stock-movement"
  )
    throw new HttpError(409, "Verwende für diesen Nachweis den eigenen Arbeitsablauf.");
  if (
    !can(context, feature.permission, item.productionId || "", item.departmentId) ||
    (item.createdBy !== context.user.id &&
      !can(
        context,
        feature.private ? feature.permission : "document.manage",
        item.productionId || "",
        item.departmentId,
      ))
  )
    throw new HttpError(403, "Keine Verwaltungsberechtigung für diesen Fachstand.");
  if (item.version !== body.expectedVersion)
    throw new HttpError(409, "Der Fachstand wurde inzwischen geändert.");
  if (item.type === "loan" && !item.data.returnedAt && ["archive", "cancel"].includes(body.action))
    throw new HttpError(
      409,
      "Buche zuerst die Rückgabe. Eine offene Leihe darf nicht aus dem aktiven Bestand verschwinden.",
    );
  if (body.action === "successor") {
    const data = Object.fromEntries(
      feature.fields
        .filter((f) => !f.managed)
        .filter((f) => item.data[f.key] !== undefined)
        .map((f) => [f.key, item.data[f.key]]),
    );
    if (feature.fields.some((f) => f.key === "sourceItemId")) data.sourceItemId = item.id;
    const successor = await saveTradeItem(context, {
      moduleId: item.moduleId,
      type: item.type,
      title: item.title + " · Nachfolge",
      productionId: item.productionId || undefined,
      status: "draft",
      data,
    });
    return { item: successor, sourceId: item.id };
  }
  if (
    ["budget", "purchase", "procurement"].includes(item.type) &&
    ["published", "approved", "done"].includes(item.status)
  )
    throw new HttpError(
      409,
      "Verbindliche Finanznachweise bleiben erhalten. Lege einen Nachfolgestand an.",
    );
  if (body.action === "restore" && !["archived", "cancelled"].includes(item.status))
    throw new HttpError(409, "Dieser Fachstand ist bereits aktiv.");
  if (body.action !== "restore" && ["archived", "cancelled"].includes(item.status))
    throw new HttpError(409, "Dieser Fachstand wurde bereits abgeschlossen.");
  if (item.data.eventId) {
    const { findRecord } = await import("@/modules/records/repository"),
      { saveRecord } = await import("@/modules/records/service");
    const event = await findRecord(context, String(item.data.eventId), "events");
    await saveRecord(
      context,
      "events",
      { ...event.data, cancelled: body.action !== "restore" },
      event.id,
      event.version,
    );
  }
  const status =
    body.action === "archive" ? "archived" : body.action === "cancel" ? "cancelled" : "draft";
  const data = {
    ...item.data,
    _lifecycle: {
      action: body.action,
      reason: body.reason,
      by: context.user.id,
      at: new Date().toISOString(),
      previousStatus: item.status,
    },
  };
  delete (data as Record<string, unknown>)._approval;
  const [saved] = await db
    .update(tradeItems)
    .set({ status, data, version: item.version + 1, updatedAt: new Date() })
    .where(eq(tradeItems.id, item.id))
    .returning();
  await db.insert(tradeItemHistory).values({
    organizationId: context.organizationId,
    itemId: item.id,
    version: saved.version,
    createdBy: context.user.id,
    data: { title: item.title, status, data, action: body.action, reason: body.reason },
  });
  await emit(db as never, context, "TradeItemChangedV1", {
    recordId: item.id,
    version: saved.version,
    moduleId: item.moduleId,
    productionId: item.productionId || "",
  });
  await auditChange(db as never, context, "trade-item." + body.action, item.id);
  if (["maintenance-series", "care-cycle", "wig-care"].includes(saved.type))
    await applyFachEffects(context, saved, db as never, item);
  scheduleEvents();
  invalidateWorkspace(item.departmentId);
  return saved;
}
export async function followups(context: Context, input: unknown) {
  const body = z
    .object({
      operationId: z.uuid(),
      id: z.string(),
      expectedVersion: z.number().int().positive(),
      targets: z.array(z.string()).min(1).max(21),
      brief: z.string().trim().min(3).max(10000),
      dueDate: z.iso.date().optional(),
    })
    .parse(input);
  const source = await readableTrade(context, body.id, true);
  if (source.version !== body.expectedVersion)
    throw new HttpError(409, "Der Bericht wurde inzwischen geändert.");
  const entries = [];
  for (const target of [...new Set(body.targets)]) {
    const { createHash } = await import("node:crypto");
    const hex = createHash("sha256")
      .update(body.operationId + target)
      .digest("hex");
    const id = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      "4" + hex.slice(13, 16),
      "8" + hex.slice(17, 20),
      hex.slice(20, 32),
    ].join("-");
    const entry = await createCollaboration(context, {
      id,
      title: "Änderungsauftrag: " + source.title,
      kind: "change",
      recipientDepartmentId: target,
      productionId: source.productionId || "",
      sourceItemId: source.id,
      brief: body.brief,
      ...(body.dueDate ? { dueDate: body.dueDate } : {}),
    });
    const taskId = "followup:" + id;
    const added = await db
      .insert(records)
      .values({
        id: taskId,
        organizationId: context.organizationId,
        departmentId: target,
        createdBy: context.user.id,
        productionId: source.productionId,
        kind: "tasks",
        data: {
          title: entry.title,
          description: body.brief,
          status: "todo",
          productionId: source.productionId,
          assigneeIds: [],
          due: body.dueDate || "",
          sourceReviewId: id,
          sourceItemId: source.id,
          sourceVersion: source.version,
        },
      })
      .onConflictDoNothing()
      .returning({ id: records.id });
    if (added.length)
      await emit(db as never, { ...context, departmentId: target }, "TaskCreatedV1", {
        recordId: taskId,
        version: 1,
        productionId: source.productionId || "",
      });
    entries.push({ reviewId: id, taskId, departmentId: target });
  }
  return { entries };
}
export async function readinessPolicy(context: Context, input: unknown) {
  const body = z
    .object({
      productionId: z.string(),
      expectedVersion: z.number().int().nonnegative().optional(),
      performanceId: z.string().optional(),
      required: z.array(z.string()).max(21),
      waivers: z
        .array(
          z.object({
            moduleId: z.string(),
            reason: z.string().trim().min(10).max(2000),
            expiresAt: z.iso.datetime(),
          }),
        )
        .max(21),
    })
    .parse(input);
  await assertProject(context, body.productionId);
  if (
    !can(context, "production.manage", body.productionId, "") &&
    !can(context, "readiness.manage", body.productionId, "")
  )
    throw new HttpError(403, "Keine Berechtigung für Bereitschaftsvorgaben.");
  if (body.waivers.length && !can(context, "readiness.manage", body.productionId, ""))
    throw new HttpError(403, "Ausnahmen benötigen eine zuständige Leitung.");
  if (
    body.required.some(
      (id) => !moduleById(id)?.features.some((feature) => feature.id === "readiness"),
    ) ||
    body.waivers.some(
      (w) => !body.required.includes(w.moduleId) || Date.parse(w.expiresAt) <= Date.now(),
    )
  )
    throw new HttpError(400, "Prüfe erforderliche Gewerke und die Ablaufdaten der Ausnahmen.");
  if (body.performanceId) {
    const { performances } = await import("@/platform/db/schema");
    const [show] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, body.performanceId))
      .limit(1);
    if (show?.productionId !== body.productionId)
      throw new HttpError(400, "Die Vorstellung gehört nicht zur Produktion.");
  }
  const [settings] = await db.select().from(tenantSettings).limit(1).for("update");
  const policies = (settings.settings.readinessPolicies || {}) as Record<string, unknown>;
  const key = body.performanceId || body.productionId;
  const currentVersion = Number((policies[key] as { version?: number })?.version || 0);
  if (currentVersion && body.expectedVersion !== currentVersion)
    throw new HttpError(
      409,
      "Die Bereitschaftsvorgaben wurden inzwischen geändert. Lade den aktuellen Stand.",
    );
  const policy = {
    ...body,
    waivers: body.waivers.map((w) => ({
      ...w,
      approvedBy: context.user.id,
      approvedAt: new Date().toISOString(),
    })),
    version: Number((policies[key] as { version?: number })?.version || 0) + 1,
  };
  await db
    .update(tenantSettings)
    .set({ settings: { ...settings.settings, readinessPolicies: { ...policies, [key]: policy } } })
    .where(eq(tenantSettings.organizationId, context.organizationId));
  await auditChange(db as never, context, "readiness.policy", body.productionId);
  return policy;
}
export async function readinessState(
  context: Context,
  productionId: string,
  performanceId?: string,
) {
  const { productionReadiness } = await import("./readiness");
  const states = await productionReadiness(context, productionId, db, performanceId);
  if (performanceId) {
    const { performances } = await import("@/platform/db/schema");
    const [show] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, performanceId))
      .limit(1);
    if (show?.productionId !== productionId)
      throw new HttpError(400, "Vorstellung und Produktion passen nicht zusammen.");
  }
  const [settings] = await db.select().from(tenantSettings).limit(1);
  const policies = (settings.settings.readinessPolicies || {}) as Record<string, unknown>;
  return { states, policy: policies[performanceId || ""] || policies[productionId] || null };
}
export async function batchPlan(
  context: Context,
  input: unknown,
  apply = false,
  internal = false,
): Promise<Record<string, unknown>> {
  const body = z
    .object({
      operationId: z.uuid(),
      changes: z
        .array(
          z.object({
            id: z.string(),
            expectedVersion: z.number().int().positive(),
            start: z.iso.datetime(),
            end: z.iso.datetime(),
          }),
        )
        .min(1)
        .max(50),
    })
    .parse(input);
  if (new Set(body.changes.map((c) => c.id)).size !== body.changes.length)
    throw new HttpError(400, "Ein Termin darf in einer Sammeländerung nur einmal vorkommen.");
  const { findRecord } = await import("@/modules/records/repository"),
    { saveRecord, assertRead } = await import("@/modules/records/service");
  if (apply && !internal) {
    for (const change of body.changes) {
      const event = await findRecord(context, change.id, "events");
      await assertRead(context, event);
      if (!can(context, "schedule.manage", event.productionId || "", event.departmentId))
        throw new HttpError(403, "Keine aktuelle Berechtigung für diese Sammeländerung.");
    }
    const { repeatable } = await import("./integrations");
    return await repeatable(context, "batch:" + body.operationId, body, () =>
      batchPlan(context, body, true, true),
    );
  }
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
  );
  const results: Record<string, unknown>[] = [];
  // A nested transaction is rolled back after preview, including resource checks and history.
  class Preview extends Error {
    constructor(public result: unknown) {
      super("preview");
    }
  }
  try {
    await db.transaction(async (tx) => {
      const sources = [];
      for (const change of body.changes) {
        const item = await findRecord(context, change.id, "events", tx, true);
        await assertRead(context, item, tx);
        if (!can(context, "schedule.manage", item.productionId || "", item.departmentId))
          throw new HttpError(403, "Keine Berechtigung für einen Termin der Sammeländerung.");
        if (item.version !== change.expectedVersion)
          throw new HttpError(409, "Mindestens ein Termin wurde inzwischen geändert.");
        sources.push({ item, change });
      }
      // Temporarily cancel the old batch so swapping slots is checked against the final batch.
      for (const { item } of sources)
        await tx
          .update(records)
          .set({ data: { ...item.data, cancelled: true } })
          .where(eq(records.id, item.id));
      await tx.delete(resourceBookings).where(
        inArray(
          resourceBookings.activityId,
          sources.map((s) => s.item.id),
        ),
      );
      for (const { item, change } of sources) {
        const [configuration] = await tx.select().from(tenantSettings).limit(1);
        const saved = await saveRecord(
          { ...context, departmentId: item.departmentId },
          "events",
          {
            ...item.data,
            ...shiftedSeriesDates(item.data, change.start, configuration.timezone),
            start: change.start,
            end: change.end,
          },
          item.id,
          item.version,
          { transaction: tx },
        );
        results.push({
          id: item.id,
          before: { start: item.data.start, end: item.data.end },
          after: { start: change.start, end: change.end },
          version: saved.version,
        });
        const { performances } = await import("@/platform/db/schema");
        const shows = await tx
          .select()
          .from(performances)
          .where(eq(performances.eventId, item.id))
          .for("update");
        for (const show of shows) {
          const [updated] = await tx
            .update(performances)
            .set({ curtainAt: new Date(change.start), version: show.version + 1 })
            .where(eq(performances.id, show.id))
            .returning();
          await emit(tx, context, "PerformanceRescheduledV1", {
            recordId: updated.id,
            productionId: updated.productionId,
            curtainAt: change.start,
            version: updated.version,
          });
        }
        const linked = await tx
          .select()
          .from(tradeItems)
          .where(sql`${tradeItems.data}->>'eventId'=${item.id}`)
          .for("update");
        for (const trade of linked) {
          const data = { ...trade.data, start: change.start, end: change.end } as Record<
            string,
            unknown
          >;
          delete data._approval;
          const [updated] = await tx
            .update(tradeItems)
            .set({ data, version: trade.version + 1, updatedAt: new Date() })
            .where(eq(tradeItems.id, trade.id))
            .returning();
          await tx.insert(tradeItemHistory).values({
            organizationId: context.organizationId,
            itemId: trade.id,
            version: updated.version,
            createdBy: context.user.id,
            data: { title: trade.title, status: trade.status, data, action: "batch-reschedule" },
          });
          await emit(tx, context, "TradeItemChangedV1", {
            recordId: trade.id,
            version: updated.version,
            moduleId: trade.moduleId,
            productionId: trade.productionId || "",
          });
        }
      }
      if (!apply) throw new Preview(results);
    });
  } catch (error) {
    if (error instanceof Preview) return { preview: error.result };
    throw error;
  }
  scheduleEvents();
  return { changed: results };
}
