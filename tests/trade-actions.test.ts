import { describe, expect, it } from "vitest";
import { moduleById, moduleRegistry, validateFeature } from "@/modules/theater/registry";
import { tradeActions, tradeStatus } from "@/shared/trade-actions";
import { primaryTradeFields } from "@/shared/trade-form-presentation";
import { tradeFeatureDescription, tradeSummaryFields } from "@/shared/trade-presentation";
import type { TradeItem } from "@/modules/theater/types";
import type { Grant } from "@/platform/access";
const subject = (role: Grant["role"], id = "me") => ({
  id,
  grants: [{ role, scope: "department", scopeId: "dept" }] as Grant[],
});
const item = (changes: Partial<TradeItem> = {}): TradeItem => ({
  id: "item",
  moduleId: "direction",
  type: "rehearsal-report",
  departmentId: "dept",
  productionId: "production",
  createdBy: "me",
  status: "draft",
  version: 1,
  title: "Probe",
  data: {},
  performanceId: null,
  updatedAt: "2026-10-15T10:00:00Z",
  ...changes,
});
const actions = (role: Grant["role"], row: TradeItem, active = "dept") =>
  tradeActions(
    subject(role),
    row,
    moduleById(row.moduleId)?.features.find((f) => f.id === row.type),
    active,
  );
describe("trade action affordances", () => {
  it("lets employees edit their own reports but not a colleague's report", () => {
    expect(actions("employee", item()).edit).toBe(true);
    expect(actions("employee", item({ createdBy: "colleague" })).edit).toBe(false);
    expect(actions("employee", item({ createdBy: "colleague" })).successor).toBe(false);
    expect(actions("team_lead", item({ createdBy: "colleague" })).edit).toBe(true);
  });
  it("keeps upload rights distinct from edit and archive rights", () => {
    expect(actions("employee", item({ createdBy: "colleague" })).attach).toBe(true);
    expect(actions("employee", item({ status: "archived" })).attach).toBe(false);
  });
  it("never offers a cross-workplace or private followup", () => {
    expect(actions("employee", item()).followup).toBe(true);
    expect(actions("employee", item(), "elsewhere").followup).toBe(false);
    expect(actions("employee", item({ status: "cancelled" })).followup).toBe(false);
    expect(actions("intendance", item({ moduleId: "intendance", type: "decision" })).followup).toBe(
      false,
    );
  });
  it("keeps immutable movements and decided purchases out of edit flows", () => {
    const stock = actions("team_lead", item({ type: "stock-movement" }));
    expect(stock.edit).toBe(false);
    expect(stock.successor).toBe(false);
    expect(
      actions(
        "intendance",
        item({ moduleId: "administration", type: "purchase", status: "approved" }),
      ).edit,
    ).toBe(false);
  });
  it("allows a successor but no hiding an open loan or binding financial evidence", () => {
    const loan = actions("team_lead", item({ moduleId: "props", type: "loan", data: {} }));
    expect(loan.successor).toBe(true);
    expect(loan.archive).toBe(false);
    expect(loan.cancel).toBe(false);
    expect(
      actions(
        "team_lead",
        item({ moduleId: "props", type: "loan", data: { returnedAt: "2026-10-15" } }),
      ).archive,
    ).toBe(true);
    const budget = actions(
      "intendance",
      item({ moduleId: "administration", type: "budget", status: "published" }),
    );
    expect(budget.successor).toBe(true);
    expect(budget.archive).toBe(false);
  });
  it("presents real stock effects and readiness confirmations truthfully, including historic rows", () => {
    expect(tradeStatus(item({ type: "stock-movement", status: "draft" }))).toBe("Gebucht");
    expect(tradeStatus(item({ type: "loan", status: "draft" }))).toBe("Ausgeliehen");
    expect(tradeStatus(item({ type: "readiness", status: "ready", data: { ready: false } }))).toBe(
      "Noch offen",
    );
  });
});
describe("usable fach contracts", () => {
  it.each([
    ["stage-management", "cue-edition", "cueIds"],
    ["sound", "routing-edition", "channelIds"],
  ])("rejects empty required lists in %s/%s", (module, type, key) => {
    expect(() => validateFeature(module, type, { revision: "A", [key]: [] })).toThrow();
    expect(() =>
      validateFeature(module, type, { revision: "A", [key]: ["reference"] }),
    ).not.toThrow();
  });
  it("keeps operative sound and costume fields visible before legacy text", () => {
    for (const [module, type, keys] of [
      ["sound", "channel", ["actorId", "assetId", "channelNumber", "frequencyMHz"]],
      ["costume", "costume", ["actorId", "characterId", "assetId"]],
    ] as const) {
      const feature = moduleById(module)!.features.find((f) => f.id === type)!;
      expect(primaryTradeFields(feature.fields).map((f) => f.key)).toEqual(
        expect.arrayContaining([...keys]),
      );
      expect(
        tradeSummaryFields(
          feature,
          Object.fromEntries(feature.fields.map((f) => [f.key, "value"])),
        ).map((f) => f.key),
      ).toEqual(expect.arrayContaining(keys.slice(0, 3)));
    }
  });
  it("describes every trade function and preserves required fields", () => {
    expect(moduleRegistry).toHaveLength(22);
    for (const module of moduleRegistry)
      for (const feature of module.features) {
        expect(
          tradeFeatureDescription(feature).length,
          module.id + "/" + feature.id,
        ).toBeGreaterThan(8);
        for (const field of feature.fields.filter((f) => f.required && !f.managed))
          expect(primaryTradeFields(feature.fields)).toContain(field);
      }
  });
});
