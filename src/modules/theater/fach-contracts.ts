import type { Field, Feature, ModuleManifest } from "./registry";
import type { Permission } from "@/platform/access";

const f = (key: string, label: string, type: Field["type"] = "text", required = false): Field => ({
  key,
  label,
  type,
  required,
});
const ref = (key: string, label: string, types: string[], required = false): Field => ({
  ...f(key, label, "trade", required),
  sourceTypes: types,
});
const actor = (key = "actorId", label = "Besetzung"): Field => ({
  ...f(key, label, "record"),
  source: "actors",
});
const character = (key = "characterId", label = "Figur"): Field => ({
  ...f(key, label, "record"),
  source: "characters",
});
const choice = (key: string, label: string, options: string[]): Field => ({
  ...f(key, label, "select"),
  options,
});
const approval = (): Field => ({
  ...choice("approval", "Geprüfte Freigabe", ["draft", "review", "approved"]),
  managed: "approval",
});
const feature = (
  id: string,
  label: string,
  fields: Field[],
  permission: Permission = "document.create",
  privateData = false,
): Feature => ({ id, label, fields, permission, private: privateData });
const slot = [
  f("start", "Beginn", "datetime", true),
  f("end", "Ende", "datetime", true),
  f("participantIds", "Beteiligte", "members"),
  f("resourceId", "Raum / Bühne", "resource"),
  f("pauseMinutes", "Pause (Min.)", "number"),
];
const add: Record<string, Feature[]> = {
  disposition: [
    feature(
      "scenario",
      "Planungsvariante",
      [f("revision", "Variante", "text", true), f("notes", "Ziel und Auswirkungen", "textarea")],
      "schedule.manage",
    ),
    feature(
      "milestone",
      "Produktionsmeilenstein",
      [
        f("deadline", "Abgabe", "date", true),
        f("responsibleId", "Verantwortlich", "member"),
        f("notes", "Abnahmekriterien", "textarea"),
      ],
      "schedule.manage",
    ),
  ],
  direction: [
    feature("scene", "Szenenfassung", [
      f("sequence", "Reihenfolge", "number"),
      f("revision", "Text-/Regiefassung", "text", true),
      f("blocking", "Wege und Aktionen", "textarea"),
      approval(),
    ]),
  ],
  dramaturgy: [
    feature("text-edition", "Text- und Lektoratsstand", [
      f("revision", "Fassung", "text", true),
      f("text", "Text", "textarea"),
      f("editorId", "Lektorat", "member"),
      f("rightsUntil", "Rechte bis", "date"),
      approval(),
    ]),
  ],
  ensemble: [
    feature("daily-sheet", "Tageszettel", [
      f("date", "Tag", "date", true),
      actor(),
      character(),
      f("participantIds", "Beteiligte", "members"),
      f("notes", "Tageshinweise", "textarea"),
    ]),
  ],
  "stage-management": [
    feature("cue-edition", "Gemeinsame Cue-Fassung", [
      f("revision", "Fassung", "text", true),
      { ...f("cueIds", "Zugehörige Fach-Cues", "trades", true), sourceTypes: ["cue"] },
      f("notes", "Vorstellungsablauf", "textarea"),
      approval(),
    ]),
    feature(
      "incident",
      "Vorfall und Nachverfolgung",
      [
        f("performanceId", "Vorstellung", "performance"),
        choice("priority", "Dringlichkeit", ["normal", "high", "urgent"]),
        f("fault", "Vorfall", "textarea", true),
        f("responsibleId", "Verantwortlich", "member"),
        f("deadline", "Klärung bis", "date"),
      ],
      "task.create",
    ),
  ],
  stage: [
    feature("decoration", "Dekorations- / Anlagenstand", [
      ref("assetId", "Teil / Anlage", ["asset"], true),
      f("drawingRevision", "Zeichnungsfassung", "text", true),
      f("qualification", "Erforderliche Qualifikation"),
      f("participantIds", "Ausführende", "members"),
      f("instructions", "Aufbau und Prüfung", "textarea"),
      approval(),
    ]),
  ],
  lighting: [
    feature(
      "device-profile",
      "GDTF-Geräteprofil",
      [
        f("manufacturer", "Hersteller", "text", true),
        f("model", "Gerätetyp", "text", true),
        f("mode", "DMX-Modus", "text", true),
        f("footprint", "Kanäle / Footprint", "number", true),
        f("fixtureTypeId", "GDTF-Typkennung"),
        f("notes", "Prüfhinweise", "textarea"),
      ],
      "inventory.manage",
    ),
    feature("focus-check", "Fokuscheckliste", [
      ref("patchId", "Patch-Stand", ["patch"], true),
      f("position", "Fokusposition"),
      f("checked", "Erledigt", "checkbox"),
      f("checkedBy", "Ausgeführt von", "member"),
      f("notes", "Abweichungen", "textarea"),
    ]),
  ],
  sound: [
    feature("routing-edition", "Geprüfter Routingstand", [
      { ...f("channelIds", "Kanäle", "trades", true), sourceTypes: ["channel"] },
      f("revision", "Fassung", "text", true),
      f("notes", "Signalwege", "textarea"),
      approval(),
    ]),
  ],
  video: [
    feature("delivery", "Medienabgabe", [
      ref("mediaId", "Medienfassung", ["media"], true),
      f("targetSystem", "Zielsystem", "text", true),
      f("codec", "Codec"),
      f("resolution", "Auflösung"),
      f("frameRate", "Bildrate", "number"),
      f("durationSeconds", "Länge (Sek.)", "number"),
      approval(),
    ]),
  ],
  workshops: [
    feature(
      "bom-line",
      "Stücklistenposition",
      [
        ref("orderId", "Herstellungsauftrag", ["order"], true),
        ref("assetId", "Material / Teil", ["asset"], true),
        f("quantity", "Benötigte Menge", "number", true),
        f("supplier", "Beschaffungsquelle"),
      ],
      "inventory.manage",
    ),
    feature(
      "manufacturing-step",
      "Herstellungsschritt",
      [
        ref("orderId", "Auftrag", ["order"], true),
        f("sequence", "Reihenfolge", "number"),
        f("responsibleId", "Verantwortlich", "member", true),
        f("hours", "Kapazitätsbedarf (Std.)", "number"),
        ...slot,
        f("instructions", "Arbeitsschritt", "textarea"),
      ],
      "schedule.manage",
    ),
  ],
  costume: [
    feature(
      "fitting",
      "Anprobetermin",
      [
        actor(),
        character(),
        ref("costumeId", "Kostümstand", ["costume"], true),
        ...slot,
        f("notes", "Anprobeauftrag", "textarea"),
      ],
      "schedule.manage",
    ),
    feature(
      "care-cycle",
      "Pflege und Rückgabe",
      [
        ref("assetId", "Fundusteil", ["asset"], true),
        choice("care", "Vorgang", ["clean", "repair", "return"]),
        f("nextService", "Nächster Termin", "date"),
        f("instructions", "Pflegeanweisung", "textarea"),
      ],
      "inventory.manage",
    ),
  ],
  makeup: [
    feature(
      "wig-care",
      "Perückenpflege",
      [
        ref("assetId", "Perücke", ["asset"], true),
        actor(),
        choice("care", "Vorgang", ["clean", "repair", "return"]),
        f("nextService", "Nächste Pflege", "date"),
        f("notes", "Pflegevermerk", "textarea"),
      ],
      "inventory.manage",
    ),
  ],
  props: [
    feature("show-check", "Preset / Rückstellung je Vorstellung", [
      f("performanceId", "Vorstellung", "performance", true),
      ref("propId", "Szenenrequisite", ["scene-prop"], true),
      f("presetChecked", "Preset geprüft", "checkbox"),
      f("returnChecked", "Rückstellung geprüft", "checkbox"),
      f("responsibleId", "Verantwortlich", "member"),
      f("notes", "Abweichungen", "textarea"),
    ]),
    feature(
      "loan",
      "Leihe / Rückgabe",
      [
        ref("assetId", "Gegenstand", ["asset"], true),
        f("lender", "Leihgeber", "text", true),
        f("quantity", "Menge", "number", true),
        f("deadline", "Rückgabe bis", "date", true),
        f("returnedAt", "Zurückgegeben", "date"),
      ],
      "inventory.manage",
    ),
  ],
  music: [
    feature("score-edition", "Notenfassung und Verteilung", [
      f("revision", "Fassung", "text", true),
      f("participantIds", "Berechtigte Musikschaffende", "members"),
      f("rightsUntil", "Rechte bis", "date"),
      f("notes", "Verteilungshinweise", "textarea"),
      approval(),
    ]),
  ],
  dance: [
    feature("variant", "Choreografie- / Besetzungsvariante", [
      actor(),
      actor("alternativeActorId", "Alternative"),
      ref("sceneId", "Szenenfassung", ["scene"]),
      f("revision", "Variante", "text", true),
      f("sequence", "Choreografie", "textarea"),
      approval(),
    ]),
  ],
  "front-of-house": [
    feature(
      "incident",
      "Publikumsvorfall",
      [
        f("performanceId", "Vorstellung", "performance", true),
        f("fault", "Vorfall ohne persönliche Diagnosen", "textarea", true),
        choice("priority", "Dringlichkeit", ["normal", "high", "urgent"]),
        f("responsibleId", "Nachverfolgung", "member"),
        f("deadline", "Klärung bis", "date"),
      ],
      "task.create",
    ),
  ],
  marketing: [
    feature("asset-edition", "Redaktionsasset", [
      f("revision", "Fassung", "text", true),
      f("rightsOwner", "Rechteinhaber", "text", true),
      f("rightsUntil", "Rechte bis", "date", true),
      f("publishAt", "Geplante Veröffentlichung", "date"),
      approval(),
    ]),
  ],
  education: [
    feature("group-booking", "Gruppenbuchung", [
      ref("workshopId", "Workshop", ["workshop"], true),
      f("groupName", "Gruppe", "text", true),
      f("participants", "Teilnehmendenzahl", "number", true),
      f("contact", "Kontaktstelle"),
      f("requirements", "Gruppen-/Zugangsbedarf ohne Gesundheitsdetails", "textarea"),
    ]),
    feature(
      "participant",
      "Geschützte Teilnahmedaten",
      [
        ref("bookingId", "Gruppenbuchung", ["group-booking"], true),
        f("name", "Name / Kürzel", "text", true),
        f("contact", "Kontakt"),
        f("consentPurpose", "Einwilligungszweck"),
        f("consentUntil", "Gültig bis", "date"),
        f("consentGiven", "Einwilligung dokumentiert", "checkbox"),
      ],
      "education.participants.manage",
      true,
    ),
  ],
  administration: [
    feature(
      "procurement",
      "Bestellung / Lieferung / Rechnung",
      [
        ref("purchaseId", "Genehmigter Bedarf", ["purchase"], true),
        choice("phase", "Vorgang", ["ordered", "delivered", "invoiced", "paid"]),
        f("supplier", "Lieferant", "text", true),
        f("orderNumber", "Bestellnummer"),
        f("invoiceNumber", "Rechnungsnummer"),
        f("amountCents", "Betrag (€)", "number", true),
        f("costCentre", "Kostenstelle"),
        f("date", "Belegdatum", "date", true),
        f("notes", "Prüfvermerk", "textarea"),
      ],
      "budget.approve",
      true,
    ),
    feature(
      "contract",
      "Vertragsstand",
      [
        f("partner", "Vertragspartner", "text", true),
        f("revision", "Fassung", "text", true),
        f("start", "Von", "date"),
        f("end", "Bis", "date"),
        f("deadline", "Frist", "date"),
        f("amountCents", "Prognose (€)", "number"),
        f("notes", "Vertragszweck", "textarea"),
      ],
      "budget.approve",
      true,
    ),
  ],
  facilities: [
    feature(
      "maintenance-series",
      "Wartungsserie",
      [
        ref("assetId", "Anlage", ["asset"], true),
        f("nextService", "Nächster Termin", "date", true),
        f("intervalDays", "Intervall (Tage)", "number", true),
        f("responsibleId", "Verantwortlich", "member", true),
        f("checklist", "Prüfschritte", "textarea"),
      ],
      "inventory.manage",
    ),
  ],
};

/** Registry additions use the same editor, references, approvals, history and event services. */
export function extendFachContracts(modules: ModuleManifest[]) {
  modules.push({
    id: "design",
    label: "Ausstattung & Bühnenbild",
    department: "Ausstattung",
    schemaVersion: 1,
    dependencies: ["productions", "calendar", "tasks", "documents", "chat"],
    events: ["TradeItemChangedV1"],
    features: [
      feature("design", "Entwurf / Modellstand", [
        f("revision", "Fassung", "text", true),
        ref("sceneId", "Szenenfassung", ["scene"]),
        f("concept", "Ausstattungskonzept", "textarea"),
        f("drawingRevision", "Zeichnungsstand"),
        f("deadline", "Abgabe bis", "date"),
        approval(),
      ]),
      feature(
        "model-rehearsal",
        "Modell- / Bauprobe",
        [
          ref("designId", "Entwurfsstand", ["design"], true),
          ...slot,
          f("findings", "Ergebnisse und Folgeaufträge", "textarea"),
        ],
        "schedule.manage",
      ),
      feature(
        "readiness",
        "Bereitschaft",
        [f("ready", "Bereit", "checkbox"), f("notes", "Offene Punkte", "textarea")],
        "readiness.manage",
      ),
    ],
  });
  for (const module of modules) {
    if (module.id === "intendance") continue;
    module.features.push(...(add[module.id] || []));
    module.features.push(
      feature(
        "asset",
        "Geräte / Fundus / Anlagen",
        [
          f("inventoryNumber", "Inventarnummer", "text", true),
          f("kind", "Gerät / Teil"),
          f("quantity", "Anfangsbestand", "number", true),
          f("resourceId", "Verknüpfte Raum-/Geräteressource", "resource"),
          f("roomFeatures", "Raumeigenschaften (eine pro Zeile)", "textarea"),
          f("qualification", "Erforderliche Qualifikation"),
          f("nextInspection", "Prüfung fällig", "date"),
          choice("condition", "Zustand", ["available", "maintenance", "blocked"]),
          f("notes", "Technische Eigenschaften", "textarea"),
        ],
        "inventory.manage",
      ),
    );
    module.features.push(
      feature(
        "stock-movement",
        "Bestandsbewegung",
        [
          ref("assetId", "Artikel", ["asset"], true),
          choice("movement", "Bewegung", ["receive", "consume", "loan", "return"]),
          f("quantity", "Menge", "number", true),
          f("reason", "Grund / Nachweis", "text", true),
        ],
        "inventory.manage",
      ),
    );
    module.features.push(
      feature(
        "qualification",
        "Qualifikationsnachweis",
        [
          f("memberId", "Teammitglied", "member", true),
          f("qualification", "Qualifikation", "text", true),
          f("validUntil", "Gültig bis", "date", true),
          f("evidence", "Nachweis / Ablage", "textarea"),
        ],
        "readiness.manage",
      ),
    );
    for (const entry of module.features) {
      if (entry.id !== "asset" && entry.id !== "stock-movement" && !entry.private)
        entry.fields.push(
          ref("sourceItemId", "Vorgänger / zugrunde liegender Fachstand", [], false),
        );
      if (entry.id === "readiness")
        entry.fields.push(
          f("performanceId", "Vorstellung (leer: gesamte Produktion)", "performance"),
        );
    }
    const extend = (type: string, fields: Field[]) =>
      module.features.find((feature) => feature.id === type)?.fields.push(...fields);
    if (module.id === "disposition") {
      const previous = module.features
        .find((f) => f.id === "cast-change")
        ?.fields.find((f) => f.key === "previousActorId");
      if (previous) {
        previous.type = "record";
        previous.source = "actors";
      }
    }
    if (module.id === "direction") {
      extend("rehearsal-report", [
        ref("sceneId", "Szenenfassung", ["scene"]),
        f("responsibleId", "Verantwortlich", "member"),
        f("deadline", "Rückmeldung bis", "date"),
      ]);
      extend("prompt-book", [ref("sceneId", "Szenenfassung", ["scene"])]);
    }
    if (module.id === "dramaturgy") {
      extend("dossier", [ref("editionId", "Geprüfte Textfassung", ["text-edition"])]);
      extend("programme", [
        ref("editionId", "Textfassung", ["text-edition"]),
        f("copy", "Beitragstext", "textarea"),
        f("editorId", "Lektorat", "member"),
      ]);
    }
    if (module.id === "ensemble") {
      extend("availability", [
        f("allowedFrom", "Bei eingeschränkt: frühester Beginn (HH:mm)"),
        f("allowedTo", "Bei eingeschränkt: spätestes Ende (HH:mm)"),
      ]);
      const availability = module.features.find((f) => f.id === "availability")!;
      availability.fields
        .filter((f) => ["start", "end", "availability"].includes(f.key))
        .forEach((f) => (f.required = true));
      extend("understudy", [actor(), character(), actor("alternativeActorId", "Aushilfe")]);
    }
    if (module.id === "stage-management") {
      extend("cue", [ref("technicalCueId", "Fach-Cue", ["cue"])]);
      extend("show-report", [f("performanceId", "Vorstellung", "performance")]);
    }
    if (module.id === "stage") {
      extend("changeover", [
        ref("assetId", "Dekoration / Anlage", ["asset"]),
        ref("drawingId", "Geprüfter Zeichnungsstand", ["decoration", "design"]),
        f("participantIds", "Besetzung", "members"),
      ]);
      extend("inspection", [
        ref("assetId", "Geprüfte Anlage", ["asset"]),
        f("resourceId", "Bei Fehler betroffene Ressource", "resource"),
        f("blockResource", "Ressource bei Fehler sperren", "checkbox"),
      ]);
    }
    if (module.id === "lighting")
      extend("patch", [
        { ...ref("assetId", "Gerät aus dem Fundus", ["asset"]), primary: true },
        { ...f("dmxAddress", "DMX-Startadresse", "number"), primary: true },
        { ...f("dmxUniverse", "DMX-Universe", "number"), primary: true },
        { ...f("footprint", "DMX-Kanalanzahl", "number"), primary: true },
        f("gdtfMode", "GDTF-Modus"),
      ]);
    if (module.id === "sound") {
      extend("channel", [
        actor(),
        character(),
        ref("assetId", "Mikrofon", ["asset"]),
        ref("backupAssetId", "Ersatzmikrofon", ["asset"]),
        f("channelNumber", "Kanalnummer", "number"),
        f("frequencyMHz", "Frequenz (MHz)", "number"),
      ]);
      extend("cue", [{ ...f("fileId", "Private Zuspielungsdatei", "record"), source: "files" }]);
    }
    if (module.id === "video") {
      extend("media", [
        { ...f("fileId", "Private Mediendatei", "record"), source: "files" },
        f("codec", "Codec"),
        f("resolution", "Auflösung"),
        f("frameRate", "Bildrate", "number"),
        f("durationSeconds", "Dauer (Sek.)", "number"),
      ]);
      extend("cue", [ref("mediaId", "Medienfassung", ["media"], true)]);
    }
    if (module.id === "costume") {
      extend("costume", [actor(), character(), ref("assetId", "Fundusteil", ["asset"])]);
      extend("measurements", [
        actor(),
        f("purpose", "Zweck"),
        f("heightCm", "Körpergröße (cm)", "number"),
        f("chestCm", "Brust (cm)", "number"),
        f("waistCm", "Taille (cm)", "number"),
        f("hipCm", "Hüfte (cm)", "number"),
      ]);
      extend("quick-change", [
        actor(),
        ref("fromCostumeId", "Ausgangskostüm", ["costume"]),
        ref("toCostumeId", "Zielkostüm", ["costume"]),
        f("assistantId", "Assistenz", "member"),
      ]);
    }
    if (module.id === "makeup")
      extend("preparation", [
        actor(),
        character(),
        ref("assetId", "Perücke / Fundusteil", ["asset"]),
      ]);
    if (module.id === "props")
      extend("scene-prop", [
        ref("assetId", "Bestandsartikel", ["asset"]),
        f("deadline", "Leihe endet", "date"),
      ]);
    if (module.id === "music") {
      extend("section", [
        f("memberIds", "Musikschaffende", "members"),
        f("substituteIds", "Aushilfen", "members"),
        f("qualification", "Stimme / Instrument als Qualifikation"),
      ]);
      extend("service", [
        ref("scoreId", "Notenfassung", ["score-edition"]),
        f("qualification", "Erforderliche Qualifikation"),
      ]);
    }
    if (module.id === "dance") {
      extend("training", [
        f("requiredRoomFeature", "Erforderliche Raumeigenschaft", "text"),
        f("qualification", "Erforderliche Qualifikation"),
      ]);
      extend("cast", [actor(), character(), actor("alternativeActorId", "Alternative")]);
    }
    if (module.id === "front-of-house")
      extend("briefing", [
        f("performanceId", "Vorstellung", "performance", true),
        f("participantIds", "Dienstbesetzung", "members"),
        f("groups", "Gruppenbedarf", "textarea"),
        f("accessibility", "Barrierefreiheit / Zugang", "textarea"),
      ]);
    if (module.id === "marketing")
      extend("campaign", [ref("assetId", "Redaktionsasset", ["asset-edition"])]);
    if (module.id === "education")
      extend("workshop", [f("capacity", "Teilnehmendenkapazität", "number", true)]);
    if (module.id === "facilities") {
      extend("maintenance", [
        ref("assetId", "Anlage", ["asset"]),
        ref("seriesId", "Wartungsserie", ["maintenance-series"]),
        f("responsibleId", "Zuständig", "member"),
      ]);
      extend("incident", [
        ref("assetId", "Anlage", ["asset"]),
        f("resourceId", "Betroffene Ressource", "resource"),
        f("blockResource", "Ressource sperren", "checkbox"),
        f("responsibleId", "Zuständig", "member"),
        f("deadline", "Lösung bis", "date"),
      ]);
    }
  }
  modules
    .find((m) => m.id === "disposition")!
    .features.push(
      feature(
        "tour",
        "Gastspiel / Tournee",
        [
          f("venue", "Gastspielort", "text", true),
          ...slot,
          f("contact", "Kontaktstelle"),
          f("requirements", "Technischer Rider / Reisebedarf", "textarea"),
          f("contractReference", "Vertragskennung (keine vertraulichen Vertragsinhalte)"),
        ],
        "schedule.manage",
      ),
    );
}
