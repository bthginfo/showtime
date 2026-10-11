import { eq } from "drizzle-orm";
import { db, type Transaction } from "@/platform/db";
import { records, tradeItems, tradeItemHistory } from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { readableTrade } from "./operations";
import { moduleById } from "./registry";
import { emit, scheduleEvents } from "@/platform/events";
export async function ensureTradeFileParent(context: Context, itemId: string) {
  const item = await readableTrade(context, itemId),
    feature = moduleById(item.moduleId)?.features.find((f) => f.id === item.type);
  if (!feature || !can(context, feature.permission, item.productionId || "", item.departmentId))
    throw new HttpError(403, "Keine Anlagenberechtigung für diesen Fachstand.");
  if (["archived", "cancelled"].includes(item.status))
    throw new HttpError(
      409,
      "Abgeschlossene Fachstände erhalten keine neuen Anlagen. Verwende einen Nachfolgestand.",
    );
  const id = "trade-files:" + item.id;
  await db
    .insert(records)
    .values({
      id,
      organizationId: context.organizationId,
      departmentId: item.departmentId,
      productionId: item.productionId,
      createdBy: item.createdBy,
      kind: "handovers",
      data: {
        tradeItemId: item.id,
        moduleId: item.moduleId,
        type: item.type,
        title: item.title,
        productionId: item.productionId || "",
      },
    })
    .onConflictDoNothing();
  return id;
}
export async function tradeFileChanged(context: Context, itemId: string, tx: Transaction) {
  const [source] = await tx
    .select()
    .from(tradeItems)
    .where(eq(tradeItems.id, itemId))
    .limit(1)
    .for("update");
  if (!source) throw new HttpError(404, "Der Fachstand ist nicht mehr verfügbar.");
  if (["archived", "cancelled"].includes(source.status))
    throw new HttpError(409, "Anlagen eines abgeschlossenen Fachstands bleiben erhalten.");
  const data = {
    ...source.data,
    _fileVersion: Number(source.data._fileVersion || 0) + 1,
  } as Record<string, unknown>;
  delete data._approval;
  const managed = moduleById(source.moduleId)
    ?.features.find((f) => f.id === source.type)
    ?.fields.find((f) => f.managed);
  if (managed) data[managed.key] = managed.type === "checkbox" ? false : "draft";
  const [updated] = await tx
    .update(tradeItems)
    .set({
      data,
      version: source.version + 1,
      status: ["published", "ready", "done"].includes(source.status) ? "review" : source.status,
      updatedAt: new Date(),
    })
    .where(eq(tradeItems.id, itemId))
    .returning();
  await tx.insert(tradeItemHistory).values({
    organizationId: context.organizationId,
    itemId,
    version: updated.version,
    createdBy: context.user.id,
    data: { title: source.title, status: updated.status, data, action: "attachment-change" },
  });
  await emit(tx, context, "TradeItemChangedV1", {
    recordId: itemId,
    version: updated.version,
    moduleId: source.moduleId,
    productionId: source.productionId || "",
  });
  scheduleEvents();
}
