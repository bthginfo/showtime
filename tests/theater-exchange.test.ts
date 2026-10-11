import { describe, it, expect } from "vitest";
import { parseExchange, mapExchangeRow, exportCSV, iCalendar } from "@/shared/exchange";
import { showtechMetadata } from "@/modules/theater/showtech";
import { zipSync, strToU8 } from "fflate";
import { offlineCueHtml } from "@/modules/theater/offline";
describe("open exchange formats", () => {
  it("parses German CSV, BOM, quoted lines and structured list mapping", () => {
    const rows = parseExchange('\ufeffTitel;Cent;Team\r\n"Probe; groß";12,5;a|b', "csv");
    expect(rows[0].Titel).toBe("Probe; groß");
    expect(
      mapExchangeRow(rows[0], { amountCents: "Cent", participantIds: "Team" }, [
        { key: "amountCents", label: "Geld", type: "number" },
        { key: "participantIds", label: "Team", type: "members" },
      ]),
    ).toEqual({ amountCents: 12.5, participantIds: ["a", "b"] });
  });
  it("rejects malformed imports and ignores explicitly unmapped columns", () => {
    expect(() => parseExchange("{}", "json")).toThrow();
    expect(() => parseExchange("__proto__;x\na;b", "csv")).toThrow();
    expect(
      mapExchangeRow({ title: "Text" }, { title: "" }, [
        { key: "title", label: "Titel", type: "text" },
      ]),
    ).toEqual({});
  });
  it("neutralizes spreadsheet formula injection while retaining export values", () => {
    const csv = exportCSV([{ title: '=HYPERLINK("evil")', ids: ["a", "b"] }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("a|b");
  });
  it("folds iCalendar on UTF8 byte boundaries, escapes text and exports UTC", () => {
    const ics = iCalendar([
      {
        id: "id-1",
        title: "ä".repeat(90) + "; Zeile\nneu",
        start: "2026-10-25T01:30:00Z",
        end: "2026-10-25T02:30:00Z",
        version: 3,
      },
    ]);
    expect(ics).toContain("DTSTART:20261025T013000Z");
    expect(ics).toContain("CLASS:PRIVATE");
    expect(ics).toContain("SEQUENCE:3");
    for (const line of ics.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it("imports bounded MVR addresses without guessing fixture footprint", () => {
    const zip = zipSync({
      "GeneralSceneDescription.xml": strToU8(
        '<GeneralSceneDescription verMajor="1" verMinor="6"><Fixture name="Spot" uuid="qa1"><Addresses><Address break="0">513</Address></Addresses><GDTFMode>Standard</GDTFMode></Fixture></GeneralSceneDescription>',
      ),
    });
    expect(showtechMetadata(zip, "mvr").rows[0]).toMatchObject({
      title: "Spot",
      dmxUniverse: 2,
      dmxAddress: 1,
      externalId: "qa1:0",
    });
    expect(showtechMetadata(zip, "mvr").rows[0]).not.toHaveProperty("footprint");
  });
  it("imports GDTF model and mode into a usable catalog row and rejects entities", () => {
    const zip = zipSync({
      "description.xml": strToU8(
        '<GDTF DataVersion="1.2"><FixtureType Manufacturer="QA" Name="Fixture" FixtureTypeID="test"><DMXModes><DMXMode Name="16ch"><DMXChannels><DMXChannel Offset="1,2"/><DMXChannel Offset="16"/></DMXChannels></DMXMode></DMXModes></FixtureType></GDTF>',
      ),
    });
    expect(showtechMetadata(zip, "gdtf").rows[0]).toMatchObject({
      model: "Fixture",
      mode: "16ch",
      footprint: 16,
    });
    expect(() =>
      showtechMetadata(
        zipSync({ "description.xml": strToU8('<!DOCTYPE x [<!ENTITY x "secret">]><GDTF/>') }),
        "gdtf",
      ),
    ).toThrow();
  });
  it("offline cue extracts escape all markup and work with no network or scripts", () => {
    const html = offlineCueHtml(
      "<Production>",
      [
        {
          title: "<script>alert(1)</script>",
          version: 4,
          module: "Licht",
          sequence: 1,
          trigger: "Signal",
          action: "<img src=x onerror=x>",
        },
      ],
      "2026-10-11",
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|<img|<link/i);
    expect(html).toContain("2026-10-11");
  });
});
