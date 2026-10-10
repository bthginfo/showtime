import { eq, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import { tenantSettings } from "@/platform/db/schema";
import { after, currentRequest } from "@/platform/request";
export const liveConfigured = () => !!process.env.APP_DATABASE_URL;
export function scheduleLiveChange(_departmentId: string) {
  const tenantId = currentRequest().context?.organizationId;
  if (!tenantId) return;
  after(async () => {
    await db
      .update(tenantSettings)
      .set({ liveRevision: sql`${tenantSettings.liveRevision}+1` })
      .where(eq(tenantSettings.organizationId, tenantId));
  });
}
