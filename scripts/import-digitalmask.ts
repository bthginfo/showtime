import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { get, put } from "@vercel/blob";
import {
  migratedId,
  migratedRoles,
  prepareMigration,
  type DigitalMaskSnapshot,
  type MigrationRow,
} from "../src/platform/migration/digitalmask";

const [environment, snapshotPath, organizationId, actorId, apply] = process.argv.slice(2);
if (
  !["development", "production"].includes(environment) ||
  !snapshotPath ||
  !organizationId ||
  !actorId
)
  throw new Error("Explicit environment, private snapshot, destination theater and actor required");
const runtime = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
const sourceRuntime = JSON.parse(
  fs.readFileSync(".local/digitalmask-source-production-runtime.json", "utf8"),
);
if (runtime.BLOB_READ_WRITE_TOKEN === sourceRuntime.BLOB_READ_WRITE_TOKEN)
  throw new Error("Separate source and destination Blob stores required");
Object.assign(process.env, runtime);
const snapshot: DigitalMaskSnapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const auth = postgres(runtime.AUTH_DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const control = postgres(runtime.CONTROL_DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
const worker = postgres(runtime.WORKER_DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
let stage = "preflight";
try {
  for (const db of [auth, control, worker]) {
    const [role] =
      await db`select not rolsuper and not rolbypassrls as restricted from pg_roles where rolname=current_user`;
    if (!role.restricted) throw new Error("Restricted runtime roles required");
  }
  const [tenant] =
    await control`select o.id,o.name,t.slug from organizations o join tenant_settings t on t.organization_id=o.id where o.id=${organizationId}`;
  if (!tenant || (environment === "production" && tenant.slug !== "stadttheater-ingolstadt"))
    throw new Error("Destination theater mismatch");
  const [actor] = await auth`select id from app_user where id=${actorId}`;
  if (!actor) throw new Error("Destination actor missing");
  const [department] =
    await control`select id from departments where organization_id=${organizationId} and name='Maske'`;
  if (!department) throw new Error("Destination makeup department missing");
  const { ids, remap } = prepareMigration(snapshot, organizationId, department.id);
  const files = snapshot.tables.records.filter((r) => r.kind === "files");
  const sourceUsers = snapshot.tables.app_user;
  const counts = Object.fromEntries(
    Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length]),
  );
  if (apply !== "--apply") {
    console.log(
      JSON.stringify({
        dryRun: true,
        environment,
        counts,
        files: files.length,
        isolatedDestination: true,
      }),
    );
  } else {
    stage = "authentication";
    const users: MigrationRow[] = [];
    for (const source of sourceUsers) {
      const person = remap(source);
      const [collision] =
        await auth`select id from app_user where username=${person.username} and id<>${person.id}`;
      if (collision) person.username = ("dm." + person.username).slice(0, 32);
      const [emailCollision] =
        await auth`select id from app_user where email=${person.email} and id<>${person.id}`;
      if (emailCollision) person.email = `${person.id}@imports.showtime.invalid`;
      users.push(person);
    }
    await auth.begin(async (tx) => {
      for (const person of users)
        await tx`insert into app_user ${tx(person)} on conflict(id) do nothing`;
      for (const row of snapshot.tables.app_account)
        await tx`insert into app_account ${tx(remap(row))} on conflict(id) do nothing`;
      for (const row of snapshot.tables.profile_preferences) {
        const preference = remap(row);
        delete preference.working_time;
        await tx`insert into profile_preferences ${tx(preference)} on conflict(user_id) do nothing`;
      }
    });
    fs.writeFileSync(
      `.local/digitalmask-identities-${environment}.json`,
      JSON.stringify(
        users.map((u, i) => ({
          id: u.id,
          username: u.username,
          sourceUsername: sourceUsers[i].username,
          name: u.name,
        })),
        null,
        2,
      ),
    );
    stage = "explicit-memberships";
    await control.begin(async (tx) => {
      for (const source of snapshot.tables.memberships) {
        const row = remap(source);
        await tx`insert into tenant_members(organization_id,user_id,status) values(${organizationId},${row.user_id},${row.status}) on conflict(organization_id,user_id) do nothing`;
        await tx`insert into memberships ${tx({ ...row, role: "user" })} on conflict(user_id,department_id) do nothing`;
        for (const role of migratedRoles(source.role)) {
          const id = migratedId(organizationId, `grant:${source.user_id}:${role}`);
          await tx`insert into permission_grants(id,organization_id,user_id,role,scope,scope_id) values(${id},${organizationId},${row.user_id},${role},'department',${department.id}) on conflict(id) do nothing`;
        }
      }
      await tx`insert into tenant_members(organization_id,user_id,status) values(${organizationId},${actorId},'active') on conflict(organization_id,user_id) do nothing`;
      const trades = await tx`select id from departments where organization_id=${organizationId}`;
      for (const trade of trades)
        await tx`insert into memberships(id,organization_id,user_id,department_id,role,status) values(${migratedId(organizationId, `actor:${actorId}:${trade.id}`)},${organizationId},${actorId},${trade.id},'user','active') on conflict(user_id,department_id) do nothing`;
      for (const role of [
        "theater_admin",
        "employee",
        "team_lead",
        "production_lead",
        "disposition",
        "technical_lead",
        "intendance",
        "personnel",
        "costume_specialist",
      ]) {
        await tx`insert into permission_grants(id,organization_id,user_id,role,scope,scope_id) values(${migratedId(organizationId, `actor:${actorId}:${role}`)},${organizationId},${actorId},${role},'tenant',null) on conflict(id) do nothing`;
      }
    });
    stage = "private-files";
    const cache = `.local/import-digitalmask-${organizationId}`;
    fs.mkdirSync(cache, { recursive: true });
    const blobMap = new Map<string, string>();
    let verifiedBytes = 0;
    for (const [index, file] of files.entries()) {
      const destinationId = ids.get(file.id)!;
      const originalPath = String(file.data.path);
      const originalDepartment = snapshot.tables.departments[0].id;
      if (!originalPath.startsWith(`${snapshot.tables.organizations[0].id}/${originalDepartment}/`))
        throw new Error("Source file scope mismatch");
      const localFile = path.join(cache, destinationId + ".bin");
      if (!fs.existsSync(localFile)) {
        const blob = await get(originalPath, {
          access: "private",
          token: sourceRuntime.BLOB_READ_WRITE_TOKEN,
        });
        if (!blob || blob.statusCode !== 200) throw new Error("Source private file missing");
        fs.writeFileSync(localFile, Buffer.from(await new Response(blob.stream).arrayBuffer()));
      }
      const bytes = fs.readFileSync(localFile);
      const destinationPath = `${organizationId}/${department.id}/digitalmask/${destinationId}${path.extname(originalPath)}`;
      blobMap.set(originalPath, destinationPath);
      const receiptPath = localFile + ".receipt.json";
      const hash = createHash("sha256").update(bytes).digest("hex");
      const receipt = fs.existsSync(receiptPath)
        ? JSON.parse(fs.readFileSync(receiptPath, "utf8"))
        : null;
      if (receipt?.hash !== hash || receipt?.path !== destinationPath) {
        await put(destinationPath, bytes, {
          access: "private",
          contentType: file.data.mime,
          addRandomSuffix: false,
          allowOverwrite: true,
          token: runtime.BLOB_READ_WRITE_TOKEN,
        });
        const copied = await get(destinationPath, {
          access: "private",
          token: runtime.BLOB_READ_WRITE_TOKEN,
        });
        if (!copied || copied.statusCode !== 200)
          throw new Error("Copied private file unavailable");
        const copiedHash = createHash("sha256")
          .update(Buffer.from(await new Response(copied.stream).arrayBuffer()))
          .digest("hex");
        if (copiedHash !== hash) throw new Error("Private file integrity mismatch");
        fs.writeFileSync(receiptPath, JSON.stringify({ path: destinationPath, hash }));
      }
      verifiedBytes += bytes.length;
      if ((index + 1) % 20 === 0)
        console.log(JSON.stringify({ stage, filesCompleted: index + 1, totalFiles: files.length }));
    }
    for (const [before, after] of blobMap) ids.set(before, after);
    stage = "business-transaction";
    await worker.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${organizationId},true),set_config('app.user_id',${actorId},true),set_config('app.department_id',${department.id},true)`;
      const templates =
        await tx`select id,kind,data from records where department_id=${department.id} and kind in ('calendarCategories','categories')`;
      for (const source of snapshot.tables.records.filter((r) =>
        ["calendarCategories", "categories"].includes(r.kind),
      )) {
        const previous = templates.find(
          (t) =>
            t.kind === source.kind &&
            t.data.key === source.data.key &&
            (source.kind !== "categories" || t.data.scope === source.data.scope),
        );
        if (previous) ids.set(source.id, previous.id);
      }
      const ordered = [
        ...snapshot.tables.records.filter((r) => r.kind === "productions"),
        ...snapshot.tables.records.filter((r) => r.kind !== "productions"),
      ];
      for (let offset = 0; offset < ordered.length; offset += 100) {
        const rows = ordered.slice(offset, offset + 100).map((source) => remap(source));
        await tx`insert into records ${tx(rows)} on conflict(id) do update set data=excluded.data,created_by=excluded.created_by,created_at=excluded.created_at,updated_at=excluded.updated_at,version=excluded.version where records.id like 'template:%' and records.kind in ('categories','calendarCategories') and records.created_by=${actorId}`;
      }
      // A retry also repairs composite keys created by an earlier importer without replacing
      // current chat content, membership or manually edited rows.
      for (const conversation of ordered.filter(r => r.kind === "conversations" && r.data.mode === "direct")) {
        const target = remap(conversation);
        await tx`update records set data=jsonb_set(data,'{directKey}',to_jsonb(${String(target.data.directKey)}::text)),version=version+1,updated_at=now() where id=${target.id} and data->>'directKey'=${String(conversation.data.directKey)} and data->>'directKey'<>${String(target.data.directKey)}`;
      }
      for (const table of [
        "collaborative_documents",
        "record_history",
        "record_operations",
        "audit",
        "outbox",
      ] as const) {
        for (const source of snapshot.tables[table] || []) {
          const row = { ...remap(source), organization_id: organizationId };
          if (table === "outbox") {
            row.payload = { ...row.payload, importedFrom: "DigitalMask", sourceStatus: row.status };
            row.status = "done";
          }
          if (table === "record_operations") row.undo_payload = null;
          const key = table === "collaborative_documents" ? "file_id" : "id";
          await tx`insert into ${tx(table)} ${tx(row)} on conflict(${tx(key)}) do nothing`;
        }
      }
      for (const preference of snapshot.tables.profile_preferences)
        if (preference.working_time) {
          const row = {
            id: migratedId(organizationId, "working-time:" + preference.user_id),
            organization_id: organizationId,
            user_id: ids.get(preference.user_id)!,
            working_time: preference.working_time,
            updated_at: preference.updated_at,
          };
          await tx`insert into tenant_profiles ${tx(row)} on conflict(organization_id,user_id) do nothing`;
        }
      const [saved] =
        await tx`select count(*)::integer as count from records where id=any(${ordered.map((r) => ids.get(r.id)!)}::text[])`;
      if (saved.count !== ordered.length) throw new Error("Imported graph count mismatch");
      const eventId = migratedId(organizationId, "digitalmask-import:" + snapshot.createdAt);
      await tx`insert into outbox(id,organization_id,department_id,type,payload) values(${eventId},${organizationId},${department.id},'TenantDataImportedV1',${tx.json({ schemaVersion: 1, actorId, organizationId, recordCount: ordered.length, aggregateId: organizationId, aggregateVersion: 1 })}) on conflict(id) do nothing`;
      // Rebuild new trade workspaces from fresh pointers; historical events stay archival.
      for (const production of ordered.filter((r) => r.kind === "productions")) {
        const recordId = ids.get(production.id)!;
        const pointerId = migratedId(organizationId, "digitalmask-projection:" + recordId);
        await tx`insert into outbox(id,organization_id,department_id,type,payload) values(${pointerId},${organizationId},${department.id},'ProductionCreatedV1',${tx.json({ schemaVersion: 1, actorId, organizationId, recordId, aggregateId: recordId, aggregateVersion: production.version })}) on conflict(id) do nothing`;
      }
    });
    await control`update tenant_settings set permission_version=permission_version+1,settings=jsonb_set(settings,'{digitalMaskImport}',${control.json({ source: "DigitalMask", snapshotAt: snapshot.createdAt, importedAt: new Date().toISOString(), recordCount: snapshot.tables.records.length, fileCount: files.length })}),updated_at=now() where organization_id=${organizationId}`;
    const evidence = {
      success: true,
      environment,
      organizationId,
      sourceSnapshotAt: snapshot.createdAt,
      records: snapshot.tables.records.length,
      files: files.length,
      verifiedBytes,
      users: users.length,
      nativeDocuments: snapshot.tables.collaborative_documents.length,
      audit: snapshot.tables.audit.length,
      archivedEvents: snapshot.tables.outbox.length,
      isolatedBlobStore: true,
      sourceReadOnly: true,
    };
    fs.writeFileSync(
      `.local/digitalmask-import-evidence-${environment}.json`,
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  }
} catch (error) {
  console.error(
    JSON.stringify({
      success: false,
      stage,
      name: error instanceof Error ? error.name : "unknown",
      code: (error as { code?: string }).code,
      detailsOmitted: true,
    }),
  );
  process.exitCode = 1;
} finally {
  await Promise.all([auth.end(), control.end(), worker.end()]);
}
