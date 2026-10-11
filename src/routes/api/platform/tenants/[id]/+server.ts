import type { RequestHandler } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { controlDb } from "@/platform/db/connections";
import { departments, tenantSettings, moduleActivations } from "@/platform/db/schema";
import { requirePlatformAdmin } from "@/modules/theater/tenants";
import { route, HttpError } from "@/platform/http";

export const GET: RequestHandler = ({ params }) =>
  route(async () => {
    await requirePlatformAdmin();
    const [settings] = await controlDb
      .select({ timezone: tenantSettings.timezone })
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, params.id!));
    if (!settings) throw new HttpError(404, "Theater nicht gefunden.");
    const trades = await controlDb
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.organizationId, params.id!));
    const modules = await controlDb
      .select({ id: moduleActivations.moduleId, enabled: moduleActivations.enabled })
      .from(moduleActivations)
      .where(eq(moduleActivations.organizationId, params.id!));
    return Response.json({ ...settings, departments: trades, modules });
  });
