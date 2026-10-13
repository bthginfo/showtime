import { and, eq, ne, sql } from "drizzle-orm";
import { records } from "@/platform/db/schema";
import type { Transaction } from "@/platform/db";
import type { Context } from "@/platform/context";
import type { RecordData } from "@/shared/contracts";
import { HttpError } from "@/platform/http";
import { localDay, startOfLocalDay } from "@/modules/time-tracking/rules";
import { calendarCategoryBehavior } from "@/shared/calendar-categories";
import { clinicalInput } from "@/modules/privacy/model";
import { calendarDayCreditCategory } from "@/modules/time-tracking/day-credits";

export async function validateCalendarCategory(
  context: Context,
  data: RecordData,
  tx: Transaction,
  existing?: typeof records.$inferSelect,
) {
  if (
    clinicalInput(String(data.name)) ||
    /sick|krank|attest|medical|allerg/iu.test(String(data.key))
  )
    throw new HttpError(400, "Medizinische Kategorien sind auf dieser Infrastruktur gesperrt.");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.departmentId + ":calendar"}))`,
  );
  if (existing && existing.data.key !== data.key)
    throw new HttpError(400, "Der Kategoriencode kann nicht geändert werden.");
  const [duplicate] = await tx
    .select({ id: records.id })
    .from(records)
    .where(
      and(
        eq(records.departmentId, context.departmentId),
        eq(records.kind, "calendarCategories"),
        sql`${records.data}->>'key'=${String(data.key)}`,
        existing ? ne(records.id, existing.id) : undefined,
      ),
    )
    .limit(1);
  if (duplicate) throw new HttpError(409, "Dieser Kategoriencode ist bereits vergeben.");
  const oldBlocking = calendarCategoryBehavior(
    String(existing?.data.key),
    existing?.data,
  ).blocksTime;
  const newBlocking = calendarCategoryBehavior(String(data.key), data).blocksTime;
  if (existing && (existing.data.allDay !== data.allDay || oldBlocking !== newBlocking))
    await assertUnusedCategory(context, String(data.key), tx);
}

export async function assertUnusedCategory(context: Context, key: string, tx: Transaction) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.departmentId + ":calendar"}))`,
  );
  const [used] = await tx
    .select({ id: records.id })
    .from(records)
    .where(
      and(
        eq(records.departmentId, context.departmentId),
        eq(records.kind, "events"),
        sql`${records.data}->>'category'=${key}`,
      ),
    )
    .limit(1);
  if (used)
    throw new HttpError(
      409,
      "Diese Kategorie wird verwendet. Ordne die Termine zuerst einer anderen Kategorie zu.",
    );
}

export async function normalizeEventCategory(context: Context, data: RecordData, tx: Transaction) {
  const [category] = await tx
    .select({ data: records.data })
    .from(records)
    .where(
      and(
        eq(records.departmentId, context.departmentId),
        eq(records.kind, "calendarCategories"),
        sql`${records.data}->>'key'=${String(data.category)}`,
      ),
    )
    .limit(1);
  if (!category) throw new HttpError(400, "Bitte wähle eine vorhandene Kalenderkategorie.");
  if (String(data.category) !== "absence")
    data.creditUnit = calendarDayCreditCategory(
      { data, departmentId: context.departmentId } as any,
      [{ data: category.data, departmentId: context.departmentId } as any],
    )
      ? "weekly-sixth"
      : "none";
  data.allDay = category.data.allDay === true;
  if (data.allDay) {
    data.start = startOfLocalDay(
      localDay(String(data.start), context.timezone),
      context.timezone,
    ).toISOString();
    data.end = startOfLocalDay(
      localDay(String(data.end), context.timezone),
      context.timezone,
    ).toISOString();
  }
  return String(category.data.name);
}
