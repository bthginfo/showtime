import { createHash } from "node:crypto";
import type { TheaterRole } from "@/platform/access";
export type MigrationRow = Record<string, any>;
export interface DigitalMaskSnapshot {
  source: string;
  createdAt: string;
  tables: Record<string, MigrationRow[]>;
}

/** Stable, destination-specific IDs make retries safe and prevent cross-tenant references. */
export function migratedId(organizationId: string, sourceId: string) {
  const hex = createHash("sha256")
    .update(`digitalmask:${organizationId}:${sourceId}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function remapData(value: unknown, ids: Map<string, string>): any {
  if (typeof value === "string") {
    if (ids.has(value)) return ids.get(value)!;
    if (/^\/(?:\?|api\/)/.test(value)) {
      const url = new URL(value, "https://showtime.invalid");
      url.pathname = url.pathname.split("/").map(part => ids.get(part) || part).join("/");
      for (const [key, id] of url.searchParams)
        if (ids.has(id)) url.searchParams.set(key, ids.get(id)!);
      return url.pathname + url.search + url.hash;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => remapData(item, ids));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        // Direct-chat identity is derived from the two members, rather than a free-text field.
        if (key === "directKey" && typeof item === "string") {
          const members = item.split(":");
          if (members.length === 2 && members.every(id => ids.has(id)))
            return [key, members.map(id => ids.get(id)!).sort().join(":")];
        }
        return [ids.get(key) || key, remapData(item, ids)];
      }),
    );
  return value;
}

export function migratedRoles(legacyRole: string): TheaterRole[] {
  if (legacyRole === "superadmin")
    return [
      "employee",
      "team_lead",
      "production_lead",
      "theater_admin",
      "costume_specialist",
      "personnel",
    ];
  if (legacyRole === "admin")
    return ["employee", "team_lead", "production_lead", "costume_specialist"];
  return ["employee"];
}

export function prepareMigration(
  snapshot: DigitalMaskSnapshot,
  organizationId: string,
  departmentId: string,
) {
  if (
    snapshot.source !== "DigitalMask production" ||
    snapshot.tables.organizations?.length !== 1 ||
    snapshot.tables.departments?.length !== 1
  )
    throw new Error("A single verified DigitalMask theater and department is required");
  const ids = new Map<string, string>();
  for (const rows of Object.values(snapshot.tables))
    for (const row of rows) {
      for (const key of ["id", "file_id", "record_id"])
        if (typeof row[key] === "string" && row[key])
          ids.set(row[key], migratedId(organizationId, row[key]));
    }
  ids.set(snapshot.tables.organizations[0].id, organizationId);
  ids.set(snapshot.tables.departments[0].id, departmentId);
  return { ids, remap: (value: unknown) => remapData(value, ids) };
}
