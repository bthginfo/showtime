import { eq } from "drizzle-orm";
import { identity, availableScopes, effectiveGrants } from "@/platform/context";
import { authDb } from "@/platform/db/connections";
import { platformAdmins } from "@/platform/db/schema";
import { route } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = () =>
  route(async () => {
    const person = await identity();
    const list = await availableScopes(person.id);
    const allowed = new Set<string>();
    for (const id of new Set(list.map((s) => s.organizationId)))
      if ((await effectiveGrants(person.id, id, list)).length) allowed.add(id);
    const scopes = list.filter((s) => allowed.has(s.organizationId));
    const [platform] = await authDb
      .select()
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, person.id))
      .limit(1);
    return Response.json({
      scopes,
      platformAdmin: !!platform,
      user: { id: person.id, name: person.name },
    });
  });
