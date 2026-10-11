import { and, eq, sql, inArray } from "drizzle-orm";
import { addDays, parseISO, format } from "date-fns";
import { db } from "@/platform/db";
import { records } from "@/platform/db/schema";
import { requirePermission, type Context } from "@/platform/context";
import { findRecord, serialize } from "@/modules/records/repository";
import { invalidateWorkspace } from "@/modules/records/workspace";
import { emit, auditChange, scheduleEvents } from "@/platform/events";
import { HttpError } from "@/platform/http";
import { startOfLocalDay } from "@/modules/time-tracking/rules";
import { occurrences } from "./occurrences";
import { calendarPresentation, calendarCategoryBlocksTime } from "@/shared/calendar-categories";
export async function decideLeave(
  context: Context,
  id: string,
  status: unknown,
  categoryKey?: unknown,
) {
  requirePermission(context, "leave.approve");
  if (status !== "approved" && status !== "rejected")
    throw new HttpError(400, "Ungültige Entscheidung.");
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.departmentId + ":calendar"}))`,
    );
    const row = await findRecord(context, id, "leave", tx);
    if (row.data.userId === context.user.id)
      throw new HttpError(403, "Eigene Anträge dürfen nicht selbst genehmigt werden.");
    if (row.data.status === "withdrawn")
      throw new HttpError(409, "Dieser Antrag wurde zurückgezogen.");
    let eventId = String(row.data.eventId || "");
    if (status === "approved") {
      const start = startOfLocalDay(String(row.data.start), context.timezone);
      const next = addDays(parseISO(String(row.data.end)), 1);
      const end = startOfLocalDay(format(next, "yyyy-MM-dd"), context.timezone);
      const planning = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.departmentId, context.departmentId),
            inArray(records.kind, ["events", "productions", "calendarCategories"]),
          ),
        );
      const categories = planning.filter(
        (item) => item.kind === "calendarCategories" && item.data.allDay === true,
      );
      const category = categoryKey
        ? categories.find((item) => item.data.key === categoryKey)
        : categories.find((item) => item.data.key === "absence") ||
          categories.find((item) => item.data.key === "vacation");
      if (!category)
        throw new HttpError(
          409,
          "Bitte wähle eine vorhandene ganztägige Kalenderkategorie für den Freiwunsch.",
        );
      const references = planning.map(serialize);
      for (const event of planning) {
        if (
          !calendarCategoryBlocksTime(
            String(category.data.key),
            references.filter((item) => item.kind === "calendarCategories"),
          ) ||
          !calendarCategoryBlocksTime(
            String(event.data.category),
            references.filter((item) => item.kind === "calendarCategories"),
          )
        )
          continue;
        if (
          event.kind !== "events" ||
          event.id === eventId ||
          !Array.isArray(event.data.participantIds) ||
          !event.data.participantIds.includes(row.data.userId)
        )
          continue;
        if (
          occurrences(serialize(event), start, end, context.timezone).some(
            (o) => o.start < end && o.end > start,
          )
        )
          throw new HttpError(
            409,
            `Der Freiwunsch überschneidet sich mit „${
              calendarPresentation(
                serialize(event),
                references.filter((item) => item.kind === "productions"),
                references.filter((item) => item.kind === "calendarCategories"),
              ).title
            }“. Bitte passe zuerst den Dienst an.`,
          );
      }
      eventId = eventId || crypto.randomUUID();
      await tx
        .insert(records)
        .values({
          id: eventId,
          kind: "events",
          organizationId: context.organizationId,
          departmentId: context.departmentId,
          createdBy: context.user.id,
          startAt: start,
          endAt: end,
          data: {
            title: "",
            start: start.toISOString(),
            end: end.toISOString(),
            category: category.data.key,
            allDay: true,
            productionId: "",
            participantIds: [row.data.userId],
            location: "",
            recurrence: "none",
            until: "",
            exceptions: [],
            theaterTimezone: context.timezone || "Europe/Berlin",
            leaveId: id,
          },
        })
        .onConflictDoUpdate({
          target: records.id,
          set: { startAt: start, endAt: end, updatedAt: new Date() },
        });
    } else if (eventId) {
      await tx
        .delete(records)
        .where(and(eq(records.id, eventId), eq(records.departmentId, context.departmentId)));
      eventId = "";
    }
    const [updated] = await tx
      .update(records)
      .set({
        data: { ...row.data, status, eventId },
        version: row.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(records.id, id))
      .returning();
    await emit(tx, context, "LeaveRequestDecidedV1", {
      userIds: [row.data.userId],
      title: status === "approved" ? "Freiwunsch genehmigt" : "Freiwunsch abgelehnt",
      body: `${row.data.start} bis ${row.data.end}`,
      link: "/?module=calendar",
    });
    await auditChange(tx, context, "leave.decided", id);
    return serialize(updated);
  });
  invalidateWorkspace(context.departmentId);
  scheduleEvents();
  return result;
}
