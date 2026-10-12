import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Context } from "@/platform/context";
import type { WorkingTimeSettings } from "@/shared/working-time";
import { HttpError } from "@/platform/http";
import { hasPermission, type Permission } from "@/platform/access";
import { localDay } from "@/modules/time-tracking/rules";
import { memberships, tenantProfiles } from "@/platform/db/schema";
import { calculateAttendanceBalance } from "@/modules/time-tracking/balance";
import { profileUpdateSchema } from "@/modules/profile/schema";

const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  revalidate: vi.fn(),
  invalidateTeam: vi.fn(),
  live: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/platform/db", () => ({ db: { transaction: mock.transaction } }));
vi.mock("@/platform/context", () => ({ requirePermission: mock.requirePermission }));
vi.mock("@/platform/cache", () => ({ revalidateTag: mock.revalidate }));
vi.mock("@/platform/realtime", () => ({ scheduleLiveChange: mock.live }));
vi.mock("@/modules/records/workspace", () => ({ invalidateTeam: mock.invalidateTeam }));
vi.mock("@/platform/events", () => ({ auditChange: mock.audit }));
import { updateProfile } from "@/modules/profile/service";

const admin = {
  user: { id: "owner", role: "admin" },
  grants: [{ role: "personnel", scope: "department", scopeId: "makeup" }],
  departmentId: "makeup",
  organizationId: "theatre",
} as Context;
const fixture = (): WorkingTimeSettings => ({
  version: 6,
  openingBalanceSeconds: 7200,
  schedules: [
    { effectiveFrom: "2026-06-01", weeklyMinutes: 2400, workingDays: [1, 2, 3, 4, 5, 6] },
    { effectiveFrom: "2026-07-01", weeklyMinutes: 1920, workingDays: [1, 2, 3, 4, 5, 6] },
    { effectiveFrom: "2026-11-01", weeklyMinutes: 2160, workingDays: [1, 2, 3, 4, 5, 6] },
  ],
});
const deletion = (effectiveFrom = "2026-07-01", expectedVersion = 6) => ({
  workingTimeDelete: { effectiveFrom, expectedVersion },
});

function database(settings: WorkingTimeSettings | null = fixture(), role: string | null = "user") {
  const writes: WorkingTimeSettings[] = [];
  const conditions: unknown[] = [];
  const lock = vi.fn().mockResolvedValue(undefined);
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => ({
          limit: async () => {
            if (table === memberships) {
              conditions.push(condition);
              return role ? [{ role }] : [];
            }
            if (table === tenantProfiles) return [{ settings }];
            throw new Error("Unexpected table in mock");
          },
        }),
      }),
    }),
    execute: lock,
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: ({ set }: { set: { workingTime: WorkingTimeSettings } }) => ({
          returning: async () => {
            writes.push(set.workingTime);
            settings = set.workingTime;
            return [{ accentPalette: "rose", onboardingVersion: 1, workingTime: settings }];
          },
        }),
      }),
    }),
  };
  mock.transaction.mockImplementation(async (run: (value: unknown) => Promise<unknown>) => run(tx));
  return { writes, conditions, lock, tx };
}

function settingsOf(result: unknown) {
  expect(result).toHaveProperty("workingTime");
  return (result as { workingTime: WorkingTimeSettings }).workingTime;
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.requirePermission.mockImplementation((context: Context, permission: Permission) => {
    if (
      !hasPermission({ id: context.user.id, grants: context.grants }, permission, {
        departmentId: context.departmentId,
      })
    )
      throw new HttpError(403, "Keine Berechtigung");
  });
});

describe("admin deletion of dated working-time schedules", () => {
  it("allows an employee to adjust their own dated weekly target", async () => {
    const state = database();
    const employee = {
      ...admin,
      grants: [{ role: "employee", scope: "department", scopeId: "makeup" }],
      user: { ...admin.user, role: "user" },
    } as Context;
    const effectiveFrom = localDay(new Date());
    const result = await updateProfile(employee, {
      workingTime: {
        effectiveFrom,
        weeklyMinutes: 15 * 60,
        workingDays: [1, 2, 3, 4, 5, 6],
        openingBalanceSeconds: 7200,
        expectedVersion: 6,
      },
    });
    expect(
      settingsOf(result).schedules.some(
        (row) => row.effectiveFrom === effectiveFrom && row.weeklyMinutes === 900,
      ),
    ).toBe(true);
    expect(state.writes).toHaveLength(1);
    expect(mock.requirePermission).not.toHaveBeenCalled();
  });
  it.each(["user", "superadmin"])(
    "keeps an explicitly authorized own weekly profile editable across trades with legacy membership role %s",
    async (role) => {
      const state = database(fixture(), role);
      const employee = {
        ...admin,
        departmentId: "lighting",
        grants: [{ role: "employee", scope: "department", scopeId: "makeup" }],
        user: { ...admin.user, role: "user" },
      } as Context;
      await updateProfile(employee, {
        workingTime: {
          effectiveFrom: localDay(new Date()),
          weeklyMinutes: 900,
          openingBalanceSeconds: 7200,
          expectedVersion: 6,
        },
      });
      expect(state.writes).toHaveLength(1);
    },
  );
  it("rejects an employee changing somebody else's weekly target before querying", async () => {
    database();
    const employee = {
      ...admin,
      grants: [{ role: "employee", scope: "department", scopeId: "makeup" }],
      user: { ...admin.user, role: "user" },
    } as Context;
    await expect(
      updateProfile(employee, {
        memberId: "other",
        workingTime: {
          effectiveFrom: localDay(new Date()),
          weeklyMinutes: 900,
          workingDays: [1, 2, 3, 4, 5, 6],
          openingBalanceSeconds: 0,
          expectedVersion: 6,
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("allows a department team lead to delete a colleague's historical target", async () => {
    const state = database();
    const lead = {
      ...admin,
      grants: [{ role: "team_lead", scope: "department", scopeId: "makeup" }],
    } as Context;
    await updateProfile(lead, { ...deletion(), memberId: "colleague" });
    expect(state.writes).toHaveLength(1);
  });
  it("deletes an old own rate and recalculates using the preceding surviving rate", async () => {
    const previous = fixture();
    const state = database(previous, "admin");
    const result = await updateProfile(admin, deletion());
    expect(mock.requirePermission).not.toHaveBeenCalled();
    expect(settingsOf(result)).toEqual({
      ...previous,
      version: 7,
      schedules: [previous.schedules[0], previous.schedules[2]],
    });
    const input = {
      userId: "owner",
      attendance: [],
      from: "2026-07-06",
      to: "2026-07-11",
      now: new Date("2026-07-12T12:00:00Z"),
    };
    expect(calculateAttendanceBalance({ ...input, settings: previous }).targetSeconds).toBe(
      32 * 3600,
    );
    expect(
      calculateAttendanceBalance({ ...input, settings: settingsOf(result) }).targetSeconds,
    ).toBe(40 * 3600);
    expect(state.lock).toHaveBeenCalledOnce();
    expect(mock.audit).toHaveBeenCalledWith(
      state.tx,
      admin,
      "profile.working-time.deleted",
      "owner",
    );
    expect(mock.revalidate).toHaveBeenCalledWith("member:owner", { expire: 0 });
    expect(mock.invalidateTeam).toHaveBeenCalledWith("makeup");
    expect(mock.live).toHaveBeenCalledOnce();
  });

  it("scopes colleague deletion to the current organization and department", async () => {
    const state = database();
    await updateProfile(admin, { ...deletion(), memberId: "colleague" });
    const query = new PgDialect().sqlToQuery(
      state.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(query.params).toEqual(["colleague", "makeup", "theatre", "active"]);
    expect(mock.revalidate).toHaveBeenCalledWith("member:colleague", { expire: 0 });
    expect(state.writes).toHaveLength(1);
  });

  it("moves the account start when the initial entry is deleted", async () => {
    database();
    const result = await updateProfile(admin, deletion("2026-06-01"));
    const balance = calculateAttendanceBalance({
      userId: "owner",
      settings: settingsOf(result),
      attendance: [],
      from: "2026-06-01",
      to: "2026-07-01",
      now: new Date("2026-07-02T12:00:00Z"),
    });
    expect(balance.from).toBe("2026-06-29");
    expect(balance.targetSeconds).toBe(Math.round((32 * 3600 * 5) / 7));
  });

  it("retains the version and start balance after deleting the last entry, allowing a new first start", async () => {
    const previous = fixture();
    const state = database({ ...previous, schedules: [previous.schedules[0]] });
    const result = await updateProfile(admin, deletion("2026-06-01"));
    expect(settingsOf(result)).toEqual({ version: 7, openingBalanceSeconds: 7200, schedules: [] });
    const replacement = await updateProfile(admin, {
      workingTime: {
        effectiveFrom: "2026-05-01",
        expectedVersion: 7,
        weeklyMinutes: 1800,
        workingDays: [1, 2, 3, 4, 5, 6],
        openingBalanceSeconds: 7200,
      },
    });
    expect(settingsOf(replacement).version).toBe(8);
    expect(settingsOf(replacement).schedules[0].effectiveFrom).toBe("2026-05-01");
    expect(state.writes).toHaveLength(2);
  });

  it("rejects normal-user deletion, even on their own profile, before accessing the database", async () => {
    database();
    const user = {
      ...admin,
      grants: [{ role: "employee", scope: "department", scopeId: "makeup" }],
      user: { ...admin.user, role: "user" as const },
    } as Context;
    await expect(updateProfile(user, deletion())).rejects.toMatchObject({ status: 403 });
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it.each([null, "superadmin"])(
    "rejects an invalid or system membership (%s) before any write",
    async (role) => {
      const state = database(fixture(), role);
      await expect(
        updateProfile(admin, { ...deletion(), memberId: "other" }),
      ).rejects.toMatchObject({ status: 403 });
      expect(state.lock).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    },
  );

  it("rejects stale versions and missing entries without writes or invalidation", async () => {
    const state = database();
    await expect(updateProfile(admin, deletion("2026-07-01", 5))).rejects.toMatchObject({
      status: 409,
    });
    await expect(updateProfile(admin, deletion("2026-08-01", 6))).rejects.toMatchObject({
      status: 404,
    });
    expect(state.writes).toEqual([]);
    expect(mock.audit).not.toHaveBeenCalled();
    expect(mock.revalidate).not.toHaveBeenCalled();
    expect(mock.live).not.toHaveBeenCalled();
  });

  it("validates deletion independently and rejects combined changes or malformed dates", () => {
    expect(profileUpdateSchema.parse({ ...deletion(), memberId: "colleague" })).toMatchObject({
      memberId: "colleague",
    });
    const workingTime = { ...fixture().schedules[0], expectedVersion: 6, openingBalanceSeconds: 0 };
    for (const input of [
      { ...deletion(), workingTime },
      { ...deletion(), accentPalette: "rose" },
      { ...deletion(), onboardingCompleted: true },
      deletion("2026-02-30"),
      deletion("2026-07-01", -1),
      { workingTimeDelete: { effectiveFrom: "2026-07-01" } },
    ])
      expect(profileUpdateSchema.safeParse(input).success).toBe(false);
  });
});
