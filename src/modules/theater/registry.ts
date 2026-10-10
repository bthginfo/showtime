import { z } from "zod";
import { HttpError } from "@/platform/http";
import type { RecordKind } from "@/shared/contracts";
import type { Permission } from "@/platform/access";
export type Field = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "date"
    | "datetime"
    | "number"
    | "checkbox"
    | "select"
    | "member"
    | "resource"
    | "record"
    | "members"
    | "budget"
    | "department";
  source?: RecordKind;
  options?: string[];
  required?: boolean;
};
export type Feature = {
  id: string;
  label: string;
  fields: Field[];
  permission: Permission;
  private?: boolean;
};
export type ModuleManifest = {
  id: string;
  label: string;
  department: string;
  dependencies: string[];
  schemaVersion: 1;
  features: Feature[];
  events: string[];
};
const text = (key: string, label: string, required = false): Field => ({
  key,
  label,
  type: "text",
  required,
});
const note = (key: string, label: string): Field => ({ key, label, type: "textarea" });
const date = (key: string, label: string): Field => ({ key, label, type: "date" });
const number = (key: string, label: string): Field => ({ key, label, type: "number" });
const choice = (key: string, label: string, options: string[]): Field => ({
  key,
  label,
  type: "select",
  options,
});
const check = (key: string, label: string): Field => ({ key, label, type: "checkbox" });
const record = (key: string, label: string, source: RecordKind, required = false): Field => ({
  key,
  label,
  type: "record",
  source,
  required,
});
const feature = (
  id: string,
  label: string,
  fields: Field[],
  permission: Permission = "document.create",
  privateData = false,
): Feature => ({
  id,
  label,
  fields:
    permission === "schedule.manage" && fields.some((f) => f.key === "end")
      ? [
          ...fields,
          ...(
            [
              { key: "participantIds", label: "Beteiligte Teammitglieder", type: "members" },
              { key: "resourceId", label: "Bühne / Raum", type: "resource" },
              { key: "pauseMinutes", label: "Pause (Min.)", type: "number" },
            ] as Field[]
          ).filter((f) => !fields.some((existing) => existing.key === f.key)),
        ]
      : fields,
  permission,
  private: privateData,
});
const mod = (
  id: string,
  label: string,
  department: string,
  features: Feature[],
): ModuleManifest => ({
  id,
  label,
  department,
  features: features.some((f) => f.id === "readiness")
    ? features
    : [
        ...features,
        feature(
          "readiness",
          "Bereitschaft",
          [check("ready", "Bereit"), note("notes", "Offene Punkte")],
          "readiness.manage",
        ),
      ],
  dependencies: ["productions", "calendar", "tasks", "documents", "chat"],
  schemaVersion: 1,
  events: ["TradeItemChangedV1"],
});
export const moduleRegistry: ModuleManifest[] = [
  mod("disposition", "Disposition & KBB", "Disposition", [
    feature(
      "rehearsal",
      "Probe",
      [
        text("scene", "Szene"),
        { key: "start", label: "Beginn", type: "datetime", required: true },
        { key: "end", label: "Ende", type: "datetime", required: true },
        { key: "participantIds", label: "Beteiligte", type: "members" },
        { key: "resourceId", label: "Raum", type: "resource" },
      ],
      "schedule.manage",
    ),
    feature(
      "cast-change",
      "Umbesetzung",
      [
        record("characterId", "Figur", "characters", true),
        record("actorId", "Besetzung", "actors", true),
        text("previousActorId", "Vorherige Besetzung"),
        date("effectiveFrom", "Gültig ab"),
      ],
      "casting.manage",
    ),
  ]),
  mod("direction", "Regie & Regieassistenz", "Regie", [
    feature("rehearsal-report", "Probenbericht", [
      text("scene", "Szene"),
      date("date", "Probentag"),
      note("notes", "Beobachtungen"),
      note("changes", "Änderungen"),
      text("targetDepartments", "Zuständige Gewerke"),
    ]),
    feature("prompt-book", "Regiebuchstand", [
      text("scene", "Szene"),
      text("revision", "Fassung"),
      note("blocking", "Wege und Aktionen"),
      note("changes", "Änderungsauftrag"),
    ]),
  ]),
  mod("dramaturgy", "Dramaturgie", "Dramaturgie", [
    feature("dossier", "Produktionsdossier", [
      text("edition", "Textfassung"),
      text("source", "Recherchequelle"),
      note("notes", "Inhalt"),
      date("rightsUntil", "Rechte gültig bis"),
    ]),
    feature("programme", "Programmheft", [
      text("section", "Beitrag"),
      text("author", "Verfasser"),
      date("deadline", "Redaktionsschluss"),
      choice("approval", "Freigabe", ["draft", "review", "approved"]),
    ]),
  ]),
  mod("ensemble", "Ensemble & Gäste", "Ensemble", [
    feature(
      "availability",
      "Verfügbarkeit",
      [
        date("start", "Von"),
        date("end", "Bis"),
        choice("availability", "Status", ["available", "unavailable", "limited"]),
        note("notes", "Hinweis"),
      ],
      "availability.own",
      true,
    ),
    feature(
      "understudy",
      "Alternative Besetzung",
      [
        text("character", "Figur"),
        text("actor", "Besetzung"),
        text("alternative", "Alternative"),
        date("effectiveFrom", "Gültig ab"),
      ],
      "casting.manage",
    ),
  ]),
  mod("stage-management", "Inspizienz", "Inspizienz", [
    feature("cue", "Ablaufbuch / Cue", [
      number("sequence", "Cue-Nr."),
      text("scene", "Szene"),
      text("trigger", "Auslöser", true),
      choice("department", "Gewerk", ["stage", "lighting", "sound", "video", "costume", "props"]),
      note("action", "Aktion"),
      check("confirmed", "Bestätigt"),
    ]),
    feature("show-report", "Vorstellungsbericht", [
      date("date", "Vorstellungstag"),
      note("incidents", "Vorkommnisse"),
      note("changes", "Änderungen"),
      text("targetDepartments", "Betroffene Gewerke"),
    ]),
    feature(
      "readiness",
      "Bereitschaft",
      [check("ready", "Bereit"), note("notes", "Offene Punkte")],
      "readiness.manage",
    ),
  ]),
  mod("stage", "Bühnentechnik", "Bühnentechnik", [
    feature("changeover", "Auf-, Ab- und Umbau", [
      text("scene", "Szene"),
      text("decoration", "Dekorationsteil"),
      number("staffRequired", "Personalbedarf"),
      number("durationMinutes", "Dauer (Min.)"),
      note("instructions", "Ablauf"),
    ]),
    feature(
      "inspection",
      "Technische Prüfung",
      [
        text("equipment", "Anlage / Teil", true),
        date("nextInspection", "Nächster Termin"),
        choice("result", "Prüfstand", ["pending", "passed", "failed"]),
        note("evidence", "Nachweis / Prüfvermerk"),
      ],
      "readiness.manage",
    ),
  ]),
  mod("lighting", "Licht", "Licht", [
    feature("patch", "Patch / Fokus", [
      text("fixture", "Gerät", true),
      text("address", "Adresse"),
      text("universe", "Universe"),
      text("position", "Position"),
      note("focus", "Fokusauftrag"),
    ]),
    feature("cue", "Licht-Cue", [
      number("sequence", "Cue-Nr."),
      text("trigger", "Auslöser"),
      number("fadeSeconds", "Überblendung (Sek.)"),
      note("look", "Lichtstimmung"),
    ]),
  ]),
  mod("sound", "Ton", "Ton", [
    feature("channel", "Mikrofon / Routing", [
      text("actor", "Besetzung"),
      text("microphone", "Mikrofon"),
      text("channel", "Kanal"),
      text("routing", "Routing"),
      text("frequency", "Frequenz"),
    ]),
    feature("cue", "Ton-Cue", [
      number("sequence", "Cue-Nr."),
      text("media", "Zuspielung"),
      text("trigger", "Auslöser"),
      number("level", "Pegel"),
      note("notes", "Hinweise"),
    ]),
    feature("setup", "Aufbaucheckliste", [
      note("items", "Einrichtungsschritte"),
      check("checked", "Geprüft"),
      note("faults", "Störungen"),
    ]),
  ]),
  mod("video", "Video & Medien", "Video", [
    feature("media", "Medienfassung", [
      text("source", "Datei / Quelle"),
      text("revision", "Version"),
      text("rightsOwner", "Rechteinhaber"),
      date("rightsUntil", "Rechte gültig bis"),
      note("requirements", "Technische Anforderungen"),
    ]),
    feature("cue", "Projektions-Cue", [
      number("sequence", "Cue-Nr."),
      text("media", "Medienfassung"),
      text("trigger", "Auslöser"),
      text("projection", "Projektionsfläche"),
    ]),
  ]),
  mod("workshops", "Werkstätten", "Werkstätten", [
    feature(
      "order",
      "Herstellungsauftrag",
      [
        choice("workshop", "Werkstatt", [
          "Tischlerei",
          "Schlosserei",
          "Malsaal",
          "Plastik",
          "Dekoration",
        ]),
        text("drawingRevision", "Zeichnungsstand"),
        note("materials", "Materialbedarf"),
        date("deadline", "Übergabetermin"),
        note("dependencies", "Abhängigkeiten"),
      ],
      "task.create",
    ),
    feature(
      "handover",
      "Werkstattübergabe",
      [
        text("recipient", "Empfangendes Gewerk"),
        note("items", "Übergebene Teile"),
        note("openPoints", "Offene Punkte"),
        check("accepted", "Abgenommen"),
      ],
      "handover.create",
    ),
  ]),
  mod("costume", "Kostüm & Garderobe", "Kostüm", [
    feature("costume", "Kostümzuordnung", [
      text("character", "Figur"),
      text("actor", "Besetzung"),
      text("inventory", "Fundusnummer"),
      date("fitting", "Anprobe"),
      note("changes", "Änderungen"),
    ]),
    feature(
      "measurements",
      "Geschützte Maßdaten",
      [
        text("actor", "Besetzung", true),
        note("measurements", "Maßdaten"),
        date("measuredAt", "Gemessen am"),
      ],
      "measurements.manage",
      true,
    ),
    feature("quick-change", "Umkleideplan", [
      text("scene", "Szene"),
      text("actor", "Besetzung"),
      text("fromCostume", "Von"),
      text("toCostume", "Zu"),
      number("durationSeconds", "Zeit (Sek.)"),
      text("assistant", "Assistenz"),
    ]),
    feature(
      "care",
      "Reparatur / Reinigung",
      [
        text("inventory", "Fundusnummer"),
        choice("care", "Vorgang", ["repair", "clean", "return"]),
        note("instructions", "Anweisung"),
      ],
      "inventory.manage",
    ),
  ]),
  mod("makeup", "Maske", "Maske", [
    feature("preparation", "Vorbereitung", [
      text("actor", "Besetzung"),
      record("lookId", "Aufschrieb", "looks"),
      record("maskPlanId", "Maskenplan", "maskPlans"),
      text("wig", "Perücke / Fundus"),
      note("notes", "Vorbereitungen"),
    ]),
  ]),
  mod("props", "Requisite", "Requisite", [
    feature("scene-prop", "Szenenrequisite", [
      text("scene", "Szene"),
      text("item", "Gegenstand", true),
      text("preset", "Bereitstellung"),
      text("return", "Rückstellung"),
      number("consumption", "Verbrauch"),
      text("loan", "Leihgeber"),
    ]),
    feature(
      "repair",
      "Reparatur",
      [text("item", "Gegenstand"), note("fault", "Defekt"), date("deadline", "Benötigt bis")],
      "inventory.manage",
    ),
  ]),
  mod("music", "Chor & Orchester", "Chor & Orchester", [
    feature(
      "section",
      "Stimm- / Gruppenzuordnung",
      [
        text("group", "Gruppe"),
        text("voice", "Stimme / Instrument"),
        text("members", "Besetzung"),
        text("substitutes", "Aushilfen"),
      ],
      "casting.manage",
    ),
    feature(
      "service",
      "Musikalischer Dienst",
      [
        choice("type", "Dienst", ["rehearsal", "performance"]),
        { key: "start", label: "Beginn", type: "datetime" },
        { key: "end", label: "Ende", type: "datetime" },
        text("parts", "Noten / Unterlagen"),
      ],
      "schedule.manage",
    ),
  ]),
  mod("dance", "Ballett & Tanz", "Ballett", [
    feature(
      "training",
      "Training / Probe",
      [
        text("style", "Training"),
        text("cast", "Besetzung"),
        text("studio", "Studio"),
        { key: "start", label: "Beginn", type: "datetime" },
        { key: "end", label: "Ende", type: "datetime" },
      ],
      "schedule.manage",
    ),
    feature(
      "cast",
      "Tanzbesetzung",
      [
        text("role", "Partie"),
        text("actor", "Besetzung"),
        text("alternative", "Alternative"),
        text("costume", "Kostümbezug"),
        note("sequence", "Ablaufbezug"),
      ],
      "casting.manage",
    ),
  ]),
  mod("front-of-house", "Vorderhaus & Publikumsservice", "Vorderhaus", [
    feature("briefing", "Veranstaltungsbriefing", [
      text("entry", "Einlasszeit"),
      text("staff", "Dienstbesetzung"),
      note("requirements", "Besucheranforderungen"),
      note("checklist", "Checkliste"),
    ]),
    feature("feedback", "Rückmeldung", [
      date("date", "Veranstaltungstag"),
      note("feedback", "Rückmeldung"),
      note("followUp", "Folgeaufgaben"),
    ]),
  ]),
  mod("marketing", "Presse & Marketing", "Presse & Marketing", [
    feature("campaign", "Kampagne / Redaktion", [
      text("channel", "Kanal"),
      date("publishAt", "Veröffentlichung"),
      text("rightsOwner", "Bild- / Textrechte"),
      date("rightsUntil", "Rechte gültig bis"),
      choice("approval", "Freigabe", ["draft", "review", "approved"]),
      note("copy", "Text"),
    ]),
    feature("press", "Pressetermin", [
      text("contact", "Kontakt"),
      { key: "start", label: "Termin", type: "datetime" },
      note("briefing", "Briefing"),
    ]),
  ]),
  mod("education", "Theaterpädagogik", "Theaterpädagogik", [
    feature(
      "workshop",
      "Workshop",
      [
        text("targetGroup", "Zielgruppe"),
        text("contact", "Kontaktstelle"),
        text("staff", "Personal"),
        text("room", "Raum"),
        { key: "start", label: "Beginn", type: "datetime" },
        { key: "end", label: "Ende", type: "datetime" },
        note("materials", "Pädagogische Materialien"),
      ],
      "schedule.manage",
    ),
  ]),
  mod("administration", "Verwaltung & Einkauf", "Verwaltung", [
    feature(
      "budget",
      "Budgetrahmen",
      [
        number("amountCents", "Budget (Cent)"),
        { key: "department", label: "Gewerk (leer: gesamtes Theater)", type: "department" },
        text("costCentre", "Kostenstelle"),
      ],
      "budget.approve",
      true,
    ),
    feature(
      "purchase",
      "Bedarfsantrag",
      [
        text("item", "Bedarf", true),
        { key: "budgetId", label: "Freigegebener Budgetrahmen", type: "budget", required: true },
        number("amountCents", "Betrag (Cent)"),
        text("supplier", "Lieferant"),
        date("neededAt", "Benötigt am"),
        note("reason", "Begründung"),
      ],
      "budget.request",
      true,
    ),
  ]),
  mod("facilities", "Haustechnik & IT", "Haustechnik & IT", [
    feature(
      "maintenance",
      "Wartung",
      [
        text("asset", "Anlage / Raum", true),
        date("nextService", "Termin"),
        text("responsible", "Zuständigkeit"),
        note("checklist", "Wartungsschritte"),
      ],
      "inventory.manage",
    ),
    feature(
      "incident",
      "Störung / Reparatur",
      [
        text("asset", "Anlage / Raum"),
        choice("priority", "Dringlichkeit", ["normal", "high", "urgent"]),
        note("fault", "Störung"),
        note("handover", "Übergabe"),
      ],
      "task.create",
    ),
  ]),
];
export const moduleById = (id: string) => moduleRegistry.find((m) => m.id === id);
export function validateFeature(moduleId: string, type: string, input: Record<string, unknown>) {
  const module = moduleById(moduleId),
    feature = module?.features.find((f) => f.id === type);
  if (!module || !feature) throw new HttpError(400, "Unbekannte Fachfunktion");
  const shape: Record<string, z.ZodType> = {};
  for (const field of feature.fields) {
    const schema: z.ZodType =
      field.type === "number"
        ? field.key === "level"
          ? z.number().finite().min(-120).max(40)
          : field.key === "amountCents"
            ? z.number().int().min(0).max(1_000_000_000)
            : z.number().finite().min(0).max(1_000_000_000)
        : field.type === "checkbox"
          ? z.boolean()
          : field.type === "members"
            ? z.array(z.string().min(1).max(100)).max(200)
            : field.type === "select"
              ? z.enum(field.options! as [string, ...string[]])
              : field.type === "date"
                ? z.iso.date()
                : field.type === "datetime"
                  ? z.iso.datetime()
                  : z
                      .string()
                      .trim()
                      .max(field.type === "textarea" ? 10000 : 500);
    shape[field.key] = z.preprocess(
      (v) => (v === "" && !field.required ? undefined : v),
      field.required ? schema : schema.optional(),
    );
  }
  const parsed = z.object(shape).strict().parse(input);
  for (const field of feature.fields)
    if (field.required && (parsed[field.key] === undefined || parsed[field.key] === ""))
      throw new HttpError(400, `Bitte ergänze ${field.label}.`);
  return { module, feature, data: parsed };
}
