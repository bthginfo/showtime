import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import postgres from "postgres";
import { get, put } from "@vercel/blob";
type Row = Record<string, unknown>;
type Archive = {
  version: 1;
  environment: string;
  organizationId: string;
  createdAt: string;
  tables: Record<string, Row[]>;
  blobs: { path: string; mime: string; hash: string; bytes: string }[];
};
const controlTables = [
  "organizations",
  "departments",
  "tenant_settings",
  "tenant_members",
  "memberships",
  "permission_grants",
  "module_activations",
];
const businessTables = [
  "records",
  "theater_works",
  "theater_seasons",
  "theater_productions",
  "production_runs",
  "performances",
  "venue_resources",
  "resource_bookings",
  "trade_items",
  "trade_item_history",
  "tenant_profiles",
  "collaborative_documents",
  "document_buffers",
  "document_updates",
  "record_history",
  "record_operations",
  "outbox",
  "event_receipts",
  "audit",
  "support_requests",
];
function clients(environment: string) {
  if (!["development", "preview", "production"].includes(environment))
    throw new Error("Explicit Showtime environment required");
  const env = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
  if (
    new URL(env.WORKER_DATABASE_URL).username !== "showtime_worker" ||
    new URL(env.CONTROL_DATABASE_URL).username !== "showtime_control"
  )
    throw new Error("Scoped Showtime runtime roles required");
  return {
    env,
    worker: postgres(env.WORKER_DATABASE_URL, { max: 1, prepare: false }),
    control: postgres(env.CONTROL_DATABASE_URL, { max: 1, prepare: false }),
    auth: postgres(env.AUTH_DATABASE_URL, { max: 1, prepare: false }),
  };
}
function seal(value: Archive, key: Buffer) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("Showtime backup v1"));
  const bytes = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(value)))),
    cipher.final(),
  ]);
  return Buffer.concat([Buffer.from("SHOWTIME1"), nonce, cipher.getAuthTag(), bytes]);
}
function open(bytes: Buffer, key: Buffer): Archive {
  if (bytes.subarray(0, 9).toString() !== "SHOWTIME1") throw new Error("Unknown backup format");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(9, 21));
  decipher.setAAD(Buffer.from("Showtime backup v1"));
  decipher.setAuthTag(bytes.subarray(21, 37));
  const data = JSON.parse(
    gunzipSync(Buffer.concat([decipher.update(bytes.subarray(37)), decipher.final()])).toString(),
  );
  if (data.version !== 1) throw new Error("Unknown backup version");
  return data;
}
const summary = (tables: Record<string, Row[]>) =>
  Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
export async function backupTenant(
  environment: string,
  organizationId: string,
  archivePath: string,
  key: Buffer,
) {
  if (key.length !== 32) throw new Error("Backup key must have 32 bytes");
  const { worker, control, auth, env } = clients(environment);
  try {
    const archive: Archive = {
      version: 1,
      environment,
      organizationId,
      createdAt: new Date().toISOString(),
      tables: {},
      blobs: [],
    };
    // Repeatable read keeps the business graph, document logs and event receipts consistent.
    await worker.begin("isolation level repeatable read", async (tx) => {
      await tx`select set_config('app.tenant_id',${organizationId},true)`;
      const organizations = await tx`select * from organizations where id=${organizationId}`;
      if (organizations.length !== 1) throw new Error("Tenant not found");
      archive.tables.organizations = organizations;
      for (const table of [...controlTables.slice(1), ...businessTables])
        archive.tables[table] =
          await tx`select * from ${tx(table)} where organization_id=${organizationId}`;
      for (const file of archive.tables.records.filter((row) => row.kind === "files")) {
        const data = file.data as Row;
        const blobPath = String(data.path || "");
        if (!blobPath.startsWith(organizationId + "/"))
          throw new Error("Unexpected file tenant prefix");
        const blob = await get(blobPath, { access: "private", token: env.BLOB_READ_WRITE_TOKEN });
        if (!blob || blob.statusCode !== 200)
          throw new Error("A referenced private file is missing");
        const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
        archive.blobs.push({
          path: blobPath,
          mime: String(data.mime || "application/octet-stream"),
          hash: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.toString("base64"),
        });
      }
    });
    fs.mkdirSync(path.dirname(path.resolve(archivePath)), { recursive: true });
    fs.writeFileSync(archivePath, seal(archive, key), { flag: "wx" });
    return {
      organizationId,
      createdAt: archive.createdAt,
      counts: summary(archive.tables),
      files: archive.blobs.length,
      encrypted: true,
    };
  } finally {
    await Promise.all([worker.end(), control.end(), auth.end()]);
  }
}
export async function restoreTenant(
  environment: string,
  archivePath: string,
  key: Buffer,
  name: string,
  slug: string,
) {
  if (!name.trim() || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))
    throw new Error("New theater name and slug required");
  const archive = open(fs.readFileSync(archivePath), key);
  const { worker, control, auth, env } = clients(environment);
  const organizationId = randomUUID(),
    ids = new Map<string, string>([[archive.organizationId, organizationId]]);
  try {
    for (const rows of Object.values(archive.tables))
      for (const row of rows)
        if (typeof row.id === "string" && !ids.has(row.id)) ids.set(row.id, randomUUID());
    for (const id of ids.keys())
      if (id.startsWith("workspace:")) {
        const [, productionId, moduleId] = id.split(":");
        ids.set(id, `workspace:${ids.get(productionId) || productionId}:${moduleId}`);
      }
    // Global authentication accounts remain separate and must already exist in the destination.
    for (const member of archive.tables.tenant_members) {
      const found = await auth`select id from app_user where id=${String(member.user_id)}`;
      if (found.length !== 1)
        throw new Error(
          "Restore requires an existing destination account for each tenant identity",
        );
    }
    const paths = new Map<string, string>();
    for (const blob of archive.blobs) {
      const bytes = Buffer.from(blob.bytes, "base64");
      if (createHash("sha256").update(bytes).digest("hex") !== blob.hash)
        throw new Error("Backup file checksum mismatch");
      let target = blob.path;
      for (const [oldId, newId] of ids) target = target.replaceAll(oldId, newId);
      if (!target.startsWith(organizationId + "/")) throw new Error("Invalid destination prefix");
      await put(target, bytes, {
        access: "private",
        token: env.BLOB_READ_WRITE_TOKEN,
        contentType: blob.mime,
        addRandomSuffix: false,
      });
      paths.set(blob.path, target);
    }
    function remap(value: unknown): unknown {
      if (typeof value === "string") {
        if (paths.has(value)) return paths.get(value);
        if (ids.has(value)) return ids.get(value);
        let text = value;
        if (text.startsWith("/?")) {
          for (const [oldId, newId] of ids) text = text.replaceAll(oldId, newId);
        }
        return text;
      }
      if (Array.isArray(value)) return value.map(remap);
      if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)]));
      return value;
    }
    const tables = Object.fromEntries(
      Object.entries(archive.tables).map(([table, rows]) => [
        table,
        rows.map((row) => remap(row) as Row),
      ]),
    );
    tables.organizations[0].name = name;
    tables.tenant_settings[0].slug = slug;
    tables.tenant_settings[0].status = "disabled";
    tables.tenant_settings[0].permission_version =
      Number(tables.tenant_settings[0].permission_version) + 1;
    for (const row of tables.outbox)
      if (row.status !== "done") {
        row.status = "failed";
        row.attempts = 6;
      }
    for (const row of tables.record_operations) {
      row.undo_payload = null;
      row.expires_at = new Date(0).toISOString();
    }
    const insert = async (tx: postgres.TransactionSql, table: string, rows: Row[]) => {
      for (let offset = 0; offset < rows.length; offset += 300)
        await tx`insert into ${tx(table)} ${tx(rows.slice(offset, offset + 300))}`;
    };
    await control.begin(async (tx) => {
      for (const table of controlTables) await insert(tx, table, tables[table] || []);
    });
    await worker.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${organizationId},true)`;
      // Self-referencing records are inserted together so parent/production references resolve.
      const rows = tables.records || [];
      const original = rows.map((row) => ({
        row,
        productionId: row.production_id,
        parentId: row.parent_id,
      }));
      await insert(
        tx,
        "records",
        rows.map((row) => ({ ...row, production_id: null, parent_id: null })),
      );
      for (const entry of original)
        if (entry.productionId || entry.parentId)
          await tx`update records set production_id=${entry.productionId as string | null},parent_id=${entry.parentId as string | null} where id=${String(entry.row.id)}`;
      for (const table of businessTables.filter((t) => t !== "records"))
        await insert(tx, table, tables[table] || []);
      for (const table of businessTables) {
        const [count] =
          await tx`select count(*)::int as count from ${tx(table)} where organization_id=${organizationId}`;
        if (count.count !== (tables[table] || []).length)
          throw new Error("Restore count mismatch: " + table);
      }
    });
    await control`update tenant_settings set status='active' where organization_id=${organizationId}`;
    return {
      organizationId,
      sourceOrganizationId: archive.organizationId,
      counts: summary(tables),
      files: archive.blobs.length,
      verified: true,
    };
  } finally {
    await Promise.all([worker.end(), control.end(), auth.end()]);
  }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/tenant-backup.ts")) {
  const [action, environment, tenantOrArchive, destination, name, slug] = process.argv.slice(2);
  const keyPath = process.env.SHOWTIME_BACKUP_KEY_FILE || ".local/backup-key";
  if (action === "backup" && !fs.existsSync(keyPath))
    fs.writeFileSync(keyPath, randomBytes(32), { flag: "wx" });
  const key = fs.readFileSync(keyPath);
  try {
    const result =
      action === "backup"
        ? await backupTenant(environment, tenantOrArchive, destination, key)
        : action === "restore"
          ? await restoreTenant(environment, tenantOrArchive, key, destination, name)
          : null;
    if (!result)
      throw new Error(
        "Usage: backup <environment> <tenant> <archive> | restore <environment> <archive> <new name> <new slug>",
      );
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(
      JSON.stringify({
        failed: true,
        message: error instanceof Error ? error.message : "Backup operation failed",
      }),
    );
    process.exitCode = 1;
  }
}
