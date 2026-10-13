import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { desc, eq, and, sql } from "drizzle-orm";
import { controlDb } from "@/platform/db/connections";
import { supportRequests, organizations, departments } from "@/platform/db/schema";
import { db } from "@/platform/db";
import { runWorkerScope } from "@/platform/events/worker";
import { auditChange } from "@/platform/events";
import type { Context } from "@/platform/context";
import { requirePlatformAdmin } from "@/modules/theater/tenants";
import { route, readJson, HttpError } from "@/platform/http";
export const GET: RequestHandler = ({ request }) =>
  route(async () => {
    const operator = await requirePlatformAdmin();
    const entries = await controlDb
      .select({
        id: supportRequests.id,
        organizationId: supportRequests.organizationId,
        theater: organizations.name,
        title: supportRequests.title,
        description: supportRequests.description,
        type: supportRequests.type,
        status: supportRequests.status,
        version: supportRequests.version,
        createdAt: supportRequests.createdAt,
      })
      .from(supportRequests)
      .innerJoin(organizations, eq(organizations.id, supportRequests.organizationId))
      .orderBy(desc(supportRequests.updatedAt))
      .limit(300);
    const theaterIds = [...new Set(entries.map((entry) => entry.organizationId))];
    for (const organizationId of theaterIds) {
      const [department] = await controlDb
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.organizationId, organizationId))
        .limit(1);
      if (!department) continue;
      const context: Context = {
        organizationId,
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
      // This receipt is one request, under a fresh MFA session, solely for content
      // deliberately forwarded by its author. No persistent private access grant.
      await runWorkerScope(request, context, () =>
        db.transaction((tx) => auditChange(tx, context, "support.forwarded-list.read")),
      );
    }
    return Response.json(entries);
  });
export const PATCH: RequestHandler = ({ request }) =>
  route(async () => {
    const operator = await requirePlatformAdmin();
    const input = z
      .object({
        id: z.string(),
        version: z.number().int().positive(),
        status: z.enum(["new", "review", "planned", "doing", "done", "closed"]),
      })
      .parse(await readJson(request));
    const [entry] = await controlDb
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.id, input.id))
      .limit(1);
    if (!entry) throw new HttpError(404, "Supportanfrage nicht gefunden.");
    const [department] = await controlDb
      .select()
      .from(departments)
      .where(eq(departments.organizationId, entry.organizationId))
      .limit(1);
    const context: Context = {
      organizationId: entry.organizationId,
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
        .update(supportRequests)
        .set({
          status: input.status,
          version: sql`${supportRequests.version}+1`,
          updatedAt: new Date(),
        })
        .where(and(eq(supportRequests.id, input.id), eq(supportRequests.version, input.version)))
        .returning();
      if (!saved) throw new HttpError(409, "Die Supportanfrage wurde inzwischen geändert.");
      await auditChange(
        db as never,
        context,
        "support.status." + input.status,
        entry.sourceRecordId,
      );
      return Response.json({ id: saved.id, status: saved.status, version: saved.version });
    });
  });
