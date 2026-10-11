import { describe, it, expect } from "vitest";
import { theaterSlug, tenantInput } from "@/shared/tenant-management";
import {
  migratedId,
  prepareMigration,
  remapData,
  migratedRoles,
} from "@/platform/migration/digitalmask";

describe("theater creation and isolated DigitalMask migration", () => {
  it("suggests a valid readable German theater identifier", () => {
    expect(theaterSlug("  Städtische Bühne – München  ")).toBe("staedtische-buehne-muenchen");
    expect(
      tenantInput.safeParse({
        name: "Stadttheater Ingolstadt",
        slug: theaterSlug("Stadttheater Ingolstadt"),
      }).success,
    ).toBe(true);
    for (const slug of ["", "a", "-theater", "theater-", "Bad Identifier", "../theater"])
      expect(tenantInput.safeParse({ name: "Theater", slug }).success).toBe(false);
    const long = theaterSlug("Bühne ".repeat(40));
    expect(long.length).toBeLessThanOrEqual(63);
    expect(long.endsWith("-")).toBe(false);
  });
  it("never reuses IDs across destination theaters", () => {
    expect(migratedId("A", "source-id")).toBe(migratedId("A", "source-id"));
    expect(migratedId("A", "source-id")).not.toBe(migratedId("B", "source-id"));
  });
  it("remaps private recipients, reactions, references and internal links while preserving content", () => {
    const map = new Map([
      ["old-user", "new-user"],
      ["old-record", "new-record"],
      ["other-user", "another-user"],
    ]);
    expect(
      remapData(
        {
          participantIds: ["old-user"],
          reactions: { "old-user": "yes" },
          nested: { recordId: "old-record", notes: "Bühnenprobe" },
          link: "/?module=productions&record=old-record",
          fileLink: "/api/files/old-record",
          directKey: "old-user:other-user",
          content: "old-user:other-user",
        },
        map,
      ),
    ).toEqual({
      participantIds: ["new-user"],
      reactions: { "new-user": "yes" },
      nested: { recordId: "new-record", notes: "Bühnenprobe" },
      link: "/?module=productions&record=new-record",
      fileLink: "/api/files/new-record",
      directKey: "another-user:new-user",
      content: "old-user:other-user",
    });
  });
  it("maps legacy superadmins to theater roles without platform privileges", () => {
    expect(migratedRoles("superadmin")).toContain("theater_admin");
    expect(migratedRoles("admin")).not.toContain("theater_admin");
    expect(migratedRoles("user")).toEqual(["employee"]);
  });
  it("refuses to merge a multi-theater export into one tenant", () => {
    const snapshot = {
      source: "DigitalMask production",
      createdAt: "2026-10-11",
      tables: {
        organizations: [{ id: "source-org" }],
        departments: [{ id: "source-dep" }],
        records: [{ id: "source-rec", organization_id: "source-org", department_id: "source-dep" }],
      },
    };
    const { remap } = prepareMigration(snapshot, "target-org", "target-dep");
    expect(remap(snapshot.tables.records[0])).toMatchObject({
      organization_id: "target-org",
      department_id: "target-dep",
    });
    expect(() =>
      prepareMigration(
        { ...snapshot, tables: { ...snapshot.tables, organizations: [{ id: "A" }, { id: "B" }] } },
        "target",
        "dep",
      ),
    ).toThrow();
  });
});
