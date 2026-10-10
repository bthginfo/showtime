import { z } from "zod";
const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { readJson, route, assertOrigin, HttpError } from "@/platform/http";
import { recordKinds } from "@/shared/contracts";
import { saveRecord, deleteRecord } from "@/modules/records/service";
type Props = { params: Promise<{ kind: string; id: string }> };
async function legacyPATCH(request: Request, { params }: Props) {
  return route(async () => {
    const p = await params;
    const kind = z.enum(recordKinds).parse(p.kind);
    const body = z
      .object({ data: z.record(z.string(), z.unknown()), version: z.number().int().positive() })
      .parse(await readJson(request));
    return NextResponse.json(
      await saveRecord(await requireContext(true), kind, body.data, p.id, body.version),
    );
  });
}
async function legacyDELETE(request: Request, { params }: Props) {
  return route(async () => {
    assertOrigin(request);
    const p = await params;
    const kind = z.enum(recordKinds).parse(p.kind);
    const version = new URL(request.url).searchParams.get("version");
    if (["time", "attendance"].includes(kind) && !version)
      throw new HttpError(400, "Die Version der Buchung fehlt.");
    await deleteRecord(await requireContext(true), kind, p.id, {
      ...(version ? { version: z.coerce.number().int().positive().parse(version) } : {}),
    });
    return NextResponse.json({ ok: true });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const PATCH: RequestHandler = ({ request, params }) =>
  legacyPATCH(request, { params: Promise.resolve(params as never) });
export const DELETE: RequestHandler = ({ request, params }) =>
  legacyDELETE(request, { params: Promise.resolve(params as never) });
