import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { requireContext, requirePermission } from "@/platform/context";
import { route, assertOrigin, HttpError } from "@/platform/http";
import { showtechMetadata } from "@/modules/theater/showtech";
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    assertOrigin(request);
    const context = await requireContext();
    requirePermission(context, "inventory.manage");
    const form = await request.formData(),
      file = form.get("file"),
      format = z.enum(["mvr", "gdtf"]).parse(form.get("format"));
    if (!(file instanceof File)) throw new HttpError(400, "Wähle eine Archivdatei.");
    return Response.json(showtechMetadata(new Uint8Array(await file.arrayBuffer()), format));
  });
