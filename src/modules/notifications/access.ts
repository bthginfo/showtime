import { safeRecordColumns, safeRecordData } from "@/modules/privacy/read-projection";
import { and, eq } from "drizzle-orm";
import { db } from "@/platform/db";
import {
  records,
  tradeItems,
  performances,
  scheduleVersions,
  resourceBookings,
} from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { can } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { assertRead } from "@/modules/records/service";
import { assertProject } from "@/modules/records/repository";

/** Parent access is checked again after role, cast and chat membership changes. */
export async function noticeReadable(context: Context, notice: typeof records.$inferSelect) {
  try {
    await assertRead(context, notice);
    const id = String(notice.data.recordId || "");
    if (!id) return true;
    const [source] = await db
      .select(safeRecordColumns(context))
      .from(records)
      .where(and(eq(records.organizationId, context.organizationId), eq(records.id, id)))
      .limit(1);
    if (source) {
      await assertRead(context, source);
      return true;
    }
    const [trade] = await db.select().from(tradeItems).where(eq(tradeItems.id, id)).limit(1);
    if (trade) {
      const { tradeReadable } = await import("@/modules/theater/service");
      await assertProject(context, trade.productionId);
      return tradeReadable(context, trade);
    }
    const [show] = await db.select().from(performances).where(eq(performances.id, id)).limit(1);
    if (show) {
      await assertProject(context, show.productionId);
      return can(context, "schedule.read", show.productionId);
    }
    const [version] = await db
      .select({ id: scheduleVersions.id })
      .from(scheduleVersions)
      .where(eq(scheduleVersions.id, id))
      .limit(1);
    if (version) return can(context, "schedule.read");
    const [booking] = await db
      .select()
      .from(resourceBookings)
      .where(eq(resourceBookings.id, id))
      .limit(1);
    if (booking) {
      await assertProject(context, booking.productionId);
      return can(context, "inventory.read", booking.productionId || "");
    }
    return false;
  } catch (e) {
    if (e instanceof HttpError && [403, 404].includes(e.status)) return false;
    throw e;
  }
}
