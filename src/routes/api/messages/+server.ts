import { getTableColumns } from "drizzle-orm";
import { pageTimestamp } from "@/platform/db/page-timestamp";
import { and, eq, gt, desc, isNull, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/platform/db";
import { records } from "@/platform/db/schema";
import { requireContext } from "@/platform/context";
import { route, HttpError } from "@/platform/http";
import { decodePosition, encodePosition } from "@/platform/pagination";
import { assertProject, serialize } from "@/modules/records/repository";
import { assertConversation } from "@/modules/chat/permissions";
import { assertRead } from "@/modules/records/service";
import { anyPermission } from "@/shared/access-policy";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ url }) =>
  route(async () => {
    const context = await requireContext(),
      params = url.searchParams;
    const productionId = z
        .string()
        .max(100)
        .parse(params.get("productionId") || ""),
      conversationId = z
        .string()
        .max(100)
        .parse(params.get("conversationId") || "");
    if (productionId && conversationId) throw new HttpError(400, "Bitte wähle genau einen Chat.");
    if (!anyPermission(context.user, "chat.read")) throw new HttpError(403, "Kein Chat-Zugriff.");
    if (conversationId) await assertConversation(context, conversationId);
    if (productionId) await assertProject(context, productionId);
    const purpose = `messages:${productionId}:${conversationId}`,
      position = decodePosition(params.get("cursor"), context, purpose);
    const after = params.get("after");
    if (after) z.iso.datetime().parse(after);
    const limit = 100;
    const list = await db
      .select({ ...getTableColumns(records), positionAt: pageTimestamp(records.createdAt) })
      .from(records)
      .where(
        and(
          eq(records.organizationId, context.organizationId),
          eq(records.kind, "messages"),
          productionId ? eq(records.productionId, productionId) : isNull(records.productionId),
          sql`coalesce(${records.data}->>'conversationId','')=${conversationId}`,
          !productionId && !conversationId
            ? eq(records.departmentId, context.departmentId)
            : undefined,
          after ? gt(records.updatedAt, new Date(after)) : undefined,
          position
            ? sql`(${records.createdAt},${records.id})<(${position[0]},${position[1]})`
            : undefined,
        ),
      )
      .orderBy(desc(records.createdAt), desc(records.id))
      .limit(limit + 1);
    const messages = list.slice(0, limit);
    for (const message of messages) await assertRead(context, message);
    const files = messages.length
      ? await db
          .select()
          .from(records)
          .where(
            and(
              eq(records.organizationId, context.organizationId),
              eq(records.kind, "files"),
              inArray(
                sql<string>`${records.data}->>'recordId'`,
                messages.map((m) => m.id),
              ),
            ),
          )
      : [];
    return Response.json(
      {
        messages: messages.map(serialize).reverse(),
        files: files
          .filter((f) => !f.data.pendingDeletionOperation)
          .map((f) => ({ ...serialize(f), data: { ...f.data, path: undefined } })),
        nextCursor:
          list.length > limit
            ? encodePosition([messages.at(-1)!.positionAt, messages.at(-1)!.id], context, purpose)
            : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
