import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { requireContext } from "@/platform/context";
import { route, readJson, HttpError } from "@/platform/http";
import { db } from "@/platform/db";
import { supportRequests } from "@/platform/db/schema";
import { findRecord } from "@/modules/records/repository";
import { assertRead, assertWrite } from "@/modules/records/service";
import { auditChange } from "@/platform/events";
export const GET: RequestHandler = () =>
  route(async () => {
    const context = await requireContext();
    return Response.json(
      await db.select().from(supportRequests).where(eq(supportRequests.userId, context.user.id)),
    );
  });
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const context = await requireContext();
    const input = z
      .object({ id: z.string(), consent: z.literal(true) })
      .parse(await readJson(request));
    const source = await findRecord(context, input.id, "feedback", db, true);
    await assertRead(context, source);
    assertWrite(context, "feedback", source);
    if (source.data.userId !== context.user.id)
      throw new HttpError(403, "Du kannst nur deine eigene Rückmeldung weitergeben.");
    const content = {
      title: String(source.data.title),
      description: String(source.data.description),
      type: String(source.data.type),
    };
    const [entry] = await db
      .insert(supportRequests)
      .values({ sourceRecordId: source.id, userId: context.user.id, ...content })
      .onConflictDoUpdate({
        target: [supportRequests.organizationId, supportRequests.sourceRecordId],
        set: { ...content, version: sql`${supportRequests.version}+1`, updatedAt: new Date() },
      })
      .returning();
    await auditChange(db as never, context, "support.forwarded", source.id);
    return Response.json(entry, { status: 201 });
  });
