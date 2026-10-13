import { describe, expect, it } from "vitest";
import {
  rightsDeadline,
  publicationGaps,
  policySchema,
  nonClinicalPayload,
} from "@/modules/privacy/model";
import { hasPermission } from "@/platform/access";
import { calendarDayCreditCategory } from "@/modules/time-tracking/day-credits";
import type { DomainRecord } from "@/shared/contracts";
describe("privacy workflows and independent accounting", () => {
  it("clamps a calendar-month deadline without substituting 30 days", () => {
    expect(rightsDeadline("2026-01-31T10:00:00Z").toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(rightsDeadline("2028-01-31T10:00:00Z").toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(rightsDeadline("2026-01-31T10:00:00Z", true).toISOString()).toBe(
      "2026-04-30T09:00:00.000Z",
    );
  });
  it("uses the theater's civil date at midnight and preserves local time across daylight saving", () => {
    expect(rightsDeadline("2026-01-30T23:30:00Z").toISOString()).toBe("2026-02-27T23:30:00.000Z");
    expect(rightsDeadline("2026-03-15T10:00:00Z").toISOString()).toBe("2026-04-15T09:00:00.000Z");
    expect(rightsDeadline("2026-01-30T23:30:00Z", false, "UTC").toISOString()).toBe(
      "2026-02-28T23:30:00.000Z",
    );
  });
  it("does not publish unknown controllers or unreviewed legal bases", () => {
    const policy = policySchema.parse({ controller: {}, purposes: [] });
    expect(publicationGaps(policy)).toHaveLength(6);
  });
  it("privacy administration alone gives no personnel, chat or production access", () => {
    const subject = {
      id: "qa",
      grants: [{ role: "privacy_officer" as const, scope: "tenant" as const, scopeId: null }],
    };
    expect(hasPermission(subject, "privacy.manage")).toBe(true);
    for (const permission of [
      "time.team.read",
      "personnel.read",
      "production.read",
      "chat.read",
    ] as const)
      expect(hasPermission(subject, permission)).toBe(false);
  });
  it("uses a reason-free accounting unit even when the event has a neutral label", () => {
    const event: DomainRecord = {
      id: "qa",
      organizationId: "qa",
      departmentId: "qa",
      createdBy: "qa",
      createdAt: "2026-10-13T00:00:00Z",
      updatedAt: "2026-10-13T00:00:00Z",
      version: 1,
      kind: "events",
      data: { category: "absence", privacyNeutral: true, creditUnit: "weekly-sixth" },
    };
    expect(calendarDayCreditCategory(event, [])).toBe(true);
    expect(
      calendarDayCreditCategory({ ...event, data: { ...event.data, creditUnit: "none" } }, []),
    ).toBe(false);
    expect(
      calendarDayCreditCategory(
        { ...event, data: { category: "absence", privacyNeutral: true } },
        [],
      ),
    ).toBe(false);
    expect(
      calendarDayCreditCategory(
        { ...event, data: { category: "rest", creditUnit: "weekly-sixth" } },
        [],
      ),
    ).toBe(false);
  });
  it("blocks known clinical field content while allowing operational absence copy", () => {
    expect(nonClinicalPayload({ title: "Abwesenheit", creditUnit: "weekly-sixth" })).toBe(true);
    expect(nonClinicalPayload({ title: "Krank mit Attest" })).toBe(false);
    expect(nonClinicalPayload({ person: { diagnosis: "medizinischer Befund" } })).toBe(false);
    expect(nonClinicalPayload({ person: { diagnosis: "Positiv" } })).toBe(false);
    expect(nonClinicalPayload({ allergies: "Penicillin" })).toBe(false);
  });
});
