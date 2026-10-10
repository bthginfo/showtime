import { recordPage } from "@/modules/records/pages";
import { z } from "zod";
const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import { recordKinds } from "@/shared/contracts";
import { saveRecord } from "@/modules/records/service";
async function legacyPOST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  return route(async () => {
    const kind = z.enum(recordKinds).parse((await params).kind);
    const body = z
      .object({
        data: z.record(z.string(), z.unknown()),
        idempotencyKey: z.string().max(100).optional(),
      })
      .parse(await readJson(request));
    return NextResponse.json(
      await saveRecord(await requireContext(true), kind, {
        ...body.data,
        ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
      }),
      { status: 201 },
    );
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) =>
  legacyPOST(request, { params: Promise.resolve(params as never) });

export const GET: RequestHandler = ({ params, url }) =>
  route(async () =>
    Response.json(
      await recordPage(await requireContext(), z.enum(recordKinds).parse(params.kind), {
        cursor: url.searchParams.get("cursor"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    ),
  );
