const NextResponse = Response;
import { eq, desc } from "drizzle-orm";
import { db } from "@/platform/db";
import { recordHistory } from "@/platform/db/schema";
import { requireContext } from "@/platform/context";
import { findRecord } from "@/modules/records/repository";
import { assertRead } from "@/modules/records/service";
import { route } from "@/platform/http";
async function legacyGET(request: Request) {
  return route(async () => {
    const context = await requireContext();
    const record = await findRecord(context, new URL(request.url).searchParams.get("id") || "");
    await assertRead(context, record);
    const versions = await db
      .select()
      .from(recordHistory)
      .where(eq(recordHistory.recordId, record.id))
      .orderBy(desc(recordHistory.version))
      .limit(50);
    const permitted = [];
    for (const version of versions) {
      try {
        await assertRead(context, {
          ...record,
          data: version.data,
          productionId: String(version.data.productionId || "") || null,
        });
        permitted.push(version);
      } catch (error) {
        if (!(
          error instanceof Error &&
          "status" in error &&
          [403, 404].includes(Number(error.status))
        ))
          throw error;
      }
    }
    return NextResponse.json(
      { versions: permitted },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) => legacyGET(request);
