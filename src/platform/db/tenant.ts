import { sql } from "drizzle-orm";
import { appDatabase, workerDb } from "./connections";
import { requestScope, currentRequest } from "../request";
import type { Context } from "../context";
import type { Transaction } from "./index";
export async function tenantTransaction<T>(
  context: Context,
  work: () => Promise<T>,
  worker = false,
) {
  const parent = currentRequest();
  return (worker ? workerDb : appDatabase).transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.tenant_id',${context.organizationId},true),set_config('app.user_id',${context.user.id},true),set_config('app.department_id',${context.departmentId},true)`,
    );
    return requestScope.run({ ...parent, context, transaction: tx as Transaction }, work);
  });
}
