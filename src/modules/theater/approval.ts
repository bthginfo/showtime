import { createHash } from "node:crypto";
import { moduleById } from "./registry";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}
export type ApprovalSource = {
  moduleId: string;
  type: string;
  title: string;
  productionId?: string | null;
  data: Record<string, unknown>;
};
export function approvalContentHash(source: ApprovalSource): string {
  const data = Object.fromEntries(
    Object.entries(source.data).filter(
      ([key]) => !["_approval", "approval", "accepted", "eventId"].includes(key),
    ),
  );
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          moduleId: source.moduleId,
          type: source.type,
          title: source.title,
          productionId: source.productionId || null,
          data,
        }),
      ),
    )
    .digest("hex");
}
export function verifiedApproval(source: ApprovalSource) {
  const approval = source.data._approval as
    { contentHash?: string; approvedBy?: string; approvedAt?: string } | undefined;
  return (
    !!approval?.approvedBy &&
    !!approval.approvedAt &&
    approval.contentHash === approvalContentHash(source)
  );
}
export async function approvalCurrent(
  source: ApprovalSource,
  tx: import("@/platform/db").Transaction | typeof import("@/platform/db").db,
) {
  if (!verifiedApproval(source)) return false;
  const refs = (source.data._referenceVersions || {}) as Record<string, number>;
  if (!Object.keys(refs).length) return true;
  const { tradeItems } = await import("@/platform/db/schema"),
    { inArray } = await import("drizzle-orm");
  const rows = await tx
    .select({ id: tradeItems.id, version: tradeItems.version, status: tradeItems.status })
    .from(tradeItems)
    .where(inArray(tradeItems.id, Object.keys(refs)));
  return (
    rows.length === Object.keys(refs).length &&
    rows.every(
      (row) => row.version === refs[row.id] && !["archived", "cancelled"].includes(row.status),
    )
  );
}
export function sourceReviewSnapshot(source: ApprovalSource & { version: number }) {
  const feature = moduleById(source.moduleId)?.features.find(
    (feature) => feature.id === source.type,
  );
  return {
    moduleId: source.moduleId,
    type: source.type,
    title: source.title,
    version: source.version,
    fields: (feature?.fields || [])
      .filter((field) => !field.managed)
      .map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        value: source.data[field.key] ?? null,
      })),
  };
}
