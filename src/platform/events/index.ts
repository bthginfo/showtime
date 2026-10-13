import { safeRecordColumns, safeRecordData } from "@/modules/privacy/read-projection";
import { activeSubjects } from "../worker-subjects";
import { privateRowReadable, anyPermission } from "@/shared/access-policy";
import { projectVisible } from "@/modules/records/repository";
import { assertRead } from "@/modules/records/service";
import { publishEvents } from "./transport";
import { handleTheaterEvent } from "@/modules/theater/events";
import { after } from "@/platform/request";
import { and, eq, lte, sql, or, ne, inArray, getTableColumns } from "drizzle-orm";
import { db, type Transaction } from "@/platform/db";
import { outbox, records, audit, memberships, eventReceipts } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { invalidateWorkspace } from "@/modules/records/workspace";
import type { RecordData } from "@/shared/contracts";
import { listValue } from "@/shared/contracts";
import { deliverNotifications } from "@/modules/notifications/service";
export async function emit(
  tx: Transaction,
  context: Context,
  type: string,
  payload: RecordData,
  options: { availableAt?: Date } = {},
) {
  await tx.insert(outbox).values({
    id: crypto.randomUUID(),
    departmentId: context.departmentId,
    type,
    organizationId: context.organizationId,
    payload: {
      ...payload,
      aggregateId: String(payload.recordId || ""),
      aggregateVersion: Number(payload.version || 1),
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      actorId: context.user.id,
      organizationId: context.organizationId,
    },
    ...(options.availableAt ? { availableAt: options.availableAt } : {}),
  });
}
export async function auditChange(
  tx: Transaction,
  context: Context,
  action: string,
  recordId?: string,
) {
  await tx.insert(audit).values({
    id: crypto.randomUUID(),
    departmentId: context.departmentId,
    userId: context.user.id,
    action,
    recordId,
  });
}
export function scheduleEvents() {
  after(async () => {
    await publishEvents().catch((error) =>
      console.error("Event processing failed", {
        name: error instanceof Error ? error.name : "unknown",
        code: (error as { cause?: { code?: string } })?.cause?.code || "unknown",
      }),
    );
  });
}
export async function processEvents(eventId?: string) {
  const changedDepartments = new Set<string>();
  const due = await db.transaction(async (tx) => {
    const list = await tx
      .select({
        ...getTableColumns(outbox),
        payload: sql<RecordData>`showtime_safe_event_payload(${outbox.type},${outbox.payload})`,
      })
      .from(outbox)
      .where(
        and(
          or(
            eq(outbox.status, "pending"),
            eq(outbox.status, "queued"),
            eq(outbox.status, "processing"),
          ),
          eventId ? eq(outbox.id, eventId) : lte(outbox.availableAt, new Date()),
        ),
      )
      .limit(20)
      .for("update", { skipLocked: true });
    for (const event of list)
      await tx
        .update(outbox)
        .set({ status: "processing", availableAt: new Date(Date.now() + 120000) })
        .where(eq(outbox.id, event.id));
    return list;
  });
  for (const event of due) {
    try {
      const noticeIds: string[] = [];
      if (event.type === "RecordDeletionFinalizedV1") {
        const { finalizeRecordDeletion } = await import("@/modules/files/legacy-deletion-cleanup");
        await finalizeRecordDeletion(event.departmentId, event.payload);
      }
      if (event.type === "FileDeletionRequestedV1") {
        const [reference] = await db
          .select({ id: records.id })
          .from(records)
          .where(
            and(
              eq(records.kind, "files"),
              sql`${records.data}->>'path'=${String(event.payload.path)}`,
            ),
          )
          .limit(1);
        if (!reference) {
          const { del } = await import("@vercel/blob");
          const references = await db
            .select({ id: records.id })
            .from(records)
            .where(
              and(
                eq(records.kind, "files"),
                sql`${records.data}->>'path'=${String(event.payload.path)}`,
              ),
            )
            .limit(1);
          if (!references.length) await del(String(event.payload.path));
          if (
            event.payload.fileId &&
            /\.(?:docx|xlsx|csv|pdf)$/i.test(String(event.payload.path))
          ) {
            const { clearDocumentCache } = await import("@/modules/documents/storage");
            const { liveConfigured } = await import("@/platform/realtime");
            if (liveConfigured()) await clearDocumentCache(String(event.payload.fileId));
          }
        }
      }
      await db.transaction(async (tx) => {
        const [receipt] = await tx
          .select()
          .from(eventReceipts)
          .where(and(eq(eventReceipts.eventId, event.id), eq(eventReceipts.handler, "business-v1")))
          .limit(1);
        if (receipt) {
          const previous = await tx
            .select({ id: records.id })
            .from(records)
            .where(
              and(
                eq(records.kind, "notifications"),
                sql`${records.id} like ${"notice:" + event.id + ":%"}`,
              ),
            );
          noticeIds.push(...previous.map((n) => n.id));
          return;
        }
        noticeIds.push(...((await handleTheaterEvent(tx, event)) || []));
        if (
          event.type === "TaskAssignedV1" ||
          event.type === "LeaveRequestDecidedV1" ||
          event.type === "ServiceChangedV1" ||
          event.type === "ShiftSwapChangedV1" ||
          event.type === "LookPublishedV1" ||
          event.type === "ChatMessageCreatedV1" ||
          event.type === "SchedulePublishedV1" ||
          event.type === "PurchaseDecidedV1"
        ) {
          const subjects = await activeSubjects(event.organizationId, event.departmentId, tx);
          const [source] = event.payload.recordId
            ? await tx
                .select(safeRecordColumns())
                .from(records)
                .where(eq(records.id, String(event.payload.recordId)))
                .limit(1)
            : [];
          let permitted = subjects.filter(
            (subject) =>
              Array.isArray(event.payload.userIds) &&
              event.payload.userIds.includes(subject.user.id),
          );
          if (event.type === "ChatMessageCreatedV1" || event.type === "SchedulePublishedV1")
            permitted = subjects;
          const targets: string[] = [];
          for (const subject of permitted) {
            if (!source) {
              if (
                (event.type === "SchedulePublishedV1" &&
                  anyPermission(subject.user, "schedule.read")) ||
                event.type === "PurchaseDecidedV1"
              )
                targets.push(subject.user.id);
              continue;
            }
            if (
              event.type === "ChatMessageCreatedV1" &&
              !source.data.conversationId &&
              !source.data.productionId &&
              subject.departmentId !== source.departmentId
            )
              continue;
            try {
              await assertRead(subject, source, tx);
              targets.push(subject.user.id);
            } catch (error) {
              if (!(
                error instanceof Error &&
                "status" in error &&
                [403, 404].includes(Number(error.status))
              ))
                throw error;
            }
          }
          for (const uid of targets) {
            if (uid === event.payload.actorId) continue;
            const noticeId = `notice:${event.id}:${uid}`;
            noticeIds.push(noticeId);
            await tx
              .insert(records)
              .values({
                id: noticeId,
                kind: "notifications",
                organizationId: String(event.payload.organizationId),
                departmentId: event.departmentId,
                createdBy: String(event.payload.actorId),
                ownerId: uid,
                productionId:
                  typeof event.payload.productionId === "string" && event.payload.productionId
                    ? event.payload.productionId
                    : null,
                data: {
                  type: event.type,
                  recordId: event.payload.recordId || "",
                  ...(event.payload.conversationId
                    ? { conversationId: event.payload.conversationId }
                    : {}),
                  productionId:
                    typeof event.payload.productionId === "string"
                      ? event.payload.productionId
                      : "",
                  title: String(event.payload.title || "Neue Information"),
                  body: String(event.payload.body || ""),
                  userId: uid,
                  read: false,
                  link: String(event.payload.link || ""),
                },
              })
              .onConflictDoNothing();
          }
        }
        await tx
          .insert(eventReceipts)
          .values({
            organizationId: event.organizationId,
            eventId: event.id,
            handler: "business-v1",
          })
          .onConflictDoNothing();
      });
      changedDepartments.add(event.departmentId);
      await deliverNotifications(event.organizationId, event.departmentId, event.type, noticeIds);
      await db.update(outbox).set({ status: "done" }).where(eq(outbox.id, event.id));
    } catch (error) {
      await db
        .update(outbox)
        .set({
          attempts: event.attempts + 1,
          status: event.attempts >= 5 ? "failed" : "pending",
          availableAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** event.attempts)),
        })
        .where(eq(outbox.id, event.id));
      console.error("Event delivery failed", event.id, {
        name: error instanceof Error ? error.name : "unknown",
        code: (error as { cause?: { code?: string } })?.cause?.code || "unknown",
      });
    }
  }
  for (const departmentId of changedDepartments) invalidateWorkspace(departmentId);
  return { processed: due.length };
}
