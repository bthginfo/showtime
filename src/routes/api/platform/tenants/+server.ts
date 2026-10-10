import { controlDb } from "@/platform/db/connections";
import { organizations, tenantSettings, departments } from "@/platform/db/schema";
import { db } from "@/platform/db";
import { runWorkerScope } from "@/platform/events/worker";
import { auditChange } from "@/platform/events";
import type { Context } from "@/platform/context";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requirePlatformAdmin, createTenant } from "@/modules/theater/tenants";
import { route, readJson, HttpError } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = () =>
  route(async () => {
    await requirePlatformAdmin();
    return Response.json(
      await controlDb
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: tenantSettings.slug,
          status: tenantSettings.status,
        })
        .from(organizations)
        .innerJoin(tenantSettings, eq(tenantSettings.organizationId, organizations.id))
        .limit(500),
    );
  });
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const admin = await requirePlatformAdmin();
    return Response.json(await createTenant(await readJson(request), undefined, admin.id), {
      status: 201,
    });
  });
export const PATCH: RequestHandler = ({ request }) =>
  route(async () => {
    const operator = await requirePlatformAdmin();
    const input = z
      .object({ id: z.string(), status: z.enum(["active", "disabled"]) })
      .parse(await readJson(request));
    const [department] = await controlDb
      .select()
      .from(departments)
      .where(eq(departments.organizationId, input.id))
      .limit(1);
    if (!department) throw new HttpError(404, "Theater nicht gefunden.");
    const context: Context = {
      organizationId: input.id,
      departmentId: department.id,
      organizationName: "",
      departmentName: "",
      grants: [],
      user: {
        id: operator.id,
        name: operator.name,
        username: operator.username || "",
        role: "user",
        status: "active",
      },
    };
    return runWorkerScope(request, context, async () => {
      const [saved] = await db
        .update(tenantSettings)
        .set({
          status: input.status,
          permissionVersion: sql`${tenantSettings.permissionVersion}+1`,
        })
        .where(eq(tenantSettings.organizationId, input.id))
        .returning();
      await auditChange(db as never, context, "tenant." + input.status, input.id);
      return Response.json({ id: saved.organizationId, status: saved.status });
    });
  });
