import { describe, it, expect } from "vitest";
import { moduleRegistry } from "@/modules/theater/registry";
import { primaryTradeFields } from "@/shared/trade-form-presentation";
import { primaryResourceFields } from "@/shared/resource-form-presentation";
import { fields as resourceFields } from "@/components/resource-fields";
import { planningEventLabel, planningEventOptions } from "@/shared/planning-presentation";
import type { DomainRecord } from "@/shared/contracts";
describe("progressive trade forms", () => {
  it("keeps mandatory inputs available in all shared resource editors", () => {
    for (const fields of Object.values(resourceFields)) {
      const primary = primaryResourceFields(fields);
      for (const field of fields.filter((field) => field.required))
        expect(primary).toContain(field);
    }
  });
  it("keeps every required field visible across every registered trade and workflow", () => {
    for (const module of moduleRegistry)
      for (const feature of module.features) {
        const primary = primaryTradeFields(feature.fields);
        for (const field of feature.fields.filter((field) => field.required && !field.managed))
          expect(primary, module.id + "/" + feature.id).toContain(field);
        expect(primary.some((field) => field.managed)).toBe(false);
      }
  });
  it("reduces long forms while retaining dates and participants", () => {
    const fields = moduleRegistry
      .find((module) => module.id === "disposition")!
      .features.find((feature) => feature.id === "rehearsal")!.fields;
    const main = primaryTradeFields(fields);
    expect(main.length).toBeLessThan(fields.length);
    expect(main.map((field) => field.key)).toEqual(
      expect.arrayContaining(["start", "end", "participantIds", "resourceId"]),
    );
  });
  it("gives structured lighting inputs priority over imported free-text address notes", () => {
    const fields = moduleRegistry
      .find((module) => module.id === "lighting")!
      .features.find((feature) => feature.id === "patch")!.fields;
    const keys = primaryTradeFields(fields).map((field) => field.key);
    expect(keys).toEqual(
      expect.arrayContaining(["fixture", "assetId", "dmxAddress", "dmxUniverse", "footprint"]),
    );
    expect(keys).not.toContain("address");
    expect(keys).not.toContain("universe");
    expect(fields.find((field) => field.key === "address")?.label).toContain("Freitext");
  });
  it("uses a readable fallback for unnamed appointments and orders dates chronologically", () => {
    const event = (id: string, start: string, title: string): DomainRecord => ({
      id,
      kind: "events",
      organizationId: "qa",
      departmentId: "qa",
      createdBy: "qa",
      createdAt: "",
      updatedAt: "",
      version: 1,
      data: { start, title },
    });
    expect(planningEventLabel(event("a", "2026-10-12T08:00:00Z", "  "))).toBe("Termin ohne Titel");
    const options = planningEventOptions(
      [event("late", "2026-10-13T08:00:00Z", "Probe"), event("early", "2026-10-12T08:00:00Z", "")],
      "Europe/Berlin",
      [],
    );
    expect(options.map((option) => option.id)).toEqual(["early", "late"]);
    expect(options[0].detail).toContain("10:00");
  });
  it("makes Intendanz an independent registry module without inventing technical readiness", () => {
    const leadership = moduleRegistry.find((module) => module.id === "intendance")!;
    expect(leadership.department).toBe("Intendanz");
    expect(leadership.features.map((feature) => feature.id)).toEqual(["decision", "priority"]);
    expect(leadership.features.every((feature) => feature.private)).toBe(true);
  });
  it("only labels actual recurring appointments as series", () => {
    const events: DomainRecord[] = ["none", "daily", "weekly"].map((recurrence, index) => ({
      id: recurrence,
      kind: "events",
      organizationId: "qa",
      departmentId: "qa",
      createdBy: "qa",
      createdAt: "",
      updatedAt: "",
      version: 1,
      data: { recurrence, start: `2026-10-${12 + index}T08:00:00Z`, title: "Probe" },
    }));
    const options = planningEventOptions(events, "Europe/Berlin", []);
    expect(options[0].detail).not.toContain("Terminserie");
    expect(options[1].detail).toContain("Terminserie");
    expect(options[2].detail).toContain("Terminserie");
  });
});
