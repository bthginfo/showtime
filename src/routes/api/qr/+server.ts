import { applicationURL } from "@/platform/application-url";
import QRCode from "qrcode";
import { requireContext } from "@/platform/context";
import { findRecord } from "@/modules/records/repository";
import { assertRead } from "@/modules/records/service";
import { route } from "@/platform/http";
async function legacyGET(request: Request) {
  return route(async () => {
    const context = await requireContext();
    const query = new URL(request.url).searchParams;
    const row = await findRecord(context, query.get("id") || "");
    await assertRead(context, row);
    const url = `${applicationURL() || new URL(request.url).origin}/?module=${row.kind === "materials" ? "inventory" : "documentation"}&record=${row.id}`;
    const svg = await QRCode.toString(url, {
      type: "svg",
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300" },
    });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) => legacyGET(request);
