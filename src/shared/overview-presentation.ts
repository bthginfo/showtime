import type { TheaterOverview } from "./theater-overview";

export const overviewNumber = (value: number, decimals = 0) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: decimals }).format(value);
export const overviewMoney = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
export const chartPointLabel = (value: number, unit: string) =>
  unit === "€"
    ? new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        value,
      )
    : overviewNumber(value, 1);

export function chartPercent(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
}

export function productionReadiness(productions: TheaterOverview["productions"]) {
  return {
    ready: productions.filter((p) => p.required > 0 && p.confirmed >= p.required).length,
    pending: productions.filter((p) => p.required > 0 && p.confirmed < p.required).length,
    unconfigured: productions.filter((p) => p.required === 0).length,
  };
}

export type AudienceMetric = "visitors" | "incomeCents" | "occupancy";
export type OverviewChartPoint = { label: string; value: number | null };

export function audienceChart(
  trend: TheaterOverview["trend"],
  metric: AudienceMetric,
): OverviewChartPoint[] {
  return trend.map((month) => ({
    label: new Intl.DateTimeFormat("de-DE", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(month.month + "-01T12:00:00Z")),
    // Missing reports are missing observations, never zero visitors or revenue.
    value:
      month.reports > 0
        ? metric === "incomeCents"
          ? month.incomeCents / 100
          : month[metric]
        : null,
  }));
}

export function chartMaximum(points: OverviewChartPoint[], minimum = 0) {
  const maximum = Math.max(minimum, ...points.map((point) => point.value ?? 0));
  if (maximum <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  return [1, 2, 3, 4, 5, 6, 8, 10].find((step) => step * magnitude >= maximum)! * magnitude;
}

export function comparisonChange(current: number, previous: number, reports: number) {
  return reports > 0 && previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;
}
