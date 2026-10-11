import { and, eq, sql } from "drizzle-orm";
import { db, type Transaction } from "@/platform/db";
import { tradeItems, moduleActivations, tenantSettings } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { can } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { assertProject } from "@/modules/records/repository";
import { moduleById } from "./registry";
export const defaultRequired = [
  "stage",
  "lighting",
  "sound",
  "costume",
  "makeup",
  "props",
  "stage-management",
];
export async function productionReadiness(
  context: Context,
  productionId: string,
  tx: Transaction | typeof db = db,
  performanceId?: string,
) {
  await assertProject(context, productionId, tx);
  if (!can(context, "production.read", productionId))
    throw new HttpError(403, "Keine Berechtigung für diese Produktion.");
  const [settings] = await tx.select().from(tenantSettings).limit(1);
  const [modules, workspaces] = await Promise.all([
    tx.select().from(moduleActivations).where(eq(moduleActivations.enabled, true)),
    tx.select().from(tradeItems).where(eq(tradeItems.productionId, productionId)),
  ]);
  return readinessSnapshot(
    productionId,
    modules,
    workspaces,
    settings?.settings || {},
    performanceId,
  );
}
export function readinessSnapshot(
  productionId: string,
  modules: { moduleId: string; config: Record<string, unknown> }[],
  entries: (typeof tradeItems.$inferSelect)[],
  configuration: Record<string, unknown>,
  performanceId?: string,
) {
  const workspaces = entries.filter((e) => e.productionId === productionId);
  const policies = (configuration.readinessPolicies || {}) as Record<
    string,
    {
      required: string[];
      waivers: { moduleId: string; reason: string; expiresAt: string; approvedBy: string }[];
    }
  >;
  const policy = policies[performanceId || ""] || policies[productionId];
  const required =
    policy?.required ||
    (Array.isArray(configuration.requiredReadinessModules)
      ? (configuration.requiredReadinessModules as string[])
      : defaultRequired);
  return modules
    .filter((module) =>
      moduleById(module.moduleId)?.features.some((feature) => feature.id === "readiness"),
    )
    .map((module) => {
      const current = workspaces
        .filter(
          (w) =>
            w.moduleId === module.moduleId &&
            w.type === "readiness" &&
            !["archived", "cancelled"].includes(w.status) &&
            (performanceId
              ? w.performanceId === performanceId ||
                w.data.performanceId === performanceId ||
                (!w.performanceId && !w.data.performanceId)
              : !w.performanceId && !w.data.performanceId),
        )
        .sort((a, b) => {
          const exact = (item: typeof a) =>
            performanceId &&
            (item.performanceId === performanceId || item.data.performanceId === performanceId)
              ? 1
              : 0;
          return exact(b) - exact(a) || b.updatedAt.getTime() - a.updatedAt.getTime();
        })[0];
      const checked = (current?.data._checkedSources || {}) as Record<string, number>;
      const sources = workspaces.filter(
        (w) =>
          w.moduleId === module.moduleId &&
          !["readiness", "workspace", "collaboration"].includes(w.type) &&
          !moduleById(w.moduleId)?.features.find((f) => f.id === w.type)?.private &&
          !["archived", "cancelled"].includes(w.status),
      );
      const stale =
        !!current &&
        (sources.length !== Object.keys(checked).length ||
          sources.some((source) => checked[source.id] !== source.version));
      const waiver = policy?.waivers?.find(
        (w) => w.moduleId === module.moduleId && Date.parse(w.expiresAt) > Date.now(),
      );
      return {
        moduleId: module.moduleId,
        departmentId: String(module.config.departmentId || ""),
        label: moduleById(module.moduleId)?.label || module.moduleId,
        required: required.includes(module.moduleId),
        ready: !!waiver || (!!current && current.data.ready === true && !stale),
        stale,
        waiver: waiver
          ? { reason: waiver.reason, expiresAt: waiver.expiresAt, approvedBy: waiver.approvedBy }
          : null,
        version: current?.version || 0,
        updatedAt: current?.updatedAt || null,
      };
    });
}
export async function assertStageReady(context: Context, productionId: string, stage: string) {
  if (!["dress-rehearsal", "performance"].includes(stage)) return;
  const readiness = await productionReadiness(context, productionId);
  if (readiness.some((r) => r.required && !r.ready))
    throw new HttpError(
      409,
      "Die erforderlichen Gewerke haben ihre Bereitschaft noch nicht bestätigt.",
    );
}
export async function dependencyCheck(
  context: Context,
  ids: string[],
  itemId: string | undefined,
  productionId: string | undefined,
  status: string,
  tx: Transaction,
) {
  if (ids.includes(itemId || ""))
    throw new HttpError(400, "Ein Eintrag kann nicht von sich selbst abhängen.");
  if (!ids.length) return;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":trade-dependencies"}))`,
  );
  const entries = await tx.select().from(tradeItems);
  const seen = new Set<string>();
  const visit = (id: string, depth = 0) => {
    if (id === itemId || depth > 50)
      throw new HttpError(400, "Abhängigkeiten dürfen keinen Kreis bilden.");
    if (seen.has(id)) return;
    seen.add(id);
    const found = entries.find((e) => e.id === id);
    if (!found || found.productionId !== (productionId || null))
      throw new HttpError(400, "Eine Abhängigkeit gehört nicht zu dieser Produktion.");
    if (moduleById(found.moduleId)?.features.find((f) => f.id === found.type)?.private)
      throw new HttpError(
        400,
        "Private Fachinformationen können keine sichtbare Produktionsabhängigkeit sein.",
      );
    for (const parent of Array.isArray(found.data.dependencyIds)
      ? (found.data.dependencyIds as string[])
      : [])
      visit(parent, depth + 1);
  };
  for (const id of ids) visit(id);
  if (
    ["ready", "done"].includes(status) &&
    ids.some((id) => !["ready", "done"].includes(entries.find((e) => e.id === id)!.status))
  )
    throw new HttpError(409, "Eine erforderliche Vorarbeit ist noch nicht abgeschlossen.");
}
