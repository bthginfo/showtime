import type { RequestHandler } from "@sveltejs/kit";
import { randomBytes, createHash } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { requirePlatformAdmin } from "@/modules/theater/tenants";
import { controlDb } from "@/platform/db/connections";
import { invitations, departments, tenantSettings } from "@/platform/db/schema";
import { applicationURL } from "@/platform/application-url";
import { route, readJson, HttpError } from "@/platform/http";

export const POST: RequestHandler = ({ request, params }) =>
  route(async () => {
    const person = await requirePlatformAdmin();
    await readJson(request);
    return controlDb.transaction(async (tx) => {
      const [setting] = await tx
        .select()
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, params.id!))
        .limit(1)
        .for("update");
      if (!setting) throw new HttpError(404, "Theater nicht gefunden.");
      if (setting.status !== "active")
        throw new HttpError(
          409,
          "Das Theater muss für eine Einladung aktiv und vollständig eingerichtet sein.",
        );
      const [department] = await tx
        .select()
        .from(departments)
        .where(eq(departments.organizationId, params.id!))
        .limit(1);
      if (!department) throw new HttpError(409, "Richte zuerst die Gewerke ein.");
      await tx
        .update(invitations)
        .set({ expiresAt: new Date() })
        .where(
          and(
            eq(invitations.organizationId, params.id!),
            eq(invitations.role, "theater_admin"),
            isNull(invitations.usedAt),
          ),
        );
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      await tx
        .insert(invitations)
        .values({
          organizationId: params.id!,
          departmentId: department.id,
          role: "theater_admin",
          tokenHash: createHash("sha256").update(token).digest("hex"),
          createdBy: person.id,
          expiresAt,
        });
      return Response.json({
        url: `${applicationURL()}/register?invitation=${token}`,
        expiresAt: expiresAt.toISOString(),
      });
    });
  });
