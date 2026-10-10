import fs from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
const environment = process.argv[2] || "development";
if (!["development", "preview", "production"].includes(environment))
  throw new Error("Unknown environment");
const ownerPath = `.local/.env.owner-${environment}`;
if (!fs.existsSync(ownerPath)) {
  const pulled = environment === "development" ? ".env.local" : `.local/.env.${environment}`;
  fs.copyFileSync(pulled, ownerPath);
}
const env = parseEnv(fs.readFileSync(ownerPath, "utf8"));
const owner = env.DATABASE_URL || env.POSTGRES_URL;
if (!owner || !owner.includes("neon.tech"))
  throw new Error("Separate Neon owner credentials required");
const sql = postgres(owner, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  const roleNames = ["showtime_app", "showtime_auth", "showtime_worker", "showtime_control"];
  const runtimePath = `.local/runtime-${environment}.json`;
  const runtime = fs.existsSync(runtimePath)
    ? JSON.parse(fs.readFileSync(runtimePath, "utf8"))
    : {};
  for (const role of roleNames) {
    const key =
      role === "showtime_app"
        ? "APP_DATABASE_URL"
        : role === "showtime_auth"
          ? "AUTH_DATABASE_URL"
          : role === "showtime_worker"
            ? "WORKER_DATABASE_URL"
            : "CONTROL_DATABASE_URL";
    const password = runtime[key]
      ? decodeURIComponent(new URL(runtime[key]).password)
      : randomBytes(32).toString("hex");
    const [exists] = await sql`select 1 from pg_roles where rolname=${role}`;
    if (exists && !runtime[key])
      throw new Error(
        "Existing runtime role credentials are missing; restore the private runtime file before migrating.",
      );
    if (!exists)
      await sql.unsafe(
        `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`,
      );
    const url = new URL(owner);
    url.username = role;
    url.password = password;
    runtime[key] = url.toString();
  }
  const [secured] =
    await sql`select 1 from pg_policies where policyname='tenant_scope' and tablename='records'`;
  if (!secured) await sql.unsafe(fs.readFileSync("scripts/tenant-security.sql", "utf8"));
  await sql.unsafe(fs.readFileSync("scripts/tenant-upgrade.sql", "utf8"));
  runtime.BETTER_AUTH_SECRET ||= randomBytes(48).toString("hex");
  runtime.CRON_SECRET ||= randomBytes(32).toString("hex");
  runtime.BETTER_AUTH_URL ||=
    environment === "development"
      ? "http://127.0.0.1:3100"
      : "https://showtime-ingolstadt.vercel.app";
  runtime.APP_URL = runtime.BETTER_AUTH_URL;
  if (env.BLOB_READ_WRITE_TOKEN) runtime.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;
  fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2));
  if (environment === "development")
    fs.writeFileSync(
      ".env.local",
      Object.entries(runtime)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join("\n") + "\n",
    );
  console.log(
    JSON.stringify({ environment, migrated: true, roles: roleNames, secretsStoredLocally: true }),
  );
} finally {
  await sql.end();
}
