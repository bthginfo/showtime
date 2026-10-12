import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { randomUUID, createHmac } from "node:crypto";
import postgres from "postgres";
import type { Context } from "@/platform/context";
import { allowedPermissions, type Grant } from "@/platform/access";
import { moduleRegistry } from "@/modules/theater/registry";
const enabled = process.env.SHOWTIME_INTEGRATION === "development";
describe.skipIf(!enabled)("real Neon tenant isolation and event commands", () => {
  let app: ReturnType<typeof postgres>,
    auth: ReturnType<typeof postgres>,
    control: ReturnType<typeof postgres>;
  let worker: ReturnType<typeof postgres>;
  let a: Context, b: Context, person: string, outsider: string, production: string;
  let run: <T>(ctx: Context, work: () => Promise<T>, worker?: boolean) => Promise<T>;
  let db: typeof import("@/platform/db").db;
  let save: typeof import("@/modules/records/service").saveRecord;
  let remove: typeof import("@/modules/records/service").deleteRecord;
  let theater: typeof import("@/modules/theater/service");
  let events: typeof import("@/platform/events");
  let tables: typeof import("@/platform/db/schema");
  let op: typeof import("drizzle-orm");
  const created: string[] = [];
  beforeAll(async () => {
    const runtime = JSON.parse(fs.readFileSync(".local/runtime-development.json", "utf8"));
    Object.assign(process.env, runtime);
    app = postgres(runtime.APP_DATABASE_URL, { max: 1, prepare: false });
    auth = postgres(runtime.AUTH_DATABASE_URL, { max: 1, prepare: false });
    control = postgres(runtime.CONTROL_DATABASE_URL, { max: 1, prepare: false });
    worker = postgres(runtime.WORKER_DATABASE_URL, { max: 1, prepare: false });
    person = randomUUID();
    outsider = randomUUID();
    await auth`insert into app_user(id,name,email,username) values(${person},'Synthetische Testperson',${person + "@qa.showtime.invalid"},${"qa-" + person}),(${outsider},'Synthetische Außenperson',${outsider + "@qa.showtime.invalid"},${"qa-" + outsider})`;
    const { createTenant } = await import("@/modules/theater/tenants");
    const { requestScope } = await import("@/platform/request");
    const { tenantTransaction } = await import("@/platform/db/tenant");
    db = (await import("@/platform/db")).db;
    tables = await import("@/platform/db/schema");
    op = await import("drizzle-orm");
    save = (await import("@/modules/records/service")).saveRecord;
    remove = (await import("@/modules/records/service")).deleteRecord;
    theater = await import("@/modules/theater/service");
    events = await import("@/platform/events");
    run = (ctx, work, isWorker = false) =>
      requestScope.run(
        { request: new Request("http://localhost:3100/qa"), context: ctx, after: [] },
        () => tenantTransaction(ctx, work, isWorker),
      );
    async function tenant(label: string) {
      const result = await createTenant(
        { name: "QA " + label, slug: "qa-" + randomUUID() },
        person,
      );
      created.push(result.id);
      const departmentId = result.departments.find((d) => d.name === "Maske")!.id;
      const grants: Grant[] = [
        "employee",
        "theater_admin",
        "production_lead",
        "disposition",
        "technical_lead",
        "personnel",
        "intendance",
        "team_lead",
      ].map((role) => ({ role: role as Grant["role"], scope: "tenant", scopeId: null }));
      await control`insert into permission_grants ${control(grants.map((g) => ({ organization_id: result.id, user_id: person, role: g.role, scope: g.scope, scope_id: g.scopeId })))}`;
      return {
        organizationId: result.id,
        departmentId,
        organizationName: "QA " + label,
        departmentName: "Maske",
        grants,
        user: {
          id: person,
          name: "QA",
          username: "qa",
          role: "admin",
          status: "active",
          departmentId,
          grants,
          permissions: allowedPermissions({ id: person, grants }, { departmentId }),
        },
      } as Context;
    }
    a = await tenant("A");
    b = await tenant("B");
    production = (
      await run(a, () =>
        save(a, "productions", {
          title: "QA Produktion",
          status: "active",
          memberIds: [person],
          contacts: [],
        }),
      )
    ).id;
  }, 120000);
  afterAll(async () => {
    // Synthetic data stays in the separate development DB for reproducible restore QA.
    fs.writeFileSync(
      ".local/integration-tenants.json",
      JSON.stringify({ organizationIds: created, person, outsider, production }),
    );
    const pools = await import("@/platform/db/connections");
    await Promise.all([
      app?.end(),
      auth?.end(),
      control?.end(),
      worker?.end(),
      pools.appSql.end(),
      pools.authSql.end(),
      pools.workerSql.end(),
      pools.controlSql.end(),
    ]);
  });
  it("denies working-time changes and history deletion after a colleague leaves the lead's active trade", async () => {
    const target = randomUUID();
    const membershipId = randomUUID();
    await auth`insert into app_user(id,name,email,username) values(${target},'QA Sollzeit Transfer',${target + "@qa.showtime.invalid"},${"qa-" + target})`;
    await control`insert into tenant_members(organization_id,user_id,status) values(${a.organizationId},${target},'active')`;
    await control`insert into memberships(id,organization_id,department_id,user_id,role,status) values(${membershipId},${a.organizationId},${a.departmentId},${target},'user','active')`;
    const grants: Grant[] = [{ role: "team_lead", scope: "department", scopeId: a.departmentId }];
    const lead: Context = {
      ...a,
      grants,
      user: {
        ...a.user,
        grants,
        permissions: allowedPermissions({ id: person, grants }, { departmentId: a.departmentId }),
      },
    };
    const { updateProfile } = await import("@/modules/profile/service");
    const { localDay } = await import("@/modules/time-tracking/rules");
    const effectiveFrom = localDay(new Date());
    const data = {
      memberId: target,
      workingTime: {
        effectiveFrom,
        weeklyMinutes: 900,
        openingBalanceSeconds: 0,
        expectedVersion: 0,
      },
    };
    await run(lead, () => updateProfile(lead, data));
    const readProfile = () =>
      run(a, () =>
        db.select().from(tables.tenantProfiles).where(op.eq(tables.tenantProfiles.userId, target)),
      );
    const [original] = await readProfile();
    expect(original.workingTime?.version).toBe(1);
    const [otherDepartment] = await run(a, () =>
      db
        .select()
        .from(tables.departments)
        .where(op.ne(tables.departments.id, a.departmentId))
        .limit(1),
    );
    for (const status of ["pending", "disabled"] as const) {
      await control`update memberships set status=${status} where id=${membershipId} and organization_id=${a.organizationId}`;
      if (status === "disabled")
        await control`insert into memberships(id,organization_id,department_id,user_id,role,status) values(${randomUUID()},${a.organizationId},${otherDepartment.id},${target},'user','active')`;
      await expect(
        run(lead, () =>
          updateProfile(lead, {
            ...data,
            workingTime: { ...data.workingTime, weeklyMinutes: 1200, expectedVersion: 1 },
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        run(lead, () =>
          updateProfile(lead, {
            memberId: target,
            workingTimeDelete: { effectiveFrom, expectedVersion: 1 },
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect((await readProfile())[0].workingTime).toEqual(original.workingTime);
    }
  });
  it("activates a newly added trade once and rejects another tenant's department", async () => {
    const { tenantConfiguration } = await import("@/modules/theater/tenants");
    const [department] = await run(a, () =>
      db.select().from(tables.departments).where(op.eq(tables.departments.name, "Intendanz")),
    );
    const [foreign] = await run(b, () =>
      db.select().from(tables.departments).where(op.eq(tables.departments.name, "Intendanz")),
    );
    await run(a, () =>
      db
        .delete(tables.moduleActivations)
        .where(op.eq(tables.moduleActivations.moduleId, "intendance")),
    );
    await expect(
      run(a, () =>
        tenantConfiguration(a, {
          action: "module",
          data: { moduleId: "intendance", enabled: true },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      run(a, () =>
        tenantConfiguration(a, {
          action: "module",
          data: { moduleId: "intendance", enabled: true, departmentId: foreign.id },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await run(a, () =>
      tenantConfiguration(a, {
        action: "module",
        data: { moduleId: "intendance", enabled: true, departmentId: department.id },
      }),
    );
    await run(a, () =>
      tenantConfiguration(a, {
        action: "module",
        data: { moduleId: "intendance", enabled: false },
      }),
    );
    const rows = await run(a, () =>
      db
        .select()
        .from(tables.moduleActivations)
        .where(op.eq(tables.moduleActivations.moduleId, "intendance")),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].enabled).toBe(false);
    expect(rows[0].config.departmentId).toBe(department.id);
    await run(a, () =>
      tenantConfiguration(a, { action: "module", data: { moduleId: "intendance", enabled: true } }),
    );
    const planning = await run(a, () => theater.theaterWorkspace(a, production));
    expect(planning.readiness.some((state) => state.moduleId === "intendance")).toBe(false);
    const employee = {
      ...a,
      grants: [{ role: "employee" as const, scope: "tenant" as const, scopeId: null }],
    };
    await expect(
      run(employee, () =>
        tenantConfiguration(employee, {
          action: "module",
          data: { moduleId: "intendance", enabled: false },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("saves named general documentation without a fictional actor while preserving Maskenaufschrieb validation and tenant isolation", async () => {
    const note = await run(a, () =>
      save(a, "looks", {
        documentMode: "general",
        title: "QA Regiehinweise",
        sections: [{ key: "notes", entries: [{ id: randomUUID(), text: "Synthetischer Ablauf" }] }],
      }),
    );
    expect(note.data.title).toBe("QA Regiehinweise");
    expect(note.data.actorId).toBe("");
    expect(note.data.documentMode).toBe("general");
    expect(
      await run(b, () => db.select().from(tables.records).where(op.eq(tables.records.id, note.id))),
    ).toHaveLength(0);
    await expect(
      run(a, () => save(a, "looks", { documentMode: "general", title: "", sections: [] })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(run(a, () => save(a, "looks", { sections: [] }))).rejects.toMatchObject({
      status: 400,
    });
  });
  it("uses nonowner roles, denies role escalation and separates auth/control/business privileges", async () => {
    for (const client of [app, auth, control, worker]) {
      const [role] =
        await client`select current_user as name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
      expect(role.rolsuper).toBe(false);
      expect(role.rolbypassrls).toBe(false);
      expect(role.name).toMatch(/^showtime_/);
    }
    await expect(app.unsafe("set role showtime_worker")).rejects.toMatchObject({ code: "42501" });
    await expect(app.unsafe("select * from app_account")).rejects.toMatchObject({ code: "42501" });
    await expect(auth.unsafe("select * from records")).rejects.toMatchObject({ code: "42501" });
    await expect(control.unsafe("select * from records")).rejects.toMatchObject({ code: "42501" });
    await expect(worker.unsafe("select * from app_account")).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("fails closed without tenant GUCs, resets pooled sessions and blocks cross-tenant rows", async () => {
    expect(await app`select id from records`).toHaveLength(0);
    await app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${a.organizationId},true),set_config('app.user_id',${person},true)`;
      expect(await tx`select id from records where id=${production}`).toHaveLength(1);
    });
    expect(await app`select id from records`).toHaveLength(0);
    await app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${b.organizationId},true),set_config('app.user_id',${person},true)`;
      expect(await tx`select id from records where id=${production}`).toHaveLength(0);
    });
    await app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id',${a.organizationId},true),set_config('app.user_id',${outsider},true)`;
      expect(await tx`select id from records`).toHaveLength(0);
    });
    await expect(
      app.begin(async (tx) => {
        await tx`select set_config('app.tenant_id',${b.organizationId},true),set_config('app.user_id',${person},true)`;
        await tx`insert into records(id,organization_id,department_id,kind,created_by,data) values(${randomUUID()},${a.organizationId},${a.departmentId},'tasks',${person},'{}')`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects composite cross-tenant foreign keys and rolls commands back with their outbox", async () => {
    await expect(
      run(b, () =>
        db.insert(tables.records).values({
          id: randomUUID(),
          organizationId: b.organizationId,
          departmentId: b.departmentId,
          createdBy: person,
          kind: "tasks",
          productionId: production,
          data: { title: "Forbidden" },
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    const id = randomUUID();
    await expect(
      run(a, async () => {
        await db.insert(tables.records).values({
          id,
          organizationId: a.organizationId,
          departmentId: a.departmentId,
          createdBy: person,
          kind: "tasks",
          data: { title: "Rollback" },
        });
        await events.emit(db as never, a, "TaskAssignedV1", { recordId: id });
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow("forced rollback");
    await run(a, async () => {
      expect(
        await db.select().from(tables.records).where(op.eq(tables.records.id, id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(tables.outbox)
          .where(op.sql`${tables.outbox.payload}->>'recordId'=${id}`),
      ).toHaveLength(0);
    });
  });
  it.each(["time", "attendance"] as const)(
    "creates, edits and deletes %s, preserving version, owner and idempotency",
    async (kind) => {
      const data = {
        title: "QA " + kind,
        date: "2026-08-02",
        start: "2026-08-02T07:00:00.000Z",
        end: "2026-08-02T09:00:00.000Z",
        pauseSeconds: 0,
        durationSeconds: 7200,
        category: "other",
        idempotencyKey: randomUUID(),
      };
      const first = await run(a, () => save(a, kind, data));
      const retry = await run(a, () => save(a, kind, data));
      expect(retry.id).toBe(first.id);
      const edited = await run(a, () =>
        save(a, kind, { title: "QA korrigiert", pauseSeconds: 900 }, first.id, first.version),
      );
      expect(edited.version).toBe(2);
      expect(edited.data.durationSeconds).toBe(6300);
      expect(edited.data.userId).toBe(person);
      await expect(
        run(a, () => save(a, kind, { title: "stale" }, first.id, 1)),
      ).rejects.toMatchObject({ status: 409 });
      await expect(run(a, () => remove(a, kind, first.id, { version: 1 }))).rejects.toMatchObject({
        status: 409,
      });
      await run(a, () => remove(a, kind, edited.id, { version: edited.version }));
      await run(a, async () =>
        expect(
          await db.select().from(tables.records).where(op.eq(tables.records.id, first.id)),
        ).toHaveLength(0),
      );
    },
  );
  it("corrects an own booking even after its production assignment was withdrawn", async () => {
    const first = await run(a, () =>
      save(a, "time", {
        title: "QA Referenz",
        date: "2026-08-04",
        durationSeconds: 1800,
        pauseSeconds: 0,
        category: "other",
        productionId: production,
      }),
    );
    const restricted = {
      ...a,
      grants: [{ role: "employee", scope: "department", scopeId: a.departmentId } as Grant],
    };
    restricted.user = { ...a.user, grants: restricted.grants };
    await run(a, () =>
      db
        .update(tables.records)
        .set({ data: { title: "QA geschlossen", status: "active", memberIds: [outsider] } })
        .where(op.eq(tables.records.id, production)),
    );
    const edited = await run(restricted, () =>
      save(restricted, "time", { title: "QA korrigierbar" }, first.id, first.version),
    );
    expect(edited.data.productionId).toBe(production);
    await run(restricted, () => remove(restricted, "time", edited.id, { version: edited.version }));
    await run(a, () =>
      db
        .update(tables.records)
        .set({ data: { title: "QA Produktion", status: "active", memberIds: [person] } })
        .where(op.eq(tables.records.id, production)),
    );
  });
  it("prevents overbookings with setup/teardown and makes half-open adjacent bookings possible", async () => {
    const resource = await run(a, () =>
      theater.saveResource(a, {
        name: "QA Bühne",
        type: "stage",
        capacity: 1,
        departmentId: null,
        setupMinutes: 30,
        teardownMinutes: 30,
      }),
    );
    await run(a, () =>
      theater.reserveResource(a, {
        resourceId: resource.id,
        startAt: "2026-12-01T10:00:00.000Z",
        endAt: "2026-12-01T12:00:00.000Z",
      }),
    );
    await expect(
      run(a, () =>
        theater.reserveResource(a, {
          resourceId: resource.id,
          startAt: "2026-12-01T12:00:00.000Z",
          endAt: "2026-12-01T13:00:00.000Z",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      run(a, () =>
        theater.reserveResource(a, {
          resourceId: resource.id,
          startAt: "2026-12-01T13:00:00.000Z",
          endAt: "2026-12-01T14:00:00.000Z",
        }),
      ),
    ).resolves.toHaveProperty("id");
  });
  it("applies cross-trade reactions once despite duplicate and restarted delivery", async () => {
    await run(a, () => events.processEvents(), true);
    await run(a, () => events.processEvents(), true);
    await run(
      a,
      async () => {
        const workspaces = await db
          .select()
          .from(tables.tradeItems)
          .where(
            op.and(
              op.eq(tables.tradeItems.productionId, production),
              op.eq(tables.tradeItems.type, "workspace"),
            ),
          );
        expect(workspaces).toHaveLength(moduleRegistry.length);
        const [event] = await db
          .select()
          .from(tables.outbox)
          .where(op.eq(tables.outbox.type, "ProductionCreatedV1"));
        await db
          .update(tables.outbox)
          .set({ status: "processing", availableAt: new Date(0) })
          .where(op.eq(tables.outbox.id, event.id));
        await events.processEvents(event.id);
        expect(
          await db
            .select()
            .from(tables.tradeItems)
            .where(
              op.and(
                op.eq(tables.tradeItems.productionId, production),
                op.eq(tables.tradeItems.type, "workspace"),
              ),
            ),
        ).toHaveLength(moduleRegistry.length);
        expect(
          await db
            .select()
            .from(tables.eventReceipts)
            .where(op.eq(tables.eventReceipts.eventId, event.id)),
        ).toHaveLength(1);
      },
      true,
    );
  });
  it("requires authentic tenant-bound queue pointers", async () => {
    const { validPointer } = await import("@/platform/events/transport");
    const event = randomUUID();
    const signature = createHmac("sha256", process.env.CRON_SECRET!)
      .update(`${a.organizationId}:${event}:1`)
      .digest("hex");
    expect(
      validPointer({
        organizationId: a.organizationId,
        eventId: event,
        schemaVersion: 1,
        signature,
      }),
    ).toBe(true);
    expect(
      validPointer({
        organizationId: b.organizationId,
        eventId: event,
        schemaVersion: 1,
        signature,
      }),
    ).toBe(false);
  });
  it("isolates API access, idempotency receipts, media leases and recovery evidence by tenant", async () => {
    const keyId = randomUUID(),
      uploadId = randomUUID(),
      itemId = randomUUID();
    await run(a, async () => {
      await db.insert(tables.apiAccess).values({
        id: keyId,
        organizationId: a.organizationId,
        departmentId: a.departmentId,
        userId: person,
        label: "QA scoped key",
        tokenHash: randomUUID(),
        scopes: ["records:read"],
        expiresAt: new Date(Date.now() + 86400000),
      });
      await db.insert(tables.tradeItems).values({
        id: itemId,
        organizationId: a.organizationId,
        departmentId: a.departmentId,
        createdBy: person,
        moduleId: "makeup",
        type: "asset",
        title: "QA private lease",
      });
      await db.insert(tables.mediaUploads).values({
        id: uploadId,
        organizationId: a.organizationId,
        departmentId: a.departmentId,
        userId: person,
        itemId,
        name: "synthetic.pdf",
        mime: "application/pdf",
        size: 100,
        expiresAt: new Date(Date.now() + 3600000),
      });
      await db.insert(tables.integrationReceipts).values({
        organizationId: a.organizationId,
        accessId: keyId,
        operationKey: "qa-isolation-" + keyId,
        requestHash: "qa",
        result: { id: itemId },
      });
      await db.insert(tables.recoveryChecks).values({
        organizationId: a.organizationId,
        kind: "restore",
        status: "verified",
        recordCount: 1,
      });
    });
    for (const table of [
      tables.apiAccess,
      tables.integrationReceipts,
      tables.mediaUploads,
      tables.recoveryChecks,
    ]) {
      expect(await run(b, () => db.select().from(table))).toHaveLength(0);
    }
    for (const name of ["api_access", "integration_receipts", "media_uploads", "recovery_checks"])
      expect(await app.unsafe("select id from " + name)).toHaveLength(0);
    await expect(
      run(b, () =>
        db.insert(tables.integrationReceipts).values({
          organizationId: b.organizationId,
          accessId: keyId,
          operationKey: "qa-cross-tenant",
          requestHash: "qa",
          result: {},
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(b, () =>
        db.insert(tables.mediaUploads).values({
          organizationId: b.organizationId,
          departmentId: b.departmentId,
          userId: person,
          itemId,
          name: "synthetic.pdf",
          mime: "application/pdf",
          size: 100,
          expiresAt: new Date(Date.now() + 3600000),
        }),
      ),
    ).rejects.toThrow();
    await expect(
      run(a, () =>
        db.insert(tables.mediaUploads).values({
          organizationId: a.organizationId,
          departmentId: a.departmentId,
          userId: outsider,
          itemId,
          name: "synthetic.pdf",
          mime: "application/pdf",
          size: 100,
          expiresAt: new Date(Date.now() + 3600000),
        }),
      ),
    ).rejects.toThrow();
  });
  it("applies due cast changes exactly once with current authority and blocks withdrawn commands", async () => {
    const { applyDueCastChanges } = await import("@/modules/theater/cast-scheduler");
    const [disposition] =
      await control`select id from departments where organization_id=${a.organizationId} and name='Disposition'`;
    const castContext = {
      ...a,
      departmentId: disposition.id,
      activeDepartmentIds: [disposition.id, a.departmentId],
    };
    await run(
      castContext,
      async () => {
        const actor = await save(a, "actors", { name: "QA cast current" }),
          alternate = await save(a, "actors", { name: "QA cast alternate" }),
          character = await save(a, "characters", {
            name: "QA cast character",
            productionId: production,
          });
        const assignment = await save(a, "casting", {
          productionId: production,
          characterId: character.id,
          actorId: actor.id,
        });
        const change = await theater.saveTradeItem(castContext, {
          moduleId: "disposition",
          type: "cast-change",
          title: "QA scheduled cast",
          productionId: production,
          status: "draft",
          data: { characterId: character.id, actorId: alternate.id, effectiveFrom: "2099-01-01" },
        });
        const [before] = await db
          .select()
          .from(tables.records)
          .where(op.eq(tables.records.id, assignment.id));
        expect(before.data.actorId).toBe(actor.id);
        await db
          .update(tables.tradeItems)
          .set({ data: { ...change.data, effectiveFrom: "2020-01-01" } })
          .where(op.eq(tables.tradeItems.id, change.id));
        expect(await applyDueCastChanges(castContext)).toBe(1);
        expect(await applyDueCastChanges(castContext)).toBe(0);
        const [after] = await db
          .select()
          .from(tables.records)
          .where(op.eq(tables.records.id, assignment.id));
        expect(after.data.actorId).toBe(alternate.id);
        const blocked = await theater.saveTradeItem(castContext, {
          moduleId: "disposition",
          type: "cast-change",
          title: "QA withdrawn cast",
          productionId: production,
          status: "draft",
          data: { characterId: character.id, actorId: actor.id, effectiveFrom: "2099-01-01" },
        });
        await db
          .update(tables.tradeItems)
          .set({ data: { ...blocked.data, effectiveFrom: "2020-01-01", _castAuthorId: outsider } })
          .where(op.eq(tables.tradeItems.id, blocked.id));
        expect(await applyDueCastChanges(castContext)).toBe(0);
        const [stopped] = await db
          .select()
          .from(tables.tradeItems)
          .where(op.eq(tables.tradeItems.id, blocked.id));
        expect(stopped.status).toBe("blocked");
        const [unchanged] = await db
          .select()
          .from(tables.records)
          .where(op.eq(tables.records.id, assignment.id));
        expect(unchanged.data.actorId).toBe(alternate.id);
      },
      true,
    );
  });
  it("keeps all records reachable beyond 5000 rows and hides scan positions", async () => {
    const { recordPage } = await import("@/modules/records/pages");
    await run(a, async () => {
      const entries = Array.from({ length: 5001 }, (_, i) => ({
        id: randomUUID(),
        organizationId: a.organizationId,
        departmentId: a.departmentId,
        createdBy: person,
        kind: "tasks" as const,
        data: { title: "QA page " + i },
      }));
      for (let start = 0; start < entries.length; start += 500)
        await db.insert(tables.records).values(entries.slice(start, start + 500));
    });
    await run(a, async () => {
      let cursor: string | null = null;
      const seen = new Set<string>();
      let first: string | null = null;
      const started = performance.now(),
        heap = process.memoryUsage().heapUsed;
      let pages = 0,
        bytes = 0,
        maxPageBytes = 0,
        maxPageRows = 0;
      do {
        const page = await recordPage(a, "tasks", { cursor, limit: 300 });
        const size = Buffer.byteLength(JSON.stringify(page));
        pages++;
        bytes += size;
        maxPageBytes = Math.max(maxPageBytes, size);
        maxPageRows = Math.max(maxPageRows, page.records.length);
        expect(page.records.length).toBeLessThanOrEqual(300);
        for (const row of page.records) seen.add(row.id);
        cursor = page.nextCursor;
        first ||= cursor;
      } while (cursor);
      expect(seen.size).toBeGreaterThanOrEqual(5001);
      expect(first).not.toContain(a.organizationId);
      await expect(recordPage(b, "tasks", { cursor: first })).rejects.toMatchObject({
        status: 400,
      });
      fs.writeFileSync(
        ".local/paging-evidence.json",
        JSON.stringify(
          {
            rows: seen.size,
            pages,
            totalBytes: bytes,
            maxPageBytes,
            maxPageRows,
            elapsedMs: Math.round(performance.now() - started),
            heapDeltaBytes: process.memoryUsage().heapUsed - heap,
            measuredAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    });
  }, 120000);
});
