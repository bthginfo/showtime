import { recoverTenants } from "@/platform/events/worker";
import { route } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request }) =>
  route(async () => {
    if (
      !process.env.CRON_SECRET ||
      request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
    )
      return Response.json({ error: "Keine Berechtigung." }, { status: 401 });
    return Response.json(await recoverTenants(request));
  });
