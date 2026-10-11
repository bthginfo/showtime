import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db, type Transaction } from "./db";
import { tenantSettings, records, audit, tenantMembers, mediaUploads } from "./db/schema";
import type { Context } from "./context";
import { HttpError } from "./http";
function ceiling(value: unknown, fallback: number, maximum: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}
export async function fileQuota(
  context: Context,
  additionalBytes: number,
  excludeUploadId?: string,
) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":file-quota"}))`,
  );
  const [settings] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, context.organizationId))
    .limit(1);
  const quotas = (settings?.settings.quotas || {}) as Record<string, unknown>;
  const maxBytes = ceiling(quotas.filesBytes, 250_000_000, 1_000_000_000),
    daily = ceiling(quotas.uploadsPerUserPerDay, 200, 1000);
  const [used] = await db
    .select({ bytes: sql<number>`coalesce(sum((${records.data}->>'size')::bigint),0)::float8` })
    .from(records)
    .where(and(eq(records.organizationId, context.organizationId), eq(records.kind, "files")));
  const [pending] = await db
    .select({ bytes: sql<number>`coalesce(sum(${mediaUploads.size}),0)::float8` })
    .from(mediaUploads)
    .where(
      and(
        sql`${mediaUploads.completedFileId} is null`,
        gt(mediaUploads.expiresAt, new Date()),
        excludeUploadId ? ne(mediaUploads.id, excludeUploadId) : undefined,
      ),
    );
  if (Number(used.bytes) + Number(pending.bytes) + additionalBytes > maxBytes)
    throw new HttpError(
      413,
      "Das Dateikontingent dieses Theaters ist erreicht. Entferne nicht mehr benötigte Dateien.",
    );
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(audit)
    .where(
      and(
        eq(audit.organizationId, context.organizationId),
        eq(audit.userId, context.user.id),
        eq(audit.action, "file.uploaded"),
        gt(audit.createdAt, new Date(Date.now() - 86400000)),
      ),
    );
  if (count.count >= daily) throw new HttpError(429, "Das tägliche Uploadkontingent ist erreicht.");
}
export async function memberQuota(organizationId: string, tx: Transaction | typeof db = db) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${organizationId + ":member-quota"}))`,
  );
  const [settings] = await tx
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, organizationId))
    .limit(1);
  const quota = ceiling(
    ((settings?.settings.quotas || {}) as Record<string, unknown>).members,
    500,
    2000,
  );
  const [used] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantMembers)
    .where(
      and(eq(tenantMembers.organizationId, organizationId), eq(tenantMembers.status, "active")),
    );
  if (used.count >= quota)
    throw new HttpError(409, "Das Mitgliederkontingent dieses Theaters ist erreicht.");
}
