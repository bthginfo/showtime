import { describe, expect, it } from "vitest";
import {
  collaborationReadable,
  collaborationApprover,
  collaborationContributor,
} from "@/shared/collaboration";
import type { CollaborationSubject } from "@/shared/collaboration";
import { tradeGuides } from "@/shared/trade-guides";
import { moduleRegistry, validateFeature } from "@/modules/theater/registry";
import { audienceOccupancy } from "@/shared/theater-overview";

const row = {
  departmentId: "costume",
  productionId: "play",
  createdBy: "sender",
  data: { recipientDepartmentId: "makeup" },
};
function subject(
  id: string,
  departmentId: string,
  role: "employee" | "team_lead" | "theater_admin" | "intendance" = "employee",
): CollaborationSubject {
  return {
    id,
    departmentId,
    activeDepartmentIds: [departmentId],
    grants: [{ role, scope: "department", scopeId: departmentId }],
  };
}
describe("cross-trade participation and decisions", () => {
  it("admits only current participating trades, including with broad tenant grants", () => {
    expect(collaborationReadable(subject("sender", "costume"), row)).toBe(true);
    expect(collaborationReadable(subject("receiver", "makeup"), row)).toBe(true);
    expect(collaborationReadable(subject("outsider", "lighting"), row)).toBe(false);
    expect(
      collaborationReadable(
        {
          ...subject("lead", "lighting", "intendance"),
          grants: [{ role: "intendance", scope: "tenant", scopeId: null }],
        },
        row,
      ),
    ).toBe(false);
  });
  it("requires another receiving team lead for approvals", () => {
    expect(collaborationApprover(subject("receiver", "makeup"), row)).toBe(false);
    expect(collaborationApprover(subject("receiver", "makeup", "team_lead"), row)).toBe(true);
    expect(collaborationApprover(subject("sender", "makeup", "team_lead"), row)).toBe(false);
    expect(collaborationApprover(subject("other", "lighting", "team_lead"), row)).toBe(false);
  });
  it("revokes old participation when the relevant membership is withdrawn", () => {
    expect(
      collaborationReadable(
        { ...subject("receiver", "makeup"), activeDepartmentIds: ["lighting"] },
        row,
      ),
    ).toBe(false);
    expect(
      collaborationContributor(
        { ...subject("sender", "costume"), activeDepartmentIds: ["lighting"] },
        row,
      ),
    ).toBe(false);
    expect(collaborationReadable(subject("platform-admin", "makeup", "theater_admin"), row)).toBe(
      false,
    );
  });
  it("does not grant file contributions through a read-only guest role", () => {
    const guest: CollaborationSubject = {
      id: "guest",
      departmentId: "makeup",
      activeDepartmentIds: ["makeup"],
      grants: [{ role: "guest", scope: "production", scopeId: "play" }],
    };
    expect(collaborationReadable(guest, row)).toBe(true);
    expect(collaborationContributor(guest, row)).toBe(false);
  });
});
describe("trade guide and audience reporting coverage", () => {
  it("provides a specific guide and existing partner for every active module", () => {
    expect(Object.keys(tradeGuides).sort()).toEqual(
      moduleRegistry.map((module) => module.id).sort(),
    );
    for (const module of moduleRegistry) {
      const guide = tradeGuides[module.id];
      expect(guide.work.length).toBeGreaterThan(40);
      expect(moduleRegistry.some((partner) => partner.id === guide.target)).toBe(true);
    }
  });
  it("rejects fractional or negative audience counts and preserves missing occupancy", () => {
    const data = {
      performanceId: "show",
      offeredSeats: 100,
      visitors: 82,
      paidTickets: 80,
      complimentaryTickets: 2,
      amountCents: 160000,
    };
    expect(() =>
      validateFeature("front-of-house", "audience-report", { ...data, visitors: 82.5 }),
    ).toThrow();
    expect(() =>
      validateFeature("front-of-house", "audience-report", { ...data, paidTickets: -1 }),
    ).toThrow();
    expect(validateFeature("front-of-house", "audience-report", data).data.visitors).toBe(82);
    expect(audienceOccupancy(0, 0)).toBeNull();
    expect(audienceOccupancy(240, 300)).toBe(80);
  });
});
