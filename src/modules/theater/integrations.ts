import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import { apiAccess, integrationReceipts } from "@/platform/db/schema";
import { requirePermission, type Context } from "@/platform/context";
import { currentRequest } from "@/platform/request";
import { HttpError } from "@/platform/http";
import { integrationScopes } from "@/platform/integration-auth";
import { auditChange } from "@/platform/events";
export async function accessList(context: Context) {
  requirePermission(context, "tenant.configure");
  return db
    .select({
      id: apiAccess.id,
      label: apiAccess.label,
      departmentId: apiAccess.departmentId,
      userId: apiAccess.userId,
      scopes: apiAccess.scopes,
      expiresAt: apiAccess.expiresAt,
      revokedAt: apiAccess.revokedAt,
      lastUsedAt: apiAccess.lastUsedAt,
      createdAt: apiAccess.createdAt,
    })
    .from(apiAccess)
    .orderBy(desc(apiAccess.createdAt))
    .limit(200);
}
export async function accessAction(context: Context, input: unknown) {
  requirePermission(context, "tenant.configure");
  const body = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("create"),
        label: z.string().trim().min(2).max(100),
        scopes: z.array(z.enum(integrationScopes)).min(1).max(10),
        expiresInDays: z.number().int().min(1).max(90),
      }),
      z.object({ action: z.literal("revoke"), id: z.string() }),
    ])
    .parse(input);
  if (body.action === "revoke") {
    const [entry] = await db
      .update(apiAccess)
      .set({ revokedAt: new Date() })
      .where(eq(apiAccess.id, body.id))
      .returning({ id: apiAccess.id });
    if (!entry) throw new HttpError(404, "API-Zugang nicht gefunden.");
    await auditChange(db as never, context, "api-access.revoked", entry.id);
    return { revoked: true };
  }
  const token = "st_" + randomBytes(32).toString("base64url"),
    expiresAt = new Date(Date.now() + body.expiresInDays * 86400000);
  const [access] = await db
    .insert(apiAccess)
    .values({
      organizationId: context.organizationId,
      departmentId: context.departmentId,
      userId: context.user.id,
      label: body.label,
      scopes: [...new Set(body.scopes)],
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
    })
    .returning({ id: apiAccess.id, label: apiAccess.label, expiresAt: apiAccess.expiresAt });
  await auditChange(db as never, context, "api-access.created", access.id);
  return { ...access, token };
}
export async function integrationRate(context: Context) {
  const access = currentRequest().integration;
  if (!access) return;
  const key = "rate:" + access.id + ":" + Math.floor(Date.now() / 60000);
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + key}))`);
  const [meter] = await db
    .select()
    .from(integrationReceipts)
    .where(eq(integrationReceipts.operationKey, key))
    .limit(1)
    .for("update");
  if (Number(meter?.result.count || 0) >= 120)
    throw new HttpError(429, "API-Limit erreicht. Warte eine Minute.", { retryAfter: 60 });
  if (meter)
    await db
      .update(integrationReceipts)
      .set({ result: { count: Number(meter.result.count) + 1 } })
      .where(eq(integrationReceipts.id, meter.id));
  else
    await db.insert(integrationReceipts).values({
      organizationId: context.organizationId,
      accessId: access.id,
      operationKey: key,
      requestHash: "rate",
      result: { count: 1 },
    });
  await db.update(apiAccess).set({ lastUsedAt: new Date() }).where(eq(apiAccess.id, access.id));
}
export async function repeatable<T extends Record<string, unknown>>(
  context: Context,
  key: string,
  body: unknown,
  run: () => Promise<T>,
): Promise<T> {
  const access = currentRequest().integration?.id || "user:" + context.user.id;
  const operationKey = access + ":" + key;
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + operationKey}))`,
  );
  const [previous] = await db
    .select()
    .from(integrationReceipts)
    .where(eq(integrationReceipts.operationKey, operationKey))
    .limit(1);
  if (previous) {
    if (previous.requestHash !== hash)
      throw new HttpError(409, "Dieser Wiederholschlüssel gehört zu einer anderen Anfrage.");
    return previous.result as T;
  }
  const result = await run();
  await db.insert(integrationReceipts).values({
    organizationId: context.organizationId,
    accessId: currentRequest().integration?.id || null,
    operationKey,
    requestHash: hash,
    result,
  });
  return result;
}
