import { eq, and } from "drizzle-orm";
import { authDb } from "./db/connections";
import { calendarTokens, user, permissionGrants } from "./db/schema";
import { availableScopes, effectiveGrants, type Context } from "./context";
import { allowedPermissions, type Grant } from "./access";
import { HttpError } from "./http";
import { createHash } from "node:crypto";
export async function calendarContext(token: string): Promise<Context> {
  if (token.length > 100) throw new HttpError(404, "Kalender nicht gefunden.");
  const [row] = await authDb
    .select()
    .from(calendarTokens)
    .where(eq(calendarTokens.tokenHash, createHash("sha256").update(token).digest("hex")))
    .limit(1);
  if (!row) throw new HttpError(404, "Kalender nicht gefunden.");
  const scope = (await availableScopes(row.userId)).find(
    (s) =>
      s.organizationId === row.organizationId &&
      s.departmentId === row.departmentId &&
      s.status === "active",
  );
  if (!scope) throw new HttpError(404, "Kalender nicht gefunden.");
  const [person] = await authDb.select().from(user).where(eq(user.id, row.userId)).limit(1);
  const grants = await effectiveGrants(row.userId, row.organizationId);
  if (!grants.length) throw new HttpError(404, "Kalender nicht gefunden.");
  return {
    ...scope,
    grants,
    user: {
      id: person.id,
      name: person.name,
      username: person.username || "",
      departmentId: scope.departmentId,
      role: "user",
      status: "active",
      grants,
      permissions: allowedPermissions(
        { id: person.id, grants },
        { departmentId: scope.departmentId },
      ),
    },
  };
}
