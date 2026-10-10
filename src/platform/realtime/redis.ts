import { eq } from "drizzle-orm";
import { db } from "@/platform/db";
import { tenantSettings, documentBuffers } from "@/platform/db/schema";
/** Compatibility seam for document capabilities; PostgreSQL is the sole live store. */
export const permissionEpochKey = (departmentId: string) => departmentId;
export function liveRedis() {
  return {
    async get<T>(_key: string): Promise<T | null> {
      const [row] = await db.select().from(tenantSettings).limit(1);
      return String(row?.permissionVersion || 1) as T;
    },
    async smembers<T>(_key: string): Promise<T> {
      const rows = await db
        .select({ id: documentBuffers.fileId })
        .from(documentBuffers)
        .where(eq(documentBuffers.dirty, true))
        .limit(40);
      return rows.map((r) => r.id) as T;
    },
  };
}
