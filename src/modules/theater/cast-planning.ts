import { safeRecordColumns, safeRecordData } from "@/modules/privacy/read-projection";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Transaction } from "@/platform/db";
import type { Context } from "@/platform/context";
import { records, performances } from "@/platform/db/schema";
import { assertPlanning } from "./planning-rules";
import { listValue } from "@/shared/contracts";
/** Keep future canonical performances synchronized when a central cast assignment changes. */
export async function syncCastPlanning(context: Context, productionId: string, tx: Transaction) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":calendar"}))`,
  );
  const casts = await tx
    .select(safeRecordColumns(context))
    .from(records)
    .where(and(eq(records.kind, "casting"), eq(records.productionId, productionId)));
  const actors = [...new Set(casts.map((c) => String(c.data.actorId || "")).filter(Boolean))];
  const shows = await tx
    .select()
    .from(performances)
    .where(
      and(
        eq(performances.productionId, productionId),
        ne(performances.status, "cancelled"),
        sql`${performances.curtainAt}>=${new Date().toISOString()}`,
      ),
    );
  for (const show of shows) {
    const [event] = await tx
      .select(safeRecordColumns(context))
      .from(records)
      .where(eq(records.id, show.eventId))
      .limit(1);
    if (!event) continue;
    await assertPlanning(
      context,
      {
        start: String(event.data.start),
        end: String(event.data.end),
        participantIds: listValue(event.data.participantIds),
        actorIds: actors,
        pauseMinutes: Number(event.data.pauseMinutes || 0),
      },
      event.id,
      tx,
    );
    await tx
      .update(records)
      .set({
        data: { ...event.data, actorIds: actors },
        version: event.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(records.id, event.id));
  }
}
