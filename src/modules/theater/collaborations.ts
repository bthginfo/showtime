import { createHash } from "node:crypto";
import { and, eq, asc, desc, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Transaction } from "@/platform/db";
import { tradeItems, tradeItemHistory, records, moduleActivations } from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { emit, auditChange, scheduleEvents } from "@/platform/events";
import { acquireWorkflowLock } from "@/modules/workflows/locks";
import { assertProject, serialize } from "@/modules/records/repository";
import { readReferences } from "@/modules/records/pages";
import { invalidateWorkspace } from "@/modules/records/workspace";
import { moduleById } from "./registry";
import { approvalContentHash, sourceReviewSnapshot } from "./approval";
import {
  collaborationSide,
  collaborationReadable,
  collaborationApprover,
  collaborationOpen,
  collaborationContributor,
  collaborationPermission,
} from "@/shared/collaboration";
import type { CollaborationEntry } from "@/shared/collaboration";

const createInput = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(200),
    kind: z.enum(["feedback", "approval", "handover", "change"]),
    recipientDepartmentId: z.string().min(1).max(100),
    productionId: z.string().min(1).max(100),
    brief: z.string().trim().min(1).max(10000),
    acceptance: z.string().trim().max(3000).default(""),
    dueDate: z.iso.date().optional(),
    sourceItemId: z.string().max(100).optional(),
  })
  .strict();
const replyInput = z
  .object({
    id: z.string().min(1).max(100),
    expectedVersion: z.number().int().positive(),
    action: z.enum(["comment", "request-changes", "approve", "acknowledge", "revise", "cancel"]),
    message: z.string().trim().min(1).max(10000),
    brief: z.string().trim().min(1).max(10000).optional(),
    refreshSource: z.boolean().optional(),
  })
  .strict();
export const collaborationSubject = (context: Context) => ({
  ...context.user,
  grants: context.grants,
  activeDepartmentIds: context.activeDepartmentIds,
});
export function collaborationEntry(
  context: Context,
  row: typeof tradeItems.$inferSelect,
): CollaborationEntry {
  const subject = collaborationSubject(context),
    open = collaborationOpen(row.status);
  return {
    id: row.id,
    title: row.title,
    departmentId: row.departmentId,
    createdBy: row.createdBy,
    productionId: row.productionId,
    data: row.data,
    status: row.status as CollaborationEntry["status"],
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    canComment: open && collaborationPermission(subject, row, "collaboration.comment"),
    canApprove: open && collaborationApprover(subject, row),
    canRespond:
      open &&
      collaborationSide(subject, row, "recipient") &&
      context.user.id !== row.createdBy &&
      collaborationPermission(subject, row, "collaboration.respond"),
    canRevise:
      open &&
      row.createdBy === context.user.id &&
      collaborationSide(subject, row, "sender") &&
      collaborationPermission(subject, row, "collaboration.create"),
    canAttach: open && collaborationContributor(subject, row),
  };
}
export async function assertCollaborationRead(
  context: Context,
  id: string,
  tx: Transaction | typeof db = db,
) {
  const [row] = await tx
    .select()
    .from(tradeItems)
    .where(and(eq(tradeItems.id, id), eq(tradeItems.type, "collaboration")))
    .limit(1);
  if (!row || !collaborationReadable(collaborationSubject(context), row))
    throw new HttpError(404, "Diese Abstimmung ist nicht zugänglich.");
  await assertProject(context, row.productionId, tx);
  return row;
}
export async function collaborationList(context: Context, productionId?: string, offset = 0) {
  if (productionId) await assertProject(context, productionId);
  const refs = await readReferences(context),
    subject = collaborationSubject(context);
  const page = await db
    .select()
    .from(tradeItems)
    .where(
      and(
        eq(tradeItems.type, "collaboration"),
        productionId ? eq(tradeItems.productionId, productionId) : undefined,
      ),
    )
    .orderBy(desc(tradeItems.updatedAt), desc(tradeItems.id))
    .limit(201)
    .offset(offset);
  return {
    entries: page
      .slice(0, 200)
      .filter(
        (row) => collaborationReadable(subject, row) && refs.projectIds.has(row.productionId || ""),
      )
      .map((row) => collaborationEntry(context, row)),
    nextOffset: page.length > 200 ? offset + 200 : null,
  };
}
export async function collaborationDetail(context: Context, id: string, afterVersion = 0) {
  const row = await assertCollaborationRead(context, id);
  const history = await db
    .select()
    .from(tradeItemHistory)
    .where(and(eq(tradeItemHistory.itemId, id), gt(tradeItemHistory.version, afterVersion)))
    .orderBy(asc(tradeItemHistory.version))
    .limit(51);
  const [parent] = await db
    .select()
    .from(records)
    .where(and(eq(records.id, id), eq(records.kind, "handovers")))
    .limit(1);
  if (!parent) throw new HttpError(404, "Die Übergabe ist nicht mehr verfügbar.");
  const files = await db
    .select()
    .from(records)
    .where(and(eq(records.kind, "files"), sql`${records.data}->>'recordId'=${id}`))
    .orderBy(asc(records.createdAt));
  return {
    entry: collaborationEntry(context, row),
    parent: serialize(parent),
    files: files.filter((file) => !file.data.pendingDeletionOperation).map(serialize),
    replies: history.slice(0, 50).map((reply) => ({
      version: reply.version,
      action: String(reply.data.action || "comment"),
      message: String(reply.data.message || ""),
      author: String(reply.data.author || "Teammitglied"),
      createdAt: reply.createdAt.toISOString(),
      revision: Number(reply.data.revision || 1),
    })),
    nextVersion: history.length > 50 ? history[49].version : null,
  };
}
async function notify(context: Context, row: typeof tradeItems.$inferSelect, tx: Transaction) {
  await emit(tx, context, "TradeCollaborationChangedV1", {
    recordId: row.id,
    version: row.version,
    productionId: row.productionId,
  });
  await auditChange(tx, context, "collaboration.updated", row.id);
  invalidateWorkspace(row.departmentId);
  invalidateWorkspace(String(row.data.recipientDepartmentId));
  scheduleEvents();
}
async function copySourceAttachments(
  context: Context,
  reviewId: string,
  sourceId: string,
  sourceVersion: number,
  revision: number,
  tx: Transaction,
) {
  const files = await tx
    .select()
    .from(records)
    .where(
      and(
        eq(records.kind, "files"),
        sql`${records.data}->>'recordId'=${"trade-files:" + sourceId}`,
        sql`${records.data}->>'pendingDeletionOperation' is null`,
      ),
    )
    .limit(101);
  if (files.length > 100)
    throw new HttpError(
      413,
      "Wähle einen Fachstand mit höchstens 100 Anlagen für eine Abstimmung.",
    );
  for (const file of files)
    await tx
      .insert(records)
      .values({
        id: `review-file:${reviewId}:${revision}:${file.id}`,
        organizationId: context.organizationId,
        departmentId: context.departmentId,
        productionId: file.productionId,
        createdBy: context.user.id,
        kind: "files",
        data: {
          ...file.data,
          recordId: reviewId,
          recordKind: "handovers",
          linkedCopySourceId: file.id,
          sourceVersion,
          reviewRevision: revision,
        },
      })
      .onConflictDoNothing();
}
/** Uploads change the review version, so a decision cannot silently approve unseen attachments. */
export async function collaborationAttachmentChanged(
  context: Context,
  id: string,
  tx: Transaction,
) {
  const current = await assertCollaborationRead(context, id, tx);
  if (!collaborationOpen(current.status))
    throw new HttpError(409, "Die Abstimmung wurde bereits abgeschlossen.");
  const [row] = await tx
    .update(tradeItems)
    .set({ version: current.version + 1, updatedAt: new Date() })
    .where(and(eq(tradeItems.id, id), eq(tradeItems.version, current.version)))
    .returning();
  if (!row) throw new HttpError(409, "Die Abstimmung wurde inzwischen geändert.");
  await tx.insert(tradeItemHistory).values({
    organizationId: context.organizationId,
    itemId: id,
    version: row.version,
    createdBy: context.user.id,
    data: {
      action: "attachment",
      message: "Anlagen wurden aktualisiert. Bitte prüfe den neuen Stand.",
      author: context.user.name,
      revision: Number(row.data.revision || 1),
    },
  });
  await notify(context, row, tx);
}
export async function createCollaboration(context: Context, input: unknown) {
  const body = createInput.parse(input);
  if (!can(context, "collaboration.create", body.productionId))
    throw new HttpError(403, "Du kannst hier keine Abstimmung anlegen.");
  await assertProject(context, body.productionId);
  if (body.recipientDepartmentId === context.departmentId)
    throw new HttpError(400, "Wähle ein anderes Gewerk als Empfänger.");
  const activations = await db
    .select()
    .from(moduleActivations)
    .where(eq(moduleActivations.enabled, true));
  const sender = activations.find((module) => module.config.departmentId === context.departmentId);
  if (
    !sender ||
    !activations.some((module) => module.config.departmentId === body.recipientDepartmentId)
  )
    throw new HttpError(400, "Das ausgewählte Gewerk ist nicht aktiv.");
  if (body.sourceItemId) {
    const [source] = await db
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, body.sourceItemId))
      .limit(1);
    const feature =
      source && moduleById(source.moduleId)?.features.find((feature) => feature.id === source.type);
    if (
      !source ||
      !feature ||
      feature.private ||
      source.departmentId !== context.departmentId ||
      source.productionId !== body.productionId
    )
      throw new HttpError(
        403,
        "Verknüpfe einen Facheintrag deines Gewerks. Geschützte Daten bleiben separat.",
      );
  }
  const creationHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return db.transaction(async (tx) => {
    await acquireWorkflowLock(context, "handovers", tx);
    const [existing] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, body.id))
      .limit(1);
    if (existing) {
      if (existing.createdBy !== context.user.id || existing.data.creationHash !== creationHash)
        throw new HttpError(409, "Diese Anfrage wurde bereits mit anderen Angaben gespeichert.");
      await assertCollaborationRead(context, existing.id, tx);
      return collaborationEntry(context, existing);
    }
    const [source] = body.sourceItemId
      ? await tx
          .select()
          .from(tradeItems)
          .where(eq(tradeItems.id, body.sourceItemId))
          .limit(1)
          .for("update")
      : [];
    if (
      body.sourceItemId &&
      (!source ||
        source.departmentId !== context.departmentId ||
        source.productionId !== body.productionId)
    )
      throw new HttpError(409, "Der verknüpfte Fachstand ist nicht mehr verfügbar.");
    const data = {
      recipientDepartmentId: body.recipientDepartmentId,
      kind: body.kind,
      brief: body.brief,
      acceptance: body.acceptance,
      dueDate: body.dueDate || "",
      sourceItemId: body.sourceItemId || "",
      sourceVersion: source?.version || null,
      sourceHash: source ? approvalContentHash(source) : "",
      sourceTitle: source?.title || "",
      sourceSnapshot: source ? sourceReviewSnapshot(source) : null,
      revision: 1,
      creationHash,
    };
    const [row] = await tx
      .insert(tradeItems)
      .values({
        id: body.id,
        organizationId: context.organizationId,
        departmentId: context.departmentId,
        moduleId: sender.moduleId,
        type: "collaboration",
        productionId: body.productionId,
        title: body.title,
        status: "review",
        data,
        createdBy: context.user.id,
      })
      .returning();
    await tx.insert(records).values({
      id: row.id,
      organizationId: context.organizationId,
      departmentId: context.departmentId,
      productionId: body.productionId,
      kind: "handovers",
      createdBy: context.user.id,
      data: {
        title: body.title,
        productionId: body.productionId,
        collaborationId: row.id,
        recipientDepartmentId: body.recipientDepartmentId,
        collaborationState: row.status,
      },
    });
    if (source) await copySourceAttachments(context, row.id, source.id, source.version, 1, tx);
    await tx.insert(tradeItemHistory).values({
      organizationId: context.organizationId,
      itemId: row.id,
      version: 1,
      createdBy: context.user.id,
      data: { action: "created", message: body.brief, author: context.user.name, revision: 1 },
    });
    await notify(context, row, tx);
    return collaborationEntry(context, row);
  });
}
export async function replyCollaboration(context: Context, input: unknown) {
  const body = replyInput.parse(input);
  return db.transaction(async (tx) => {
    await acquireWorkflowLock(context, "handovers", tx);
    const current = await assertCollaborationRead(context, body.id, tx);
    if (current.version !== body.expectedVersion)
      throw new HttpError(
        409,
        "Es gibt eine neue Rückmeldung. Aktualisiere die Abstimmung; dein Text bleibt erhalten.",
      );
    const entry = collaborationEntry(context, current);
    if (!collaborationOpen(current.status))
      throw new HttpError(
        409,
        "Diese Abstimmung ist abgeschlossen. Lege bei neuen Änderungen eine neue Anfrage an.",
      );
    if (body.action === "comment" && !entry.canComment)
      throw new HttpError(403, "Du kannst diese Abstimmung lesen, aber nicht kommentieren.");
    if (body.action === "approve" && (!entry.canApprove || current.data.kind !== "approval"))
      throw new HttpError(
        403,
        "Die Freigabe übernimmt eine andere Teamleitung des empfangenden Gewerks.",
      );
    if (["request-changes", "acknowledge"].includes(body.action) && !entry.canRespond)
      throw new HttpError(403, "Diese Rückmeldung übernimmt das empfangende Gewerk.");
    if (body.action === "acknowledge" && current.data.kind === "approval")
      throw new HttpError(
        400,
        "Für diese Anfrage ist eine Freigabe durch eine Teamleitung erforderlich.",
      );
    if (["revise", "cancel"].includes(body.action) && !entry.canRevise)
      throw new HttpError(
        403,
        "Nur die erstellende Person kann die Anfrage überarbeiten oder zurückziehen.",
      );
    if (body.action === "revise" && !body.brief)
      throw new HttpError(400, "Ergänze den überarbeiteten Arbeitsauftrag.");
    const refreshed: Record<string, unknown> = {};
    if (body.action === "revise" && body.refreshSource && current.data.sourceItemId) {
      const [source] = await tx
        .select()
        .from(tradeItems)
        .where(eq(tradeItems.id, String(current.data.sourceItemId)))
        .limit(1)
        .for("update");
      const feature =
        source &&
        moduleById(source.moduleId)?.features.find((feature) => feature.id === source.type);
      if (
        !source ||
        !feature ||
        feature.private ||
        source.departmentId !== context.departmentId ||
        source.productionId !== current.productionId
      )
        throw new HttpError(
          403,
          "Der Fachstand kann hier nicht erneut zur Prüfung übergeben werden.",
        );
      Object.assign(refreshed, {
        sourceVersion: source.version,
        sourceHash: approvalContentHash(source),
        sourceTitle: source.title,
        sourceSnapshot: sourceReviewSnapshot(source),
      });
      await copySourceAttachments(
        context,
        current.id,
        source.id,
        source.version,
        Number(current.data.revision || 1) + 1,
        tx,
      );
    }
    if (body.action === "approve" && current.data.sourceItemId) {
      const [source] = await tx
        .select()
        .from(tradeItems)
        .where(eq(tradeItems.id, String(current.data.sourceItemId)))
        .limit(1)
        .for("update");
      if (
        !source ||
        source.version !== current.data.sourceVersion ||
        approvalContentHash(source) !== current.data.sourceHash
      )
        throw new HttpError(
          409,
          "Der Fachstand wurde seit der Anfrage geändert. Lass die neue Fassung erneut prüfen.",
        );
      const feature = moduleById(source.moduleId)?.features.find(
        (feature) => feature.id === source.type,
      );
      const references = (source.data._referenceVersions || {}) as Record<string, number>;
      for (const [id, version] of Object.entries(references)) {
        const [ref] = await tx.select().from(tradeItems).where(eq(tradeItems.id, id)).limit(1);
        if (!ref || ref.version !== version || ["archived", "cancelled"].includes(ref.status))
          throw new HttpError(
            409,
            "Ein verknüpfter Fachstand wurde geändert. Aktualisiere die Quelle vor der Freigabe.",
          );
      }
      const managed = feature?.fields.find((field) => field.managed === "approval");
      const approvedData = {
        ...source.data,
        ...(managed ? { [managed.key]: managed.type === "checkbox" ? true : "approved" } : {}),
        _approval: {
          contentHash: current.data.sourceHash,
          reviewId: current.id,
          approvedBy: context.user.id,
          approvedAt: new Date().toISOString(),
          sourceVersion: source.version,
        },
      };
      const [approved] = await tx
        .update(tradeItems)
        .set({ data: approvedData, version: source.version + 1, updatedAt: new Date() })
        .where(and(eq(tradeItems.id, source.id), eq(tradeItems.version, source.version)))
        .returning();
      if (!approved) throw new HttpError(409, "Die geprüfte Fassung wurde inzwischen verändert.");
      await tx.insert(tradeItemHistory).values({
        organizationId: context.organizationId,
        itemId: source.id,
        version: approved.version,
        createdBy: context.user.id,
        data: {
          title: approved.title,
          status: approved.status,
          data: approvedData,
          action: "formal-approval",
          reviewId: current.id,
        },
      });
      await emit(tx, context, "TradeItemChangedV1", {
        recordId: source.id,
        version: approved.version,
        moduleId: source.moduleId,
        productionId: source.productionId || "",
      });
      await auditChange(tx, context, "trade-item.approved", source.id);
    }
    const status =
      body.action === "approve"
        ? "approved"
        : body.action === "acknowledge"
          ? "acknowledged"
          : body.action === "request-changes"
            ? "changes_requested"
            : body.action === "cancel"
              ? "cancelled"
              : body.action === "revise"
                ? "review"
                : current.status;
    const data = {
      ...current.data,
      ...refreshed,
      ...(body.action === "revise"
        ? { brief: body.brief, revision: Number(current.data.revision || 1) + 1 }
        : {}),
    };
    const [row] = await tx
      .update(tradeItems)
      .set({ status, data, version: current.version + 1, updatedAt: new Date() })
      .where(and(eq(tradeItems.id, current.id), eq(tradeItems.version, current.version)))
      .returning();
    if (!row) throw new HttpError(409, "Die Abstimmung wurde inzwischen geändert.");
    await tx
      .update(records)
      .set({
        data: sql`${records.data} || ${JSON.stringify({ collaborationState: status })}::jsonb`,
        version: sql`${records.version}+1`,
        updatedAt: new Date(),
      })
      .where(eq(records.id, row.id));
    await tx.insert(tradeItemHistory).values({
      organizationId: context.organizationId,
      itemId: row.id,
      version: row.version,
      createdBy: context.user.id,
      data: {
        action: body.action,
        message: body.message,
        author: context.user.name,
        revision: Number(data.revision),
      },
    });
    if (["approve", "acknowledge"].includes(body.action)) {
      const tasks = await tx
        .select()
        .from(records)
        .where(
          and(eq(records.kind, "tasks"), sql`${records.data}->>'sourceReviewId'=${current.id}`),
        );
      for (const task of tasks)
        await tx
          .update(records)
          .set({
            data: { ...task.data, status: "done", completedReviewVersion: row.version },
            version: task.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(records.id, task.id));
    }
    await notify(context, row, tx);
    return collaborationEntry(context, row);
  });
}
