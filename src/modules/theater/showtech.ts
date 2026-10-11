import { unzipSync, strFromU8 } from "fflate";
import { load } from "cheerio";
import { HttpError } from "@/platform/http";
/** Extract bounded metadata only; never execute XML directives, geometry or device commands. */
export function showtechMetadata(bytes: Uint8Array, format: "mvr" | "gdtf") {
  if (bytes.length > 4_000_000)
    throw new HttpError(
      413,
      "Für die Metadatenvorschau höchstens 4 MB verwenden; große Originale als private Anlage hochladen.",
    );
  const target = format === "mvr" ? "GeneralSceneDescription.xml" : "description.xml";
  let files: ReturnType<typeof unzipSync>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (file.name !== target) return false;
        if (file.originalSize > 2_000_000) throw new Error("XML too large");
        return true;
      },
    });
  } catch {
    throw new HttpError(400, "Archiv ist ungültig oder seine XML-Metadaten sind zu groß.");
  }
  if (files[target]?.length > 2_000_000)
    throw new HttpError(413, "Die XML-Metadaten sind zu groß.");
  if (!files[target])
    throw new HttpError(400, "Das Archiv enthält nicht die erforderliche " + target + ".");
  const xml = strFromU8(files[target]);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new HttpError(400, "XML-Dokumenttyp- und Entitätsdefinitionen sind nicht zulässig.");
  const $ = load(xml, { xml: true });
  if (format === "gdtf") {
    const type = $("FixtureType").first();
    if (!type.length) throw new HttpError(400, "Keine GDTF-Gerätedefinition gefunden.");
    const modes = $("DMXMode")
      .toArray()
      .map((node) => {
        const mode = $(node),
          offsets = mode
            .find("DMXChannel")
            .toArray()
            .flatMap((c) =>
              String($(c).attr("Offset") || "")
                .split(",")
                .map(Number),
            )
            .filter((n) => Number.isInteger(n) && n > 0);
        return {
          name: mode.attr("Name") || "",
          footprint: offsets.length ? Math.max(...offsets) : null,
        };
      });
    if (modes.length > 100) throw new HttpError(413, "Höchstens 100 Geräte-Modi pro Vorschau.");
    const manufacturer = type.attr("Manufacturer") || "Unbekannt",
      model = type.attr("Name") || "Gerät",
      fixtureTypeId = type.attr("FixtureTypeID") || "";
    return {
      format,
      version: $("GDTF").attr("DataVersion"),
      manufacturer,
      model,
      fixtureTypeId,
      modes,
      rows: modes.map((mode) => ({
        title: manufacturer + " " + model + " · " + mode.name,
        manufacturer,
        model,
        mode: mode.name,
        footprint: mode.footprint,
        fixtureTypeId,
        externalId: fixtureTypeId + ":" + mode.name,
        notes:
          "Importiertes GDTF-Profil. Mehrere Breaks und Geometrie-Referenzen am Original prüfen.",
      })),
      warnings: [
        "Kanal-Footprints mit Geometrie-Referenzen und mehreren DMX-Breaks müssen am Original geprüft werden.",
      ],
    };
  }
  if (!$("GeneralSceneDescription").length)
    throw new HttpError(400, "Keine MVR-Szenenbeschreibung gefunden.");
  const fixtures = $("Fixture").toArray();
  if (fixtures.length > 100)
    throw new HttpError(413, "Die Vorschau unterstützt bis zu 100 Geräte pro Datei.");
  const rows = fixtures.flatMap((node) => {
    const fixture = $(node),
      addresses = fixture.children("Addresses").children("Address").toArray();
    return addresses.map((a) => {
      const absolute = Number($(a).text()),
        address = ((absolute - 1) % 512) + 1,
        universe = Math.floor((absolute - 1) / 512) + 1;
      if (!Number.isSafeInteger(absolute) || absolute < 1 || universe > 63999)
        throw new HttpError(400, "Die Szene enthält eine ungültige absolute DMX-Adresse.");
      return {
        title: fixture.attr("name") || fixture.attr("uuid") || "Gerät",
        fixture: fixture.attr("name") || "Gerät",
        externalId:
          (fixture.attr("uuid") || fixture.attr("name") || "fixture") +
          ":" +
          ($(a).attr("break") || "0"),
        dmxAddress: address,
        dmxUniverse: universe,
        gdtfMode: fixture.children("GDTFMode").text(),
        gdtfSpec: fixture.children("GDTFSpec").text(),
      };
    });
  });
  return {
    format,
    version:
      $("GeneralSceneDescription").attr("verMajor") +
      "." +
      $("GeneralSceneDescription").attr("verMinor"),
    rows,
    warnings: [
      "Die Kanalanzahl wird nicht geraten. Ergänze je Gerät den geprüften Footprint und die Inventar-ID vor dem Patchimport.",
      "Geometrie und CAD bleiben in der privaten Originaldatei. Keine Steuerbefehle werden ausgeführt.",
    ],
  };
}
