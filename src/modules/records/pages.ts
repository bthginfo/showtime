import { getTableColumns } from "drizzle-orm";
import { pageTimestamp } from "@/platform/db/page-timestamp";
import { and, eq, desc, sql, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { encodePosition, decodePosition, type PagePosition } from "@/platform/pagination";
import { db } from "@/platform/db";
import { records } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { serialize, projectVisible } from "./repository";
import { privateRowReadable, guestOnly, centralKinds } from "@/shared/access-policy";
import { listValue, contactsValue, type RecordKind, type DomainRecord } from "@/shared/contracts";
export async function allRows(context: Context, kind: RecordKind) {
  const result: (typeof records.$inferSelect)[] = [];
  let cursor: PagePosition | null = null;
  do {
    const page = await db
      .select({ ...getTableColumns(records), positionAt: pageTimestamp(records.createdAt) })
      .from(records)
      .where(
        and(
          eq(records.organizationId, context.organizationId),
          eq(records.kind, kind),
          cursor
            ? sql`(${records.createdAt},${records.id})<(${cursor[0]},${cursor[1]})`
            : undefined,
        ),
      )
      .orderBy(desc(records.createdAt), desc(records.id))
      .limit(2000);
    result.push(...page);
    if (page.length < 2000) break;
    if (result.length >= 100000)
      throw new HttpError(
        413,
        "Dieser Datenbestand ist für einen einzelnen Abruf zu groß. Bitte grenze den Export ein.",
      );
    cursor = [page[page.length - 1].positionAt, page[page.length - 1].id];
  } while (cursor);
  return result;
}
export async function readReferences(context: Context) {
  const [productions, conversations, casting] = await Promise.all([
    allRows(context, "productions"),
    allRows(context, "conversations"),
    guestOnly(context.user) ? allRows(context, "casting") : Promise.resolve([]),
  ]);
  const projects = productions.filter((p) => projectVisible(context, p));
  const chats = conversations.filter((c) =>
    privateRowReadable(context.user, c, context.departmentId),
  );
  const projectIds = new Set(projects.map((p) => p.id)),
    chatIds = new Set(chats.map((c) => c.id));
  const actorIds = new Set(
    casting
      .filter((c) => projectIds.has(String(c.data.productionId)))
      .map((c) => String(c.data.actorId)),
  );
  const personIds = new Set(
    projects.flatMap((p) => contactsValue(p.data.contacts).map((c) => c.personId || "")),
  );
  return { projects, chats, projectIds, chatIds, actorIds, personIds };
}
export type ReadReferences = Awaited<ReturnType<typeof readReferences>>;
export function rowReadable(
  context: Context,
  row: typeof records.$inferSelect,
  refs: ReadReferences,
) {
  if (row.kind === "handovers" && (row.data.collaborationId || row.data.tradeItemId)) return false;
  if (
    !centralKinds.includes(row.kind) &&
    row.departmentId !== context.departmentId &&
    !context.grants.some((g) => g.scope === "production" && g.scopeId === row.productionId)
  )
    return false;
  if (
    ["categories", "calendarCategories"].includes(row.kind) &&
    row.departmentId !== context.departmentId
  )
    return false;
  if (["time", "attendance", "timesheets"].includes(row.kind))
    return privateRowReadable(context.user, row, context.departmentId);
  if (row.kind === "productions") return refs.projectIds.has(row.id);
  if (row.productionId && !refs.projectIds.has(row.productionId)) return false;
  if (row.data.conversationId && !refs.chatIds.has(String(row.data.conversationId))) return false;
  if (
    row.kind === "messages" &&
    !row.productionId &&
    !row.data.conversationId &&
    row.departmentId !== context.departmentId
  )
    return false;
  if (row.kind === "conversations") return refs.chatIds.has(row.id);
  if (guestOnly(context.user) && row.kind === "actors") return refs.actorIds.has(row.id);
  if (guestOnly(context.user) && row.kind === "people") return refs.personIds.has(row.id);
  return privateRowReadable(context.user, row, context.departmentId);
}
export async function recordPage(
  context: Context,
  kind: RecordKind,
  options: {
    cursor?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    productionId?: string;
  } = {},
  references?: ReadReferences,
) {
  const cursor = decodePosition(
      options.cursor,
      context,
      `records:${kind}:${options.from || ""}:${options.to || ""}:${options.productionId || ""}`,
    ),
    refs = references || (await readReferences(context)),
    limit = Math.min(300, Math.max(1, options.limit || 200));
  const from = options.from ? z.iso.date().parse(options.from) : null,
    to = options.to ? z.iso.date().parse(options.to) : null;
  if (options.productionId) {
    const { assertProject } = await import("./repository");
    await assertProject(context, options.productionId);
  }
  if (from && to && to < from) throw new HttpError(400, "Ungültiger Zeitraum.");
  const page = await db
    .select({ ...getTableColumns(records), positionAt: pageTimestamp(records.createdAt) })
    .from(records)
    .where(
      and(
        eq(records.organizationId, context.organizationId),
        eq(records.kind, kind),
        options.productionId ? eq(records.productionId, options.productionId) : undefined,
        cursor ? sql`(${records.createdAt},${records.id})<(${cursor[0]},${cursor[1]})` : undefined,
        ["categories", "calendarCategories"].includes(kind)
          ? eq(records.departmentId, context.departmentId)
          : undefined,
        kind === "messages"
          ? or(
              sql`${records.data}->>'conversationId' in (select id from records where kind='conversations' and id in ${
                refs.chatIds.size
                  ? sql`(${sql.join(
                      [...refs.chatIds].map((id) => sql`${id}`),
                      sql`,`,
                    )})`
                  : sql`(null)`
              })`,
              sql`coalesce(${records.data}->>'conversationId','')='' and (${records.productionId} is not null or ${records.departmentId}=${context.departmentId})`,
            )
          : undefined,
        kind === "notifications" || kind === "feedback"
          ? sql`${records.data}->>'userId'=${context.user.id}`
          : undefined,
        ["time", "attendance", "leave"].includes(kind) &&
          !context.user.grants?.some((g) => ["personnel", "team_lead"].includes(g.role))
          ? sql`${records.data}->>'userId'=${context.user.id}`
          : undefined,
        from && kind === "events"
          ? sql`(${records.endAt}>=${new Date(from).toISOString()} or coalesce(${records.data}->>'recurrence','none')<>'none')`
          : from && ["time", "attendance"].includes(kind)
            ? sql`${records.data}->>'date'>=${from}`
            : undefined,
        to && kind === "events"
          ? sql`${records.startAt}<${new Date(new Date(to).getTime() + 86400000).toISOString()}`
          : to && ["time", "attendance"].includes(kind)
            ? sql`${records.data}->>'date'<=${to}`
            : undefined,
      ),
    )
    .orderBy(desc(records.createdAt), desc(records.id))
    .limit(limit + 1);
  const scanned = page.slice(0, limit),
    readable: DomainRecord[] = [];
  for (const row of scanned) {
    if (!rowReadable(context, row, refs)) continue;
    if (row.kind === "files") {
      if (row.data.pendingDeletionOperation) continue;
      const [parent] = await db
        .select({ ...getTableColumns(records), positionAt: pageTimestamp(records.createdAt) })
        .from(records)
        .where(eq(records.id, String(row.data.recordId)))
        .limit(1);
      if (!parent || !rowReadable(context, parent, refs)) continue;
      readable.push({ ...serialize(row), data: { ...row.data, path: undefined } });
      continue;
    }
    if (row.kind === "notifications") {
      const { noticeReadable } = await import("@/modules/notifications/access");
      if (!(await noticeReadable(context, row))) continue;
    }
    readable.push(
      row.kind === "leave" &&
        row.data.userId !== context.user.id &&
        !context.user.permissions?.includes("personnel.read")
        ? { ...serialize(row), data: { ...row.data, reason: "" } }
        : serialize(row),
    );
  }
  return {
    records: readable.reverse(),
    nextCursor:
      page.length > limit
        ? encodePosition(
            [scanned.at(-1)!.positionAt, scanned.at(-1)!.id],
            context,
            `records:${kind}:${options.from || ""}:${options.to || ""}:${options.productionId || ""}`,
          )
        : null,
  };
}
