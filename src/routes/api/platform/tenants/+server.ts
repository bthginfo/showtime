import { controlDb } from "@/platform/db/connections";
import {
  organizations,
  tenantSettings,
  departments,
  tenantMembers,
  permissionGrants,
} from "@/platform/db/schema";
import { db } from "@/platform/db";
import { runWorkerScope } from "@/platform/events/worker";
import { auditChange } from "@/platform/events";
import type { Context } from "@/platform/context";
import { eq, sql, and, asc } from "drizzle-orm";
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
          version: tenantSettings.permissionVersion,
          memberCount: sql<number>`(select count(*)::integer from ${tenantMembers} where ${tenantMembers.organizationId} = ${organizations.id} and ${tenantMembers.status} = 'active')`,
          departmentCount: sql<number>`(select count(*)::integer from ${departments} where ${departments.organizationId} = ${organizations.id})`,
          administratorCount: sql<number>`(select count(distinct ${permissionGrants.userId})::integer from ${permissionGrants} inner join ${tenantMembers} on ${tenantMembers.organizationId}=${permissionGrants.organizationId} and ${tenantMembers.userId}=${permissionGrants.userId} where ${permissionGrants.organizationId}=${organizations.id} and ${permissionGrants.role}='theater_admin' and ${permissionGrants.scope}='tenant' and ${tenantMembers.status}='active' and (${permissionGrants.expiresAt} is null or ${permissionGrants.expiresAt}>now()))`,
        })
        .from(organizations)
        .innerJoin(tenantSettings, eq(tenantSettings.organizationId, organizations.id))
        .orderBy(asc(organizations.name))
        .limit(500),
    );
  });
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const admin = await requirePlatformAdmin();
    const input = z
      .object({
        name: z.string(),
        slug: z.string(),
        administrator: z.enum(["invite", "self"]).default("invite"),
      })
      .parse(await readJson(request));
    return Response.json(
      await createTenant(input, input.administrator === "self" ? admin.id : undefined, admin.id),
      {
        status: 201,
      },
    );
  });
export const PATCH: RequestHandler = ({ request }) =>
  route(async () => {
    const operator = await requirePlatformAdmin();
    const input = z
      .object({
        id: z.string(),
        status: z.enum(["active", "disabled"]),
        expectedVersion: z.number().int().positive().optional(),
      })
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
        .where(
          and(
            eq(tenantSettings.organizationId, input.id),
            input.expectedVersion
              ? eq(tenantSettings.permissionVersion, input.expectedVersion)
              : undefined,
          ),
        )
        .returning();
      if (!saved)
        throw new HttpError(
          409,
          "Das Theater wurde inzwischen geändert. Aktualisiere die Übersicht und prüfe den aktuellen Status.",
        );
      await auditChange(db as never, context, "tenant." + input.status, input.id);
      return Response.json({ id: saved.organizationId, status: saved.status });
    });
  });
