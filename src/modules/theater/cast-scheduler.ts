import { eq, and, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import { tradeItems, tradeItemHistory } from "@/platform/db/schema";
import { type Context, can } from "@/platform/context";
import { activeSubjects } from "@/platform/worker-subjects";
import { moduleById } from "./registry";
import { saveTradeItem } from "./service";
import { emit } from "@/platform/events";
import { HttpError } from "@/platform/http";

/** A future command needs current authority and still-valid references on its due day. */
export async function applyDueCastChanges(context: Context) {
  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone: context.timezone || "Europe/Berlin",
  }).format(new Date());
  const rows = await db
    .select()
    .from(tradeItems)
    .where(
      and(
        eq(tradeItems.type, "cast-change"),
        sql`${tradeItems.status} not in ('archived','cancelled','blocked')`,
        sql`${tradeItems.data}->>'_castApplied'='false'`,
        sql`${tradeItems.data}->>'effectiveFrom'<=${day}`,
      ),
    )
    .limit(100);
  if (!rows.length) return 0;
  const subjects = await activeSubjects(context.organizationId, context.departmentId);
  let applied = 0;
  async function block(row: typeof tradeItems.$inferSelect, reason: string) {
    const [updated] = await db
      .update(tradeItems)
      .set({
        status: "blocked",
        version: row.version + 1,
        data: { ...row.data, _castApplyError: reason },
        updatedAt: new Date(),
      })
      .where(and(eq(tradeItems.id, row.id), eq(tradeItems.version, row.version)))
      .returning();
    if (!updated) return;
    await db.insert(tradeItemHistory).values({
      organizationId: context.organizationId,
      itemId: row.id,
      version: updated.version,
      createdBy: row.createdBy,
      data: {
        title: updated.title,
        status: updated.status,
        data: updated.data,
        action: "cast-application-blocked",
      },
    });
    await emit(db as never, { ...context, departmentId: row.departmentId }, "TradeItemChangedV1", {
      recordId: row.id,
      version: updated.version,
      moduleId: row.moduleId,
      productionId: row.productionId || "",
    });
  }
  for (const row of rows) {
    const subject = subjects.find((s) => s.user.id === (row.data._castAuthorId || row.createdBy));
    if (
      !subject ||
      !subject.activeDepartmentIds?.includes(row.departmentId) ||
      !can(subject, "casting.manage", row.productionId || "", row.departmentId)
    ) {
      await block(row, "Zuständigkeit vor Wirksamkeit entzogen");
      continue;
    }
    const contract = moduleById(row.moduleId)?.features.find((f) => f.id === row.type);
    if (!contract) continue;
    try {
      // The nested transaction isolates a rejected reference from other due commands.
      await db.transaction(async () =>
        saveTradeItem(
          { ...subject, departmentId: row.departmentId },
          {
            id: row.id,
            expectedVersion: row.version,
            moduleId: row.moduleId,
            type: row.type,
            title: row.title,
            productionId: row.productionId || undefined,
            status: row.status,
            data: Object.fromEntries(
              contract.fields
                .filter((f) => !f.managed && row.data[f.key] !== undefined)
                .map((f) => [f.key, row.data[f.key]]),
            ),
          },
        ),
      );
      applied++;
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      await block(
        row,
        "Die Besetzung konnte wegen geänderter Voraussetzungen nicht angewendet werden. Fachstand prüfen.",
      );
    }
  }
  return applied;
}
