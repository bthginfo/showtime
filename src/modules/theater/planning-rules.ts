import { and, eq, ne, inArray, sql } from "drizzle-orm";
import { db, type Transaction } from "@/platform/db";
import { records, tenantSettings, memberships, tradeItems } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { listValue } from "@/shared/contracts";
import { occurrences } from "@/modules/calendar/occurrences";
import { calendarCategoryBlocksTime } from "@/shared/calendar-categories";
import { serialize } from "@/modules/records/repository";
type Interval = { start: Date; end: Date };
/** Confirmed local theater rules only. This is planning validation, never payroll calculation. */
export function checkWorkRules(
  proposed: Interval,
  existing: Interval[],
  rules: Record<string, unknown>,
) {
  if (rules.confirmedByTheater !== true) return;
  const duty = Number(rules.maxDutyHours),
    rest = Number(rules.minimumRestHours);
  if (Number.isFinite(duty) && (proposed.end.getTime() - proposed.start.getTime()) / 3600000 > duty)
    throw new HttpError(
      409,
      "Der Dienst überschreitet die vom Theater bestätigte maximale Dienstdauer.",
    );
  for (const interval of existing) {
    const gap =
      interval.end <= proposed.start
        ? proposed.start.getTime() - interval.end.getTime()
        : interval.start >= proposed.end
          ? interval.start.getTime() - proposed.end.getTime()
          : null;
    if (gap !== null && gap > 0 && gap < rest * 3600000)
      throw new HttpError(409, "Die vom Theater bestätigte Ruhezeit wird unterschritten.");
  }
}
export async function assertPlanning(
  context: Context,
  data: {
    start: string;
    end: string;
    participantIds?: string[];
    actorIds?: string[];
    pauseMinutes?: number;
    cancelled?: boolean;
    category?: string;
    blocksTime?: boolean;
  },
  excludeId?: string,
  tx: Transaction | typeof db = db,
) {
  if (data.cancelled) return;
  const interval = { start: new Date(data.start), end: new Date(data.end) };
  if (
    !Number.isFinite(interval.start.getTime()) ||
    !Number.isFinite(interval.end.getTime()) ||
    interval.end <= interval.start
  )
    throw new HttpError(400, "Bitte prüfe Beginn und Ende.");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
  );
  const participantIds = [...new Set(data.participantIds || [])],
    actorIds = [...new Set(data.actorIds || [])];
  if (participantIds.length) {
    const members = await tx
      .select({ id: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, context.organizationId),
          eq(memberships.status, "active"),
          inArray(memberships.userId, participantIds),
        ),
      );
    if (new Set(members.map((m) => m.id)).size !== participantIds.length)
      throw new HttpError(400, "Eine beteiligte Person gehört nicht zum aktiven Theaterteam.");
  }
  if (actorIds.length) {
    const actors = await tx
      .select({ id: records.id })
      .from(records)
      .where(
        and(
          eq(records.organizationId, context.organizationId),
          eq(records.kind, "actors"),
          inArray(records.id, actorIds),
        ),
      );
    if (actors.length !== actorIds.length)
      throw new HttpError(400, "Eine Besetzung gehört nicht zu diesem Theater.");
  }
  const [settings] = await tx
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, context.organizationId))
    .limit(1);
  const rules = (settings?.settings.workRules || {}) as Record<string, unknown>;
  const start = new Date(interval.start.getTime() - 86400000),
    end = new Date(interval.end.getTime() + 86400000);
  const categories = await tx.select().from(records).where(eq(records.kind, "calendarCategories"));
  if (
    !actorIds.length &&
    data.blocksTime !== true &&
    data.category &&
    !calendarCategoryBlocksTime(
      data.category,
      categories.filter((c) => c.departmentId === context.departmentId).map(serialize),
    )
  )
    return;
  const candidates = await tx
    .select()
    .from(records)
    .where(
      and(
        eq(records.organizationId, context.organizationId),
        eq(records.kind, "events"),
        excludeId ? ne(records.id, excludeId) : undefined,
        sql`(${records.startAt}<${end.toISOString()} and ${records.endAt}>${start.toISOString()} or coalesce(${records.data}->>'recurrence','none')<>'none')`,
      ),
    );
  for (const candidate of candidates) {
    if (
      candidate.data.cancelled === true ||
      candidate.data.blocksTime === false ||
      (!listValue(candidate.data.actorIds).length &&
        candidate.data.blocksTime !== true &&
        !calendarCategoryBlocksTime(
          String(candidate.data.category),
          categories.filter((c) => c.departmentId === candidate.departmentId).map(serialize),
        ))
    )
      continue;
    const people = listValue(candidate.data.participantIds),
      cast = listValue(candidate.data.actorIds);
    if (
      !participantIds.some((id) => people.includes(id)) &&
      !actorIds.some((id) => cast.includes(id))
    )
      continue;
    const existing = occurrences(serialize(candidate), start, end).map((o) => ({
      start: o.start,
      end: o.end,
    }));
    if (existing.some((o) => o.start < interval.end && o.end > interval.start))
      throw new HttpError(
        409,
        "Eine beteiligte Person oder Besetzung ist in diesem Zeitraum bereits disponiert oder abwesend.",
      );
    checkWorkRules(interval, existing, rules);
  }
  checkWorkRules(interval, [], rules);
  if (
    rules.confirmedByTheater === true &&
    typeof rules.breakAfterHours === "number" &&
    Number(rules.minimumBreakMinutes) > Number(data.pauseMinutes || 0) &&
    (interval.end.getTime() - interval.start.getTime()) / 3600000 >= Number(rules.breakAfterHours)
  )
    throw new HttpError(409, "Die vom Theater bestätigte Pausenregel ist noch nicht eingeplant.");
  const availability = await tx
    .select()
    .from(tradeItems)
    .where(
      and(
        eq(tradeItems.organizationId, context.organizationId),
        eq(tradeItems.type, "availability"),
        sql`${tradeItems.data}->>'availability'='unavailable'`,
      ),
    );
  if (
    availability.some(
      (a) =>
        participantIds.includes(a.createdBy) &&
        String(a.data.start) <= data.end.slice(0, 10) &&
        String(a.data.end) >= data.start.slice(0, 10),
    )
  )
    throw new HttpError(
      409,
      "Eine beteiligte Person hat für diesen Zeitraum eine Nichtverfügbarkeit hinterlegt.",
    );
}
