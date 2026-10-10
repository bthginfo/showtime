import { workerSql } from "@/platform/db/connections";
import { db } from "@/platform/db";
import { departments } from "@/platform/db/schema";
import { eq } from "drizzle-orm";
import { tenantTransaction } from "@/platform/db/tenant";
import { requestScope, type RequestScope } from "@/platform/request";
import type { Context } from "@/platform/context";
import { processEvents } from "./index";
import { publishEvents } from "./transport";
import { checkpointDirtyDocuments } from "@/modules/documents/service";
export async function runWorkerScope<T>(request: Request, context: Context, run: () => Promise<T>) {
  const scope: RequestScope = { request, after: [] };
  return requestScope.run(scope, async () => {
    const result = await tenantTransaction(context, run, true);
    for (let index = 0; index < scope.after.length; index++)
      await tenantTransaction(context, async () => scope.after[index](), true);
    return result;
  });
}
export async function recoverTenants(request: Request) {
  const [savedCursor] = await workerSql<
    { last_tenant: string }[]
  >`select last_tenant from showtime_recovery_cursor where id='tenant-recovery'`;
  let tenants = await workerSql<
    { organization_id: string }[]
  >`select * from showtime_due_tenants(${savedCursor?.last_tenant || ""},25)`;
  if (!tenants.length)
    tenants = await workerSql<
      { organization_id: string }[]
    >`select * from showtime_due_tenants('',25)`;
  const deadline = Date.now() + 75000;
  let visited = 0;
  let processed = 0,
    saved = 0,
    failed = 0;
  for (const tenant of tenants) {
    if (Date.now() > deadline) break;
    visited++;
    const context: Context = {
      organizationId: tenant.organization_id,
      departmentId: "",
      organizationName: "",
      departmentName: "",
      user: { id: "worker", name: "Worker", username: "", status: "active", role: "user" },
      grants: [],
    };
    try {
      await runWorkerScope(request, context, async () => {
        const [department] = await db.select().from(departments).limit(1);
        if (!department) return;
        context.departmentId = department.id;
        const events = process.env.VERCEL ? await publishEvents() : await processEvents();
        processed += "processed" in events ? events.processed : events.published;
        const documents = await checkpointDirtyDocuments();
        saved += documents.saved;
        failed += documents.failed;
      });
    } catch {
      failed++;
      console.error("Tenant recovery deferred");
    }
    await workerSql`update showtime_recovery_cursor set last_tenant=${tenant.organization_id},updated_at=now() where id='tenant-recovery'`;
  }
  return { tenants: visited, processed, documents: { saved, failed } };
}
