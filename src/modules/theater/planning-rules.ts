import { safeRecordColumns, safeRecordData } from "@/modules/privacy/read-projection";
import { and, eq, ne, inArray, sql } from "drizzle-orm";
import { db, type Transaction } from "@/platform/db";
import { records, tenantSettings, memberships, tradeItems } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { listValue } from "@/shared/contracts";
import { occurrences } from "@/modules/calendar/occurrences";
import { calendarCategoryBlocksTime } from "@/shared/calendar-categories";
import { serialize } from "@/modules/records/repository";
import { planningDateWindow, workRuleViolation } from "@/shared/theater-planning";
import { limitedAvailabilityAllows } from "@/shared/theater-time";
import type { WorkRuleProfile } from "@/shared/work-rule-profiles";
type Interval = { start: Date; end: Date };
/** Confirmed local theater rules only. This is planning validation, never payroll calculation. */
export function checkWorkRules(
  proposed: Interval,
  existing: Interval[],
  rules: Record<string, unknown>,
) {
  const violation = workRuleViolation(proposed, existing, rules);
  if (violation === "maximum-duty")
    throw new HttpError(
      409,
      "Der Dienst überschreitet die vom Theater bestätigte maximale Dienstdauer.",
    );
  if (violation === "minimum-rest")
    throw new HttpError(409, "Die vom Theater bestätigte Ruhezeit wird unterschritten.");
  if (violation === "maximum-week")
    throw new HttpError(409, "Die bestätigte Höchstdauer der Kalenderwoche wird überschritten.");
  if (violation === "consecutive-days")
    throw new HttpError(
      409,
      "Die bestätigte Zahl aufeinanderfolgender Diensttage wird überschritten.",
    );
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
  const start = new Date(interval.start.getTime() - 32 * 86400000),
    end = new Date(interval.end.getTime() + 32 * 86400000);
  const categories = await tx
    .select(safeRecordColumns(context))
    .from(records)
    .where(eq(records.kind, "calendarCategories"));
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
    .select(safeRecordColumns(context))
    .from(records)
    .where(
      and(
        eq(records.organizationId, context.organizationId),
        eq(records.kind, "events"),
        excludeId ? ne(records.id, excludeId) : undefined,
        sql`(${records.startAt}<${end.toISOString()} and ${records.endAt}>${start.toISOString()} or coalesce(${records.data}->>'recurrence','none')<>'none')`,
      ),
    )
    .limit(10001);
  if (candidates.length > 10000)
    throw new HttpError(
      413,
      "Für diesen Planungszeitraum liegen zu viele Termine vor. Teile die Planung in kleinere Zeiträume auf.",
    );
  const personIntervals = new Map<string, Interval[]>([
    ...participantIds.map((id) => [`member:${id}`, []] as [string, Interval[]]),
    ...actorIds.map((id) => [`actor:${id}`, []] as [string, Interval[]]),
  ]);
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
    const existing = occurrences(
      serialize(candidate),
      start,
      end,
      settings?.timezone || "Europe/Berlin",
    ).map((o) => ({
      start: o.start,
      end: o.end,
    }));
    if (existing.some((o) => o.start < interval.end && o.end > interval.start))
      throw new HttpError(
        409,
        "Eine beteiligte Person oder Besetzung ist in diesem Zeitraum bereits disponiert oder abwesend.",
      );
    for (const id of participantIds)
      if (people.includes(id)) personIntervals.get(`member:${id}`)!.push(...existing);
    for (const id of actorIds)
      if (cast.includes(id)) personIntervals.get(`actor:${id}`)!.push(...existing);
  }
  const profiles = (settings?.settings.workRuleProfiles || []) as WorkRuleProfile[];
  if (personIntervals.size)
    for (const [person, existing] of personIntervals) {
      const [kind, id] = person.split(":");
      const profile = profiles.find((p) =>
        (kind === "member" ? p.memberIds : p.actorIds).includes(id),
      );
      const applicable = profile?.rules || rules;
      checkWorkRules(interval, existing, {
        ...applicable,
        timezone: settings?.timezone || "Europe/Berlin",
      });
      if (
        applicable.confirmedByTheater === true &&
        typeof applicable.breakAfterHours === "number" &&
        Number(applicable.minimumBreakMinutes) > Number(data.pauseMinutes || 0) &&
        (interval.end.getTime() - interval.start.getTime()) / 3600000 >=
          Number(applicable.breakAfterHours)
      )
        throw new HttpError(
          409,
          "Die bestätigte Pausenregel der Beschäftigtengruppe ist noch nicht eingeplant.",
        );
    }
  else checkWorkRules(interval, [], rules);
  if (
    !personIntervals.size &&
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
        sql`${tradeItems.data}->>'availability' in ('unavailable','limited')`,
        sql`${tradeItems.status} not in ('archived','cancelled')`,
      ),
    );
  const localDates = planningDateWindow(interval, settings?.timezone || "Europe/Berlin");
  if (
    availability.some(
      (a) =>
        participantIds.includes(a.createdBy) &&
        String(a.data.start) <= localDates.to &&
        String(a.data.end) >= localDates.from &&
        (a.data.availability === "unavailable" ||
          !limitedAvailabilityAllows(
            interval,
            a.data as { start: string; end: string; allowedFrom: string; allowedTo: string },
            settings?.timezone || "Europe/Berlin",
          )),
    )
  )
    throw new HttpError(
      409,
      "Eine beteiligte Person hat für diesen Zeitraum eine Nichtverfügbarkeit hinterlegt.",
    );
}
