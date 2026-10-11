import type { RequestHandler } from "@sveltejs/kit";
import { moduleRegistry } from "@/modules/theater/registry";
import { integrationScopes } from "@/platform/integration-auth";
import { adapterProfiles } from "@/shared/adapter-profiles";
const parameter = (name: string, required = false, values?: readonly string[]) => ({
  name,
  in: "query",
  required,
  schema: { type: "string", ...(values ? { enum: values } : {}) },
});
const errors = {
  "400": { description: "Ungültige Eingaben" },
  "401": { description: "Ungültiger, abgelaufener oder widerrufener Zugang" },
  "403": { description: "Aktuelles Benutzerrecht oder API-Scope fehlt" },
  "404": { description: "Eintrag nicht zugänglich" },
  "409": {
    description:
      "Veraltete Version, wiederverwendeter Schlüssel mit anderem Inhalt oder Fachkonflikt",
  },
  "413": { description: "Datei, Batch oder Ergebnis zu groß" },
  "429": {
    description: "120 Anfragen pro Minute je Zugang",
    headers: {
      "Retry-After": { schema: { type: "integer" }, description: "Wartezeit in Sekunden" },
    },
  },
};
const recordKinds = [
  "productions",
  "actors",
  "characters",
  "casting",
  "tasks",
  "events",
  "materials",
];
const recordWrites = recordKinds.filter((kind) => kind !== "productions");
const idempotency = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string", minLength: 8, maxLength: 100, pattern: "^[A-Za-z0-9_-]+$" },
};
const body = (schema: Record<string, unknown>) => ({
  required: true,
  content: { "application/json": { schema } },
});
export const GET: RequestHandler = () => {
  const paths: Record<string, unknown> = {};
  for (const entity of [
    "trade-items",
    "records",
    "calendar",
    "time",
    "finance",
    "resources",
    "performances",
    "ticketing",
  ]) {
    const readScope =
      entity === "finance"
        ? "finance:read"
        : entity === "time"
          ? "time:read"
          : entity === "resources"
            ? "resources:read"
            : ["calendar", "performances"].includes(entity)
              ? "calendar:read"
              : entity === "records"
                ? "records:read"
                : "trade:read";
    const parameters = [
      parameter("id"),
      parameter("productionId"),
      parameter("cursor"),
      { ...parameter("from"), schema: { type: "string", format: "date" } },
      { ...parameter("to"), schema: { type: "string", format: "date" } },
    ];
    if (entity === "records") parameters.push(parameter("kind", true, recordKinds));
    if (entity === "time") parameters.push(parameter("kind", false, ["time", "attendance"]));
    if (entity === "trade-items") {
      parameters.push(
        parameter(
          "moduleId",
          false,
          moduleRegistry.map((m) => m.id),
        ),
        parameter("type"),
      );
    }
    paths["/" + entity] = {
      ...(entity !== "ticketing"
        ? {
            get: {
              summary: "Berechtigte " + entity + " lesen",
              parameters,
              "x-required-scope": readScope,
              responses: {
                "200": {
                  description:
                    "Bei id ein Eintrag; sonst records/entries und nextCursor. Cursor mit identischen Filtern weitergeben.",
                },
                ...errors,
              },
            },
          }
        : {}),
      ...(["trade-items", "records", "calendar", "ticketing"].includes(entity)
        ? {
            post: {
              summary: entity + " anlegen oder versioniert ändern",
              parameters: [idempotency],
              "x-required-scope":
                entity === "ticketing"
                  ? "ticketing:write"
                  : entity === "trade-items"
                    ? "trade:write"
                    : entity === "calendar"
                      ? "calendar:write"
                      : "records:write",
              requestBody: body({
                $ref:
                  "#/components/schemas/" +
                  (entity === "trade-items"
                    ? "TradeItemInput"
                    : entity === "ticketing"
                      ? "AudienceReportInput"
                      : "RecordInput"),
              }),
              responses: {
                "201": {
                  description:
                    "Gespeicherter Eintrag; identische Wiederholung erzeugt keine zweite Buchung",
                },
                ...errors,
              },
            },
          }
        : {}),
    };
  }
  paths["/exchange"] = {
    get: {
      summary: "Berechtigte Fachstände als CSV oder JSON exportieren",
      parameters: [
        parameter("moduleId", true),
        parameter("type", true),
        parameter("productionId"),
        parameter("format", false, ["csv", "json"]),
        parameter("sensitiveConfirmed", false, ["true"]),
      ],
      "x-required-scope": "trade:read",
      responses: {
        "200": {
          description:
            "Maximal 2000 zugängliche Einträge; CSV mit BOM, Semikolon und entschärften Tabellenformeln",
        },
        ...errors,
      },
    },
    post: {
      summary: "CSV/JSON prüfen oder atomar übernehmen",
      requestBody: body({ $ref: "#/components/schemas/ExchangeInput" }),
      "x-required-scope": "trade:write",
      responses: {
        "200": {
          description:
            "preview: Zeilen, Spalten, Fehler, previewHash; apply: imported. Eine fehlerhafte Zeile verhindert den gesamten Import.",
        },
        ...errors,
      },
    },
  };
  return Response.json({
    openapi: "3.1.1",
    info: {
      title: "Showtime Theater API",
      version: "1.0.0",
      description:
        "Tenantgebundene API. Scopes begrenzen frische Benutzerrechte; sie erweitern sie nicht. IDs werden im eigenen Theater zugeordnet. Geldbeträge sind ganzzahlige Eurocent, Zeitpunkte UTC ISO 8601, Datum ohne Zeit yyyy-MM-dd. Paginiert lesen. Änderungen außerhalb exchange brauchen Idempotency-Key; exchange verwendet operationId und geprüften previewHash.",
    },
    servers: [{ url: "/api/v1" }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Befristeter st_-Zugang im Authorization-Header. Zugeordnetes Theater/Gewerk; kein Tenantwechsel durch Header oder Formulardaten.",
        },
      },
      schemas: {
        TradeItemInput: {
          type: "object",
          required: ["moduleId", "type", "title", "data"],
          properties: {
            id: { type: "string" },
            expectedVersion: { type: "integer", minimum: 1 },
            moduleId: { type: "string", enum: moduleRegistry.map((m) => m.id) },
            type: { type: "string" },
            title: { type: "string", maxLength: 200 },
            productionId: { type: "string" },
            ownerId: { type: "string" },
            dueAt: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["draft", "review", "published", "ready", "done", "blocked"],
            },
            data: {
              type: "object",
              description:
                "Fachfelder aus x-trade-contracts. Unbekannte Felder werden abgewiesen; formale Freigaben sind servergeführt.",
            },
          },
        },
        RecordInput: {
          type: "object",
          required: ["data"],
          properties: {
            kind: {
              type: "string",
              enum: recordWrites,
              description: "Für /records erforderlich; /calendar setzt events.",
            },
            id: { type: "string" },
            expectedVersion: { type: "integer", minimum: 1 },
            data: { type: "object" },
          },
        },
        AudienceReportInput: {
          type: "object",
          required: ["title", "productionId", "data"],
          properties: {
            id: { type: "string" },
            expectedVersion: { type: "integer", minimum: 1 },
            title: { type: "string" },
            productionId: { type: "string" },
            data: {
              type: "object",
              required: [
                "performanceId",
                "offeredSeats",
                "visitors",
                "paidTickets",
                "complimentaryTickets",
                "amountCents",
              ],
              properties: {
                performanceId: { type: "string" },
                offeredSeats: { type: "integer", minimum: 0 },
                visitors: { type: "integer", minimum: 0 },
                paidTickets: { type: "integer", minimum: 0 },
                complimentaryTickets: { type: "integer", minimum: 0 },
                amountCents: { type: "integer", minimum: 0 },
              },
            },
          },
        },
        ExchangeInput: {
          type: "object",
          required: ["action", "operationId", "moduleId", "type", "format", "content"],
          properties: {
            action: { type: "string", enum: ["preview", "apply"] },
            operationId: { type: "string", format: "uuid" },
            moduleId: { type: "string" },
            type: { type: "string" },
            productionId: { type: "string" },
            format: { type: "string", enum: ["csv", "json"] },
            content: {
              type: "string",
              maxLength: 1000000,
              description: "Höchstens 100 Zeilen; Referenzen als IDs, Mehrfachreferenzen mit |.",
            },
            mapping: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Ziel-Feldname → Quellspalte. Leere Zuordnung überspringt das Feld.",
            },
            previewHash: {
              type: "string",
              description: "Bei apply erforderlich; an Inhalt, Zuordnung und Vorschau gebunden.",
            },
          },
        },
      },
    },
    "x-scopes": integrationScopes,
    "x-adapter-profiles": adapterProfiles,
    "x-trade-contracts": moduleRegistry.map((m) => ({
      id: m.id,
      label: m.label,
      features: m.features,
    })),
  });
};
