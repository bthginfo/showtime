const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { route, assertOrigin } from "@/platform/http";
import { getFile, deleteFile } from "@/modules/files/service";
type Props = { params: Promise<{ id: string }> };
async function legacyGET(_request: Request, { params }: Props) {
  return route(async () => {
    const { row, blob } = await getFile(await requireContext(), (await params).id);
    const name = String(row.data.name).replace(/[\r\n"\\]/g, "_");
    return new Response(blob.stream, {
      headers: {
        "Content-Type": String(row.data.mime),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  });
}
async function legacyDELETE(request: Request, { params }: Props) {
  return route(async () => {
    assertOrigin(request);
    await deleteFile(await requireContext(true), (await params).id);
    return NextResponse.json({ ok: true });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) =>
  legacyGET(request, { params: Promise.resolve(params as never) });
export const DELETE: RequestHandler = ({ request, params }) =>
  legacyDELETE(request, { params: Promise.resolve(params as never) });
