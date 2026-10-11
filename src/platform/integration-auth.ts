import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authDb } from "./db/connections";
import { apiAccess, user } from "./db/schema";
import { currentRequest } from "./request";
import { HttpError } from "./http";
export const integrationScopes = [
  "trade:read",
  "trade:write",
  "records:read",
  "records:write",
  "calendar:read",
  "calendar:write",
  "ticketing:write",
  "time:read",
  "finance:read",
  "resources:read",
] as const;
export async function integrationIdentity() {
  const scope = currentRequest(),
    request = scope.request;
  if (!new URL(request.url).pathname.startsWith("/api/v1/")) return null;
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const token = authorization.match(/^Bearer (st_[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new HttpError(401, "Ungültiger API-Zugang.");
  const [access] = await authDb
    .select()
    .from(apiAccess)
    .innerJoin(user, eq(user.id, apiAccess.userId))
    .where(
      and(
        eq(apiAccess.tokenHash, createHash("sha256").update(token).digest("hex")),
        isNull(apiAccess.revokedAt),
        gt(apiAccess.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!access) throw new HttpError(401, "Der API-Zugang ist abgelaufen oder widerrufen.");
  scope.integration = { id: access.api_access.id, scopes: access.api_access.scopes };
  return {
    person: access.app_user,
    selection: access.api_access.organizationId + ":" + access.api_access.departmentId,
  };
}
export function requireIntegrationScope(name: (typeof integrationScopes)[number]) {
  const integration = currentRequest().integration;
  if (integration && !integration.scopes.includes(name))
    throw new HttpError(403, "Dieser API-Zugang erlaubt den angeforderten Datenbereich nicht.");
}
