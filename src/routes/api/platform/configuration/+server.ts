import { db } from "@/platform/db";
import {
  departments,
  permissionGrants,
  tenantSettings,
  moduleActivations,
  audit,
  tenantMembers,
  user,
  outbox,
} from "@/platform/db/schema";
import { requireContext, requirePermission } from "@/platform/context";
import { route, readJson } from "@/platform/http";
import { tenantConfiguration } from "@/modules/theater/tenants";
import { desc, eq } from "drizzle-orm";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = () =>
  route(async () => {
    const context = await requireContext();
    requirePermission(context, "tenant.configure");
    const [gewerke, grants, settings, modules, members, history, events] = await Promise.all([
      db.select().from(departments),
      db.select().from(permissionGrants),
      db.select().from(tenantSettings),
      db.select().from(moduleActivations),
      db
        .select({
          userId: tenantMembers.userId,
          status: tenantMembers.status,
          name: user.name,
          username: user.username,
        })
        .from(tenantMembers)
        .innerJoin(user, eq(user.id, tenantMembers.userId)),
      db.select().from(audit).orderBy(desc(audit.createdAt)).limit(100),
      db
        .select({
          id: outbox.id,
          type: outbox.type,
          status: outbox.status,
          attempts: outbox.attempts,
          availableAt: outbox.availableAt,
        })
        .from(outbox)
        .orderBy(desc(outbox.createdAt))
        .limit(100),
    ]);
    return Response.json({
      departments: gewerke,
      grants,
      settings: settings[0],
      modules,
      members,
      audit: history,
      events,
    });
  });
export const POST: RequestHandler = ({ request }) =>
  route(async () =>
    Response.json(await tenantConfiguration(await requireContext(), await readJson(request))),
  );
