import { describe, expect, it } from "vitest";
import { tradeDisplay, tradeCurrentDisplay } from "../src/shared/trade-display";
import type { Workspace } from "../src/shared/contracts";
import type { Planning } from "../src/modules/theater/types";

const workspace = {
  members: [{ id: "member-a", name: "Leitung Maske" }],
  records: {
    actors: [{ id: "actor-a", data: { name: "Darstellerin" } }],
    files: [{ id: "file-a", data: { title: "Modellfassung" } }],
  },
} as unknown as Workspace;
const planning = {
  timezone: "Europe/Berlin",
  items: [{ id: "trade-a", title: "Szenenfassung 2" }],
  departments: [{ id: "department-a", name: "Ausstattung" }],
  resources: [{ id: "resource-a", name: "Probebühne" }],
  funding: [{ id: "budget-a", title: "Produktionsbudget" }],
  performances: [],
  tradeFiles: [],
} as unknown as Planning;

describe("readable references in shared trade views", () => {
  it("does not present stale or unverified managed fields as an active approval", () => {
    const field = { key: "release", managed: "approval" as const };
    expect(tradeCurrentDisplay(true, field, workspace, planning, false)).toBe(
      "Freigabe noch erforderlich",
    );
    expect(tradeCurrentDisplay("approved", field, workspace, planning)).toBe(
      "Freigabe noch erforderlich",
    );
  });
  it("shows an active managed approval only with the fresh verified proof", () => {
    const field = { key: "release", managed: "approval" as const };
    expect(tradeCurrentDisplay(true, field, workspace, planning, true)).toBe("Ja");
    expect(tradeCurrentDisplay("approved", field, workspace, planning, true)).toBe("Freigegeben");
  });
  it("uses accessible names for scalar and multiple references", () => {
    expect(tradeDisplay("member-a", { key: "owner", type: "member" }, workspace, planning)).toBe(
      "Leitung Maske",
    );
    expect(tradeDisplay(["trade-a"], { key: "sources", type: "trades" }, workspace, planning)).toBe(
      "Szenenfassung 2",
    );
    expect(
      tradeDisplay("department-a", { key: "department", type: "department" }, workspace, planning),
    ).toBe("Ausstattung");
    expect(tradeDisplay("budget-a", { key: "budget", type: "budget" }, workspace, planning)).toBe(
      "Produktionsbudget",
    );
  });
  it("finds records in accessible collections when a saved snapshot lacks source metadata", () => {
    expect(tradeDisplay("file-a", { key: "attachment", type: "record" }, workspace, planning)).toBe(
      "Modellfassung",
    );
    expect(
      tradeDisplay(
        "actor-a",
        { key: "actor", type: "record", source: "actors" },
        workspace,
        planning,
      ),
    ).toBe("Darstellerin");
  });
  it("keeps a reference outside the loaded page understandable without displaying internal IDs", () => {
    expect(
      tradeDisplay(
        "unloaded-private-reference",
        { key: "owner", type: "member" },
        workspace,
        planning,
      ),
    ).toBe("Zugeordnete Person");
    expect(
      tradeDisplay(
        "unloaded-private-reference",
        { key: "source", type: "trade" },
        workspace,
        planning,
      ),
    ).toBe("Verknüpfter Fachstand (separat öffnen)");
    expect(
      tradeDisplay(
        "unloaded-private-reference",
        { key: "attachment", type: "record" },
        workspace,
        planning,
      ),
    ).toBe("Verknüpfter Eintrag");
  });
  it("retains the recorded date and uses the theater's local formatting", () => {
    expect(tradeDisplay("2026-10-12", { key: "day", type: "date" }, workspace, planning)).toBe(
      "12.10.2026",
    );
  });
});
