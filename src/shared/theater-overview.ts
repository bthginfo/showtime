export type TheaterOverview = {
  generatedAt: string;
  period: { from: string; to: string };
  productionCount: number;
  performances: { total: number; played: number; cancelled: number; upcoming: number };
  readiness: { confirmed: number; required: number; readyProductions: number };
  requests: { open: number; overdue: number; changesRequested: number };
  blockedItems: number;
  budget: {
    plannedCents: number;
    committedCents: number;
    pendingCents: number;
    remainingCents: number;
    orderedCents: number;
    invoicedCents: number;
    paidCents: number;
    forecastCents: number;
  };
  audience: {
    reports: number;
    reportablePerformances: number;
    visitors: number;
    offeredSeats: number;
    paidTickets: number;
    complimentaryTickets: number;
    incomeCents: number;
    occupancy: number | null;
  };
  productions: {
    id: string;
    title: string;
    stage: string;
    confirmed: number;
    required: number;
    missing: string[];
  }[];
  trend: {
    month: string;
    visitors: number;
    incomeCents: number;
    reports: number;
    occupancy: number | null;
  }[];
  comparison: {
    label: string;
    visitors: number;
    incomeCents: number;
    reports: number;
    occupancy: number | null;
  };
  seasons: { id: string; label: string; start: string; end: string }[];
  workload: { plannedHours: number; people: number; over40Hours: number; available: boolean };
};
export function audienceOccupancy(visitors: number, seats: number) {
  return seats > 0 ? Math.round((visitors / seats) * 1000) / 10 : null;
}
