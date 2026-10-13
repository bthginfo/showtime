import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { Context } from "@/platform/context";
import { allowedPermissions, type Grant } from "@/platform/access";
describe.skipIf(process.env.SHOWTIME_INTEGRATION !== "development")(
  "real calendar and privacy boundaries",
  () => {
    let auth: ReturnType<typeof postgres>,
      control: ReturnType<typeof postgres>,
      worker: ReturnType<typeof postgres>;
    let a: Context,
      b: Context,
      reader: Context,
      person: string,
      colleague: string,
      production: string,
      eventId: string,
      fileId: string;
    let run: <T>(ctx: Context, work: () => Promise<T>) => Promise<T>;
    let db: typeof import("@/platform/db").db;
    let tables: typeof import("@/platform/db/schema");
    let op: typeof import("drizzle-orm");
    const tenants: string[] = [];
    beforeAll(async () => {
      const runtime = JSON.parse(fs.readFileSync(".local/runtime-development.json", "utf8"));
      Object.assign(process.env, runtime);
      auth = postgres(runtime.AUTH_DATABASE_URL, { max: 1, prepare: false });
      control = postgres(runtime.CONTROL_DATABASE_URL, { max: 1, prepare: false });
      worker = postgres(runtime.WORKER_DATABASE_URL, { max: 1, prepare: false });
      person = randomUUID();
      colleague = randomUUID();
      await auth`insert into app_user(id,name,email,username) values(${person},'QA Privacy Operator',${person + "@qa.showtime.invalid"},${"qa-" + person}),(${colleague},'QA Calendar Member',${colleague + "@qa.showtime.invalid"},${"qa-" + colleague})`;
      db = (await import("@/platform/db")).db;
      tables = await import("@/platform/db/schema");
      op = await import("drizzle-orm");
      const { requestScope } = await import("@/platform/request");
      const { tenantTransaction } = await import("@/platform/db/tenant");
      run = (ctx, work) =>
        requestScope.run(
          { request: new Request("http://127.0.0.1:3100/qa"), context: ctx, after: [] },
          () => tenantTransaction(ctx, work),
        );
      const { createTenant } = await import("@/modules/theater/tenants");
      async function tenant() {
        const t = await createTenant(
          { name: "QA Privacy " + randomUUID().slice(0, 6), slug: "qa-" + randomUUID() },
          person,
        );
        tenants.push(t.id);
        const departmentId = t.departments.find((d) => d.name === "Maske")!.id;
        const grants: Grant[] = [
          { role: "team_lead", scope: "tenant", scopeId: null },
          { role: "production_lead", scope: "tenant", scopeId: null },
          { role: "theater_admin", scope: "tenant", scopeId: null },
        ];
        return {
          organizationId: t.id,
          organizationName: t.name,
          departmentId,
          departmentName: "Maske",
          grants,
          user: {
            id: person,
            name: "QA Operator",
            username: "qa",
            role: "admin",
            status: "active",
            departmentId,
            grants,
            permissions: allowedPermissions({ id: person, grants }, { departmentId }),
          },
        } as Context;
      }
      a = await tenant();
      b = await tenant();
      await control`insert into tenant_members(organization_id,user_id,status) values(${a.organizationId},${colleague},'active')`;
      await control`insert into memberships(id,organization_id,department_id,user_id,role,status) values(${randomUUID()},${a.organizationId},${a.departmentId},${colleague},'user','active')`;
      const grants: Grant[] = [{ role: "employee", scope: "department", scopeId: a.departmentId }];
      reader = {
        ...a,
        grants,
        user: {
          ...a.user,
          id: colleague,
          role: "user",
          grants,
          permissions: allowedPermissions(
            { id: colleague, grants },
            { departmentId: a.departmentId },
          ),
        },
      };
      const { saveRecord } = await import("@/modules/records/service");
      production = (
        await run(a, () =>
          saveRecord(a, "productions", {
            title: "QA Private Piece",
            color: "#537fba",
            season: "2026/2027",
            premiere: "2026-11-12",
            status: "active",
            memberIds: [person],
            contacts: [],
          }),
        )
      ).id;
      eventId = (
        await run(a, () =>
          saveRecord(a, "events", {
            title: "QA Probe",
            category: "rehearsal",
            productionId: production,
            participantIds: [person],
            start: "2026-10-20T08:00:00Z",
            end: "2026-10-20T09:00:00Z",
          }),
        )
      ).id;
      fileId = randomUUID();
      await run(a, () =>
        db
          .insert(tables.records)
          .values({
            id: fileId,
            kind: "files",
            organizationId: a.organizationId,
            departmentId: a.departmentId,
            createdBy: person,
            productionId: production,
            data: {
              recordId: eventId,
              recordKind: "events",
              mime: "text/csv",
              name: "QA private attachment.csv",
              path: a.organizationId + "/qa-private.csv",
            },
          }),
      );
    }, 120000);
    afterAll(async () => {
      fs.writeFileSync(
        ".local/privacy-integration-tenants.json",
        JSON.stringify({ tenants, person, colleague, production }),
      );
      const p = await import("@/platform/db/connections");
      await Promise.all([
        auth?.end(),
        control?.end(),
        worker?.end(),
        p.appSql.end(),
        p.authSql.end(),
        p.workerSql.end(),
        p.controlSql.end(),
      ]);
    });
    it("shows a colleague event and reduced title/colour while blocking production and attachments", async () => {
      const { recordPage } = await import("@/modules/records/pages");
      const { findRecord } = await import("@/modules/records/repository");
      const { assertRead } = await import("@/modules/records/service");
      const { getFile } = await import("@/modules/files/service");
      const { documentAccess } = await import("@/modules/documents/service");
      await run(reader, async () => {
        const events = await recordPage(reader, "events");
        expect(events.records.some((e) => e.id === eventId)).toBe(true);
        expect(events.calendarProductions?.find((p) => p.id === production)?.data).toEqual({
          title: "QA Private Piece",
          color: "#537fba",
          season: "2026/2027",
          premiere: "2026-11-12",
        });
        expect(
          (await recordPage(reader, "productions")).records.some((p) => p.id === production),
        ).toBe(false);
        expect((await recordPage(reader, "files")).records.some((p) => p.id === fileId)).toBe(
          false,
        );
        await expect(
          assertRead(reader, await findRecord(reader, production, "productions")),
        ).rejects.toMatchObject({ status: 403 });
        await expect(getFile(reader, fileId)).rejects.toMatchObject({ status: 403 });
        await expect(documentAccess(reader, fileId)).rejects.toMatchObject({ status: 403 });
      });
    });
    it("calendar reads do not grant edits of colleagues or access to their hours", async () => {
      const { saveRecord } = await import("@/modules/records/service");
      const { recordPage } = await import("@/modules/records/pages");
      await run(a, () =>
        saveRecord(a, "attendance", {
          title: "QA attendance",
          userId: person,
          start: "2026-10-20T08:00:00Z",
          end: "2026-10-20T09:00:00Z",
          date: "2026-10-20",
          durationSeconds: 3600,
          pauseMinutes: 0,
        }),
      );
      await run(reader, async () => {
        expect((await recordPage(reader, "attendance")).records).toHaveLength(0);
        await expect(
          saveRecord(reader, "events", { title: "Changed" }, eventId, 1),
        ).rejects.toMatchObject({ status: 403 });
      });
    });
    it("projects known legacy clinical events in SQL, retaining only the private accounting unit", async () => {
      const id = randomUUID();
      await run(a, () =>
        db
          .insert(tables.records)
          .values({
            id,
            kind: "events",
            organizationId: a.organizationId,
            departmentId: a.departmentId,
            createdBy: colleague,
            data: {
              title: "Krank mit Attest",
              category: "sick-with-certificate",
              location: "medical detail",
              allDay: true,
              participantIds: [colleague],
              start: "2026-10-21T00:00:00Z",
              end: "2026-10-22T00:00:00Z",
            },
          }),
      );
      const { findRecord } = await import("@/modules/records/repository");
      await run(reader, async () => {
        const row = await findRecord(reader, id, "events");
        expect(row.data.title).toBe("Abwesenheit");
        expect(row.data.category).toBe("absence");
        expect(row.data.location).toBe("");
        expect(row.data.creditUnit).toBe("weekly-sixth");
        expect(JSON.stringify(row.data)).not.toMatch(/Krank|Attest|medical detail/);
      });
      await run(a, async () => {
        const row = await findRecord(a, id, "events");
        expect(row.data.creditUnit).toBe("weekly-sixth");
      });
    });
    it("rejects new clinical categories and stores independent neutral credits", async () => {
      const { saveRecord } = await import("@/modules/records/service");
      await run(reader, async () => {
        await expect(
          saveRecord(reader, "events", {
            title: "Krank",
            category: "sick",
            start: "2026-10-23T00:00:00Z",
            end: "2026-10-24T00:00:00Z",
            participantIds: [colleague],
          }),
        ).rejects.toMatchObject({ status: 400 });
        const row = await saveRecord(reader, "events", {
          title: "Abwesenheit",
          category: "absence",
          creditUnit: "weekly-sixth",
          start: "2026-10-23T00:00:00Z",
          end: "2026-10-24T00:00:00Z",
          participantIds: [colleague],
        });
        expect(row.data.creditUnit).toBe("weekly-sixth");
      });
    });
    it("isolates privacy entries with real nonowner RLS and scopes own requests", async () => {
      const { savePrivacy, privacyWorkspace } = await import("@/modules/privacy/service");
      const request = await run(reader, () =>
        savePrivacy(reader, {
          action: "entry",
          kind: "request",
          data: {
            title: "QA own access request",
            requestType: "access",
            subjectType: "account",
            subjectId: colleague,
          },
        }),
      );
      await run(reader, async () => {
        const entries = (await privacyWorkspace(reader)).entries;
        expect(entries).toHaveLength(1);
        expect(entries[0].ownerId).toBe(colleague);
      });
      await run(b, async () => {
        expect(
          await db
            .select()
            .from(tables.privacyEntries)
            .where(op.eq(tables.privacyEntries.id, (request as any).id)),
        ).toHaveLength(0);
      });
      await run(reader, () =>
        expect(
          savePrivacy(reader, { action: "entry", kind: "provider", data: { title: "Escalation" } }),
        ).rejects.toMatchObject({ status: 403 }),
      );
    });
    it("scrubs clinical contents in nested published planning snapshots before returning them", async () => {
      await run(a, async () => {
        const result = await db.execute(
          op.sql`select showtime_safe_snapshot(${JSON.stringify({ events: [{ id: "legacy", departmentId: a.departmentId, data: { title: "Krank mit Attest", category: "sick", allDay: true, participantIds: [colleague], start: "2026-10-24T00:00:00Z", end: "2026-10-25T00:00:00Z" } }] })}::jsonb) as snapshot`,
        );
        expect(JSON.stringify(result[0])).not.toMatch(/Krank|Attest|"category":"sick"/);
      });
    });
    it("removes credits when paid absences change to rest, including imported named categories", async () => {
      const { saveRecord } = await import("@/modules/records/service");
      await run(reader, async () => {
        let row = await saveRecord(reader, "events", {
          title: "Urlaub",
          category: "vacation",
          allDay: true,
          start: "2026-10-26T00:00:00Z",
          end: "2026-10-27T00:00:00Z",
          participantIds: [colleague],
        });
        expect(row.data.creditUnit).toBe("weekly-sixth");
        row = await saveRecord(
          reader,
          "events",
          { ...row.data, category: "rest", title: "Ruhetag" },
          row.id,
          row.version,
        );
        expect(row.data.creditUnit).toBe("none");
      });
      await run(a, async () => {
        await db
          .insert(tables.records)
          .values({
            id: randomUUID(),
            kind: "calendarCategories",
            organizationId: a.organizationId,
            departmentId: a.departmentId,
            createdBy: person,
            data: { key: "custom-rest", name: "Ruhetag" },
          });
        const result = await db.execute(
          op.sql`select showtime_safe_record_data('events',${JSON.stringify({ category: "custom-rest", creditUnit: "weekly-sixth", allDay: true, participantIds: [person] })}::jsonb,${a.departmentId},${person},${a.departmentId}) as data`,
        );
        expect((result[0].data as Record<string, unknown>).creditUnit).toBe("none");
      });
    });
  },
);
