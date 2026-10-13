import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import postgres from "postgres";
const environment = process.argv[2];
if (!["development", "preview", "production"].includes(environment))
  throw new Error("Explicit Showtime environment required");
const apply = process.argv.includes("--apply");
const runtime = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
if (new URL(runtime.WORKER_DATABASE_URL).username !== "showtime_worker")
  throw new Error("Showtime worker role required");
const sql = postgres(runtime.WORKER_DATABASE_URL, { max: 1, prepare: false });
const cataloguePath = `.local/backup-catalogue-${environment}.json`;
const catalogue = fs.existsSync(cataloguePath)
  ? JSON.parse(fs.readFileSync(cataloguePath, "utf8"))
  : [];
const intendedRoot = path.resolve(".local/backups");
let eligible = 0,
  removed = 0,
  held = 0,
  unconfirmed = 0;
try {
  for (const item of catalogue) {
    if (item.removedAt) continue;
    if (!item.expiresAt || !Number.isFinite(Date.parse(item.expiresAt))) {
      unconfirmed++;
      continue;
    }
    if (Date.parse(item.expiresAt) > Date.now()) continue;
    const absolute = path.resolve(item.path);
    if (!absolute.startsWith(intendedRoot + path.sep))
      throw new Error("Backup deletion target must stay inside Showtime .local/backups");
    const legalHold = await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${String(item.organizationId)},true)`;
      const rows =
        await tx`select id from privacy_entries where kind='hold' and status in ('open','verified') and (nullif(data->>'until','') is null or nullif(data->>'until','')::timestamptz>now()) limit 1`;
      return rows.length > 0;
    });
    if (legalHold) {
      held++;
      continue;
    }
    if (!fs.existsSync(absolute)) {
      item.removedAt = new Date().toISOString();
      item.missing = true;
      continue;
    }
    const real = fs.realpathSync(absolute);
    if (!real.startsWith(fs.realpathSync(intendedRoot) + path.sep))
      throw new Error("Resolved backup path leaves intended directory");
    if (createHash("sha256").update(fs.readFileSync(real)).digest("hex") !== item.digest)
      throw new Error("Backup digest changed; manual review required");
    eligible++;
    if (apply) {
      fs.unlinkSync(real);
      item.removedAt = new Date().toISOString();
      removed++;
    }
  }
  if (apply) fs.writeFileSync(cataloguePath, JSON.stringify(catalogue, null, 2));
  console.log(
    JSON.stringify({ environment, dryRun: !apply, eligible, removed, held, unconfirmed }),
  );
} finally {
  await sql.end();
}
