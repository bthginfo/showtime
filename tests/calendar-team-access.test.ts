import { describe, expect, it } from "vitest";
import type { Context } from "@/platform/context";
import type { DomainRecord, Member } from "@/shared/contracts";
import { rowReadable } from "@/modules/records/pages";
import { calendarRowReadable, privateRowReadable } from "@/shared/access-policy";
import { canManageRecord } from "@/shared/record-permissions";
import { reducedCalendarProductions, mergeCalendarProductions } from "@/shared/calendar-references";
import { calendarPresentation } from "@/shared/calendar-categories";
import { selectExportRecords } from "@/modules/exports/selection";

const member: Member = {
  id: "me",
  name: "QA Team",
  username: "qa",
  role: "user",
  status: "active",
  departmentId: "light",
  grants: [{ role: "employee", scope: "department", scopeId: "light" }],
};
const event: DomainRecord = {
  id: "event",
  kind: "events",
  organizationId: "theater",
  departmentId: "light",
  createdBy: "colleague",
  createdAt: "2026-10-12T08:00:00Z",
  updatedAt: "2026-10-12T08:00:00Z",
  version: 1,
  data: {
    title: "Probe",
    category: "rehearsal",
    productionId: "private-production",
    participantIds: ["colleague"],
    start: "2026-10-12T10:00:00+02:00",
    end: "2026-10-12T11:00:00+02:00",
  },
};
const refs = {
  projects: [],
  chats: [],
  projectIds: new Set<string>(),
  chatIds: new Set<string>(),
  actorIds: new Set<string>(),
  personIds: new Set<string>(),
  calendarProjects: [],
};
const context = {
  user: member,
  grants: member.grants,
  organizationId: "theater",
  departmentId: "light",
} as Context;

describe("department team calendars without internal production access", () => {
  it("reads a colleague appointment independently of production assignment", () => {
    expect(calendarRowReadable(member, event, "light")).toBe(true);
    expect(
      rowReadable(context, { ...event, productionId: "private-production" } as never, refs),
    ).toBe(true);
  });
  it("does not expand production, private chat or personal time access", () => {
    expect(
      rowReadable(
        context,
        { ...event, kind: "productions", id: "private-production" } as never,
        refs,
      ),
    ).toBe(false);
    expect(
      privateRowReadable(member, {
        ...event,
        kind: "conversations",
        data: { mode: "private", participantIds: ["colleague", "other"] },
      }),
    ).toBe(false);
    expect(
      privateRowReadable(member, { ...event, kind: "attendance", data: { userId: "colleague" } }),
    ).toBe(false);
    expect(canManageRecord(member, "events", event)).toBe(false);
    expect(
      canManageRecord(member, "events", {
        ...event,
        data: { ...event.data, participantIds: ["me"] },
      }),
    ).toBe(true);
  });
  it("rejects another department and a withdrawn or expired department grant", () => {
    expect(calendarRowReadable(member, { ...event, departmentId: "sound" }, "light")).toBe(false);
    expect(
      calendarRowReadable(
        { ...member, grants: [] },
        { ...event, data: { ...event.data, participantIds: ["me"] } },
        "light",
      ),
    ).toBe(false);
    expect(
      calendarRowReadable(
        {
          ...member,
          grants: [
            {
              role: "employee",
              scope: "department",
              scopeId: "light",
              expiresAt: "2020-01-01T00:00:00Z",
            },
          ],
        },
        event,
        "light",
      ),
    ).toBe(false);
  });
  it("keeps guests limited to the productions they can actually access", () => {
    const guest = {
      ...member,
      grants: [
        { role: "guest" as const, scope: "production" as const, scopeId: "private-production" },
      ],
    };
    expect(
      rowReadable(
        { ...context, user: guest, grants: guest.grants },
        { ...event, productionId: "private-production" } as never,
        refs,
      ),
    ).toBe(false);
  });
  it("projects only title, colour and period fields for referenced productions", () => {
    const raw = [
      {
        id: "private-production",
        data: {
          title: "QA Stück",
          color: "#537fba",
          season: "2026/2027",
          premiere: "2026-11-12",
          budget: 80000,
          memberIds: ["other"],
          notes: "internal",
        },
      },
      { id: "unreferenced", data: { title: "Unreferenced", color: "#123456" } },
    ];
    const projected = reducedCalendarProductions(raw, [event]);
    expect(projected).toEqual([
      {
        id: "private-production",
        data: { title: "QA Stück", color: "#537fba", season: "2026/2027", premiere: "2026-11-12" },
      },
    ]);
    expect(calendarPresentation(event, projected).title).toContain("QA Stück");
    expect(calendarPresentation(event, projected).color).toBe("#537fba");
    expect(
      selectExportRecords({
        kind: "events",
        records: [event],
        season: "2026/2027",
        calendarProductions: projected,
      }),
    ).toEqual([event]);
    expect(
      selectExportRecords({
        kind: "events",
        records: [event],
        season: "2025/2026",
        calendarProductions: projected,
      }),
    ).toEqual([]);
  });
  it("merges newly paged references without replacing internal production collections", () => {
    expect(
      mergeCalendarProductions(
        [{ id: "one", data: { title: "Old", color: "#123456" } }],
        [
          { id: "one", data: { title: "New", color: "#234567" } },
          { id: "two", data: { title: "Next", color: "#345678" } },
        ],
      ),
    ).toEqual([
      { id: "one", data: { title: "New", color: "#234567" } },
      { id: "two", data: { title: "Next", color: "#345678" } },
    ]);
  });
});
