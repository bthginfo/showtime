import type { RequestHandler } from "@sveltejs/kit";
import { requirePlatformAdmin, completeTenantSetup } from "@/modules/theater/tenants";
import { route, readJson } from "@/platform/http";

export const POST: RequestHandler = ({ request, params }) =>
  route(async () => {
    const person = await requirePlatformAdmin();
    await readJson(request);
    await completeTenantSetup(params.id!, person.id);
    return Response.json({ ok: true });
  });
