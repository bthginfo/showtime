import type { PrivacyEntryKind } from "./model";
export type PrivacyField = {
  key: string;
  label: string;
  type?: "text" | "long" | "date" | "number" | "ids";
  options?: [string, string][];
  required?: boolean;
  help?: string;
};
export const kindLabels: Record<PrivacyEntryKind, string> = {
  request: "Betroffenenanfrage",
  provider: "Anbieter",
  retention: "Aufbewahrungsregel",
  hold: "Aufbewahrungssperre",
  incident: "Datenschutzvorfall",
  document: "Nachweis",
  image: "Personen- und Bildrechte",
};
export const groupLabels: Record<string, string> = {
  employees: "Beschäftigte",
  actors: "Ensemble und Schauspieler",
  contacts: "Externe Ansprechpersonen",
  calendar: "Kalender",
  documents: "Dateien und Dokumentversionen",
  chat: "Kommunikation",
  time: "Zeitkonten",
  audit: "Änderungsprotokolle",
  backups: "Backups",
};
export const rightsLabels: Record<string, string> = {
  access: "Auskunft",
  correction: "Berichtigung",
  erasure: "Löschung",
  restriction: "Einschränkung",
  portability: "Datenübertragbarkeit",
  objection: "Widerspruch",
};
const date = (key: string, label: string): PrivacyField => ({ key, label, type: "date" });
const long = (key: string, label: string, help?: string): PrivacyField => ({
  key,
  label,
  type: "long",
  help,
});
export const fields: Record<PrivacyEntryKind, PrivacyField[]> = {
  request: [
    { key: "requestType", label: "Gewünschtes Recht", options: Object.entries(rightsLabels) },
    {
      key: "subjectType",
      label: "Betroffene Person",
      options: [
        ["account", "Person mit Konto"],
        ["actor", "Schauspielerin / Schauspieler"],
        ["contact", "Externe Ansprechperson"],
      ],
    },
    { key: "subjectId", label: "Person", required: true },
    { key: "contact", label: "Antwortkontakt" },
    date("receivedAt", "Eingegangen am"),
    date("identityVerifiedAt", "Identität geprüft am"),
    long("decision", "Entscheidung und Begründung"),
    long("response", "Dokumentierte Antwort"),
    date("respondedAt", "Antwort übermittelt am"),
    long("extensionReason", "Begründung einer Fristverlängerung"),
    date("extensionNotifiedAt", "Verlängerung mitgeteilt am"),
  ],
  provider: [
    long("service", "Dienst und verarbeitete Inhalte"),
    { key: "storageRegion", label: "Datenbank / Speicherregion" },
    { key: "logRegion", label: "Protokollregion" },
    { key: "supportRegion", label: "Supportzugriffe" },
    { key: "backupRegion", label: "Backupregion" },
    long("transferSafeguards", "Drittlandtransfers und Schutzmaßnahmen"),
    long("contractReference", "AVV / Vertragsnachweis"),
    long("subprocessors", "Weitere Unterauftragnehmer"),
    date("reviewedAt", "Geprüft am"),
  ],
  retention: [
    { key: "group", label: "Datengruppe", options: Object.entries(groupLabels) },
    {
      key: "days",
      label: "Aufbewahrung in Tagen",
      type: "number",
      help: "Leer lassen, solange die Frist rechtlich nicht bestätigt ist.",
    },
    {
      key: "trigger",
      label: "Frist beginnt",
      options: [
        ["last-updated", "Ab letzter Änderung"],
        ["contract-ended", "Bei Vertragsende"],
        ["subject-erased", "Nach Löschentscheidung"],
      ],
    },
    long("legalBasis", "Rechtsgrundlage und Begründung"),
    { key: "backupDays", label: "Aufbewahrung in Backups (Tage)", type: "number" },
    date("approvedAt", "Vom Theater bestätigt am"),
  ],
  hold: [
    {
      key: "recordIds",
      label: "Betroffene Datensätze",
      type: "ids",
      required: true,
      help: "Kennungen kommagetrennt; die Sperre schützt diese Auswahl vor einer Löschung.",
    },
    long("reason", "Grund der Aufbewahrungssperre"),
    date("until", "Gültig bis (leer = unbefristet)"),
  ],
  incident: [
    date("awareAt", "Dem Theater bekannt seit"),
    date("controllerInformedAt", "Theater informiert am"),
    {
      key: "authorityDecision",
      label: "Meldung an Aufsicht",
      options: [
        ["pending", "Noch prüfen"],
        ["required", "Erforderlich"],
        ["not-required", "Nicht erforderlich"],
      ],
    },
    long("decisionReason", "Begründung der Meldeentscheidung"),
    date("authorityNotifiedAt", "Aufsicht informiert am"),
    {
      key: "subjectsDecision",
      label: "Benachrichtigung Betroffener",
      options: [
        ["pending", "Noch prüfen"],
        ["required", "Erforderlich"],
        ["not-required", "Nicht erforderlich"],
      ],
    },
    date("subjectsNotifiedAt", "Betroffene informiert am"),
    long("measures", "Maßnahmen und nächste Schritte"),
  ],
  document: [
    {
      key: "documentType",
      label: "Art des Nachweises",
      options: [
        ["avv", "Auftragsverarbeitung"],
        ["tom", "Technische und organisatorische Maßnahmen"],
        ["instruction", "Weisung des Theaters"],
        ["dpia", "Folgenabschätzung"],
        ["processing", "Verarbeitungsverzeichnis"],
        ["restore", "Wiederherstellungsprüfung"],
        ["offboarding", "Vertragsende und Datenrückgabe"],
      ],
    },
    long("reference", "Nachweis / Fundstelle"),
    long("content", "Inhalt und Zuständigkeit"),
    date("reviewedAt", "Geprüft am"),
  ],
  image: [
    { key: "actorId", label: "Schauspielerin / Schauspieler" },
    long("source", "Herkunft der Daten und des Bildes"),
    long("legalBasis", "Rechtsgrundlage der Personendaten"),
    date("noticeDeliveredAt", "Person informiert am"),
    long("license", "Lizenz / Nutzungsrechte"),
    {
      key: "allowedUse",
      label: "Erlaubte Bildnutzung",
      options: [
        ["none", "Noch nicht freigegeben"],
        ["internal", "Nur intern"],
        ["public", "Auch öffentlich"],
      ],
    },
    long("evidence", "Beleg der Berechtigung"),
    date("expiresAt", "Berechtigung endet am"),
    date("withdrawnAt", "Widerrufen am"),
  ],
};
