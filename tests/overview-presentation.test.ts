import { describe, expect, it } from "vitest";
import {
  audienceChart,
  chartMaximum,
  chartPointLabel,
  chartPercent,
  comparisonChange,
  overviewMoney,
  overviewNumber,
  productionReadiness,
} from "../src/shared/overview-presentation";

describe("honest dashboard presentation", () => {
  const trend = [
    { month: "2026-08", reports: 0, visitors: 0, incomeCents: 0, occupancy: null },
    { month: "2026-09", reports: 1, visitors: 0, incomeCents: 0, occupancy: 0 },
    { month: "2026-10", reports: 2, visitors: 508, incomeCents: 944000, occupancy: 81.9 },
  ];
  it("distinguishes an absent observation from a reported zero in every metric", () => {
    for (const metric of ["visitors", "incomeCents", "occupancy"] as const) {
      expect(
        audienceChart(trend, metric)
          .map((point) => point.value)
          .slice(0, 2),
      ).toEqual([null, 0]);
    }
  });
  it("charts revenue in euros and labels months in the local language", () => {
    expect(audienceChart(trend, "incomeCents")[2]).toEqual({ label: "Okt. 26", value: 9440 });
  });
  it("preserves exact cents in revenue point labels, including reported zero", () => {
    const point = audienceChart(
      [{ month: "2026-10", reports: 1, visitors: 1, incomeCents: 1337, occupancy: 50 }],
      "incomeCents",
    )[0];
    expect(chartPointLabel(point.value!, "€")).toBe("13,37");
    expect(chartPointLabel(0, "€")).toBe("0,00");
    expect(chartPointLabel(3200, "€")).toBe("3.200,00");
    expect(chartPointLabel(81.8, "%")).toBe("81,8");
  });
  it("never treats a production with no required trades as fully confirmed", () => {
    const row = { id: "demo", title: "Synthetic", stage: "concept", missing: [] };
    expect(
      productionReadiness([
        { ...row, confirmed: 0, required: 0 },
        { ...row, confirmed: 0, required: 7 },
        { ...row, confirmed: 7, required: 7 },
      ]),
    ).toEqual({ ready: 1, pending: 1, unconfigured: 1 });
  });
  it("keeps chart geometry bounded for empty, negative and overspent budgets", () => {
    expect(chartPercent(10, 0)).toBe(0);
    expect(chartPercent(-10, 100)).toBe(0);
    expect(chartPercent(120, 100)).toBe(100);
    expect(chartPercent(850, 27500)).toBeCloseTo(3.09, 2);
  });
  it("keeps a sensible axis for no observations, all zero values and occupancy", () => {
    expect(chartMaximum([])).toBe(1);
    expect(chartMaximum([{ label: "test", value: null }])).toBe(1);
    expect(chartMaximum([{ label: "test", value: 81.9 }], 100)).toBe(100);
    expect(chartMaximum([{ label: "test", value: 508 }])).toBeGreaterThanOrEqual(508);
  });
  it("does not invent a percentage comparison for missing reports or a zero baseline", () => {
    expect(comparisonChange(508, 0, 2)).toBeNull();
    expect(comparisonChange(508, 400, 0)).toBeNull();
    expect(comparisonChange(508, 400, 2)).toBe(27);
    expect(comparisonChange(0, 400, 2)).toBe(-100);
  });
  it("uses consistent German decimal and currency formatting", () => {
    expect(overviewNumber(168.3, 1)).toBe("168,3");
    expect(overviewMoney(944000)).toBe("9.440,00 €");
  });
});
