<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { adapterProfiles } from "@/shared/adapter-profiles";
  import { onMount } from "svelte";
  import { Button, ErrorMessage } from "@/components/ui";
  import { api, post } from "@/shared/client-api";
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission } from "@/platform/access";
  import type { Planning } from "./types";
  export let planning: Planning;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  const store = useWorkspace();
  $: canAdmin = hasPermission(
    { id: $store.workspace.user.id, grants: $store.workspace.user.grants || [] },
    "tenant.configure",
    { departmentId: $store.workspace.department.id },
  );
  let moduleId = $store.workspace.currentModuleId || "makeup",
    type = planning.modules.find((m) => m.moduleId === moduleId)?.manifest.features[0]?.id || "",
    format = "csv",
    content = "",
    mapping: Record<string, string> = {},
    mappingDirty = false,
    preview: {
      previewHash: string;
      columns: string[];
      rows: { row: number; title: string; data: Record<string, unknown> }[];
      errors: { row: number; error: string }[];
      imported: number;
    } | null = null,
    error = "",
    notice = "",
    busy = false,
    confirmed = false,
    entries: {
      id: string;
      label: string;
      expiresAt: string;
      revokedAt: string | null;
      scopes: string[];
    }[] = [],
    token = "",
    label = "",
    scopes: string[] = ["trade:read"],
    expires = 30,
    operationId = crypto.randomUUID();
  $: manifest = planning.modules.find((m) => m.moduleId === moduleId)?.manifest;
  $: feature = manifest?.features.find((f) => f.id === type) || manifest?.features[0];
  function template(profile: (typeof adapterProfiles)[number]) {
    if (!("moduleId" in profile)) return;
    moduleId = profile.moduleId;
    type = profile.type;
    format = "csv";
    content = profile.columns.join(";") + "\n";
    preview = null;
    mapping = {};
    mappingDirty = false;
    operationId = crypto.randomUUID();
    notice =
      "Vorlage geladen. Ergänze echte IDs desselben Theaters. Wechsle vor dem Import in das zuständige Gewerk.";
  }
  const scopeOptions = [
    ["trade:read", "Fachstände lesen"],
    ["trade:write", "Fachstände ändern"],
    ["records:read", "Gemeinsame Daten lesen"],
    ["records:write", "Gemeinsame Daten ändern"],
    ["calendar:read", "Kalender lesen"],
    ["calendar:write", "Kalender ändern"],
    ["ticketing:write", "Besucherberichte übermitteln"],
    ["time:read", "Berechtigte Zeitbuchungen lesen"],
    ["finance:read", "Berechtigte Finanzdaten lesen"],
    ["resources:read", "Ressourcen lesen"],
  ];
  async function access() {
    if (canAdmin)
      entries = (await api<{ entries: typeof entries }>("/api/integrations/access")).entries;
  }
  onMount(() => void access().catch((e) => (error = e.message)));
  async function key() {
    busy = true;
    error = "";
    try {
      const created = await post<{ token: string }>("/api/integrations/access", {
        action: "create",
        label,
        scopes,
        expiresInDays: expires,
      });
      token = created.token;
      label = "";
      await access();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function revoke(id: string) {
    busy = true;
    try {
      await post("/api/integrations/access", { action: "revoke", id });
      await access();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function readFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      error = "Bitte höchstens 1 MB für einen Import verwenden.";
      return;
    }
    content = await file.text();
    format = file.name.toLowerCase().endsWith(".json") ? "json" : "csv";
    preview = null;
    mapping = {};
    operationId = crypto.randomUUID();
  }
  async function exchange(action: "preview" | "apply") {
    busy = true;
    error = "";
    notice = "";
    try {
      mappingDirty = false;
      preview = await post<typeof preview>("/api/integrations/exchange", {
        action,
        operationId,
        moduleId,
        type: feature?.id,
        productionId: productionId || undefined,
        format,
        content,
        mapping,
        ...(action === "apply" ? { previewHash: preview?.previewHash } : {}),
      });
      if (action === "apply") {
        notice =
          preview?.imported +
          " Einträge übernommen. Identische Zeilen werden nicht doppelt angelegt.";
        await onChanged();
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function exportUrl(format: string) {
    const params = new URLSearchParams({
      moduleId,
      type: feature?.id || "",
      format,
      ...(productionId ? { productionId } : {}),
      ...(confirmed ? { sensitiveConfirmed: "true" } : {}),
    });
    return "/api/integrations/exchange?" + params;
  }
  async function showtech(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    error = "";
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("format", file.name.toLowerCase().endsWith(".mvr") ? "mvr" : "gdtf");
      const response = await fetch("/api/integrations/showtech", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      content = JSON.stringify(result.rows.length ? result.rows : result, null, 2);
      format = "json";
      moduleId = "lighting";
      type = result.format === "gdtf" ? "device-profile" : "patch";
      mapping = {};
      preview = null;
      notice = result.warnings.join(" ");
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="integration-workspace">
  <ErrorMessage message={error} />{#if notice}<p role="status" class="surface">{notice}</p>{/if}
  <section class="surface">
    <h2>Austauschprofile</h2>
    <p>
      Die Vorlagen beschreiben offene Showtime-Felder. Ein Produkt des Zielsystems wird mit dessen
      tatsächlichem Datenvertrag zugeordnet.
    </p>
    {#each adapterProfiles as profile (profile.id)}<details>
        <summary>{profile.label}</summary>
        <p>{profile.note}</p>
        <p class="small"><code>{profile.endpoint}</code> · Scope <code>{profile.scope}</code></p>
        {#if "moduleId" in profile}<div class="button-row">
            <Button disabled={busy} onClick={() => template(profile)}
              >CSV-Spaltenvorlage laden</Button
            ><a
              class="button secondary"
              download={"showtime-" + profile.id + ".csv"}
              href={"data:text/csv;charset=utf-8," +
                encodeURIComponent("\uFEFF" + profile.columns.join(";") + "\r\n")}
              >Leere CSV-Vorlage herunterladen</a
            >
          </div>{:else}<a href="/?module=exports">Zeitnachweise exportieren</a>{/if}
      </details>{/each}
  </section>
  <section class="surface">
    <h2>Import & Export</h2>
    <p>
      CSV/JSON werden dem gewählten Fachablauf zugeordnet. Referenzen brauchen Showtime-IDs; gleiche
      Namen werden nicht still zugeordnet. Geldbeträge in Dateien sind Eurocent.
    </p>
    <div class="form-grid">
      <label
        >Gewerk<select
          bind:value={moduleId}
          on:change={() => {
            type =
              planning.modules.find((m) => m.moduleId === moduleId)?.manifest.features[0]?.id || "";
            preview = null;
          }}
          >{#each planning.modules as module (module.moduleId)}<option value={module.moduleId}
              >{module.manifest.label}</option
            >{/each}</select
        ></label
      ><label
        >Fachablauf<select bind:value={type} on:change={() => (preview = null)}
          >{#each manifest?.features || [] as f (f.id)}<option value={f.id}>{f.label}</option
            >{/each}</select
        ></label
      >
    </div>
    <div class="button-row">
      {#if !feature?.private || confirmed}<a class="button secondary" href={exportUrl("csv")}
          >CSV exportieren</a
        ><a class="button secondary" href={exportUrl("json")}>JSON exportieren</a>{/if}<a
        class="button secondary"
        href="/api/export?kind=events&format=ics">Kalender als iCalendar</a
      >
    </div>
    {#if feature?.private}<label class="check-label"
        ><input type="checkbox" bind:checked={confirmed} />Geschützte Daten dieses Fachbereichs
        bewusst exportieren</label
      >{/if}
    <label
      >Importdatei (CSV/JSON, bis 100 Zeilen)<input
        type="file"
        accept=".csv,.json"
        disabled={busy}
        on:change={readFile}
      /></label
    ><label
      >Dateiinhalt<textarea
        bind:value={content}
        on:input={() => (preview = null)}
        maxlength="1000000"
        rows="5"></textarea></label
    >
    {#if preview?.columns.length}<details>
        <summary>Spaltenzuordnung anpassen</summary>
        <div class="form-grid">
          {#each [{ key: "title", label: "Titel" }, { key: "externalId", label: "Externe ID (optional)" }, ...(feature?.fields.filter((f) => !f.managed) || [])] as field (field.key)}<label
              >{field.label}<select
                value={Object.hasOwn(mapping, field.key) ? mapping[field.key] : field.key}
                on:change={(e) => {
                  mapping = { ...mapping, [field.key]: e.currentTarget.value };
                  mappingDirty = true;
                }}
                ><option value="">Nicht zuordnen</option
                >{#each preview.columns as column (column)}<option value={column}>{column}</option
                  >{/each}</select
              ></label
            >{/each}
        </div>
      </details>{/if}
    {#if mappingDirty}<p role="status">Zuordnung verändert. Prüfe die Vorschau erneut.</p>{/if}
    <Button disabled={busy || !content} onClick={() => void exchange("preview")}
      >Vorschau prüfen</Button
    >{#if preview}<p>{preview.rows.length} Zeilen · {preview.errors.length} Fehler</p>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Zeile</th><th>Titel</th><th>Ergebnis</th></tr></thead><tbody
            >{#each preview.rows as row (row.row)}<tr
                ><td>{row.row}</td><td>{row.title || "Titel fehlt"}</td><td
                  >{preview.errors.find((e) => e.row === row.row)?.error || "Gültig"}</td
                ></tr
              >{/each}</tbody
          >
        </table>
      </div>
      <Button
        variant="primary"
        disabled={busy || !!preview.errors.length || mappingDirty}
        onClick={() => void exchange("apply")}>Geprüften Import übernehmen</Button
      >{/if}
  </section>
  <section class="surface">
    <h2>Showtechnik & CAD</h2>
    <p>
      MVR/GDTF-Metadaten lassen sich prüfen. Ergänze bei MVR den tatsächlichen DMX-Footprint vor dem
      Patchimport. CAD-/Geräteoriginale und Medien werden als private, versionierte Anlagen am
      Fachstand abgelegt.
    </p>
    <label
      >MVR/GDTF zur Vorschau<input
        type="file"
        accept=".mvr,.gdtf"
        disabled={busy}
        on:change={showtech}
      /></label
    >
    <p class="small muted">
      Offene Austauschprofile für Ticketing, DATEV-nahe CSV/ASCII, Dienste, Geräte und Kalender sind
      unter <a href="/schnittstellen">Schnittstellen</a> beschrieben.
    </p>
  </section>
  {#if canAdmin}<section class="surface">
      <h2>Offene API</h2>
      <p>
        Zugänge gelten für deine aktuelle Theater-/Gewerkzuordnung und höchstens deine aktuellen
        Rechte. Rollenentzug, Ablauf und Widerruf wirken bei jeder Anfrage.
      </p>
      <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">OpenAPI-Vertrag öffnen</a>
      <form class="form-grid" on:submit|preventDefault={() => void key()}>
        <label
          >Zweck / System<input bind:value={label} minlength="2" maxlength="100" required /></label
        ><label
          >Gültig (Tage, max. 90)<input
            type="number"
            bind:value={expires}
            min="1"
            max="90"
            required
          /></label
        >
        <fieldset class="form-multi full">
          <legend>Erlaubte Datenbereiche</legend>{#each scopeOptions as [value, name]}<label
              class="check-label"
              ><input
                type="checkbox"
                checked={scopes.includes(value)}
                on:change={(e) =>
                  (scopes = e.currentTarget.checked
                    ? [...scopes, value]
                    : scopes.filter((s) => s !== value))}
              />{name}</label
            >{/each}
        </fieldset>
        <button class="button primary" disabled={busy || !scopes.length}
          >API-Zugang erstellen</button
        >
      </form>
      {#if token}<label>Einmalig angezeigter Zugang<input readonly value={token} /></label><Button
          onClick={() => (token = "")}>Anzeige schließen</Button
        >{/if}{#each entries as entry (entry.id)}<article class="integration-key">
          <h3>{entry.label}</h3>
          <p class="small">{entry.scopes.join(", ")} · bis {dateLabel(entry.expiresAt)}</p>
          {#if entry.revokedAt}<p>Widerrufen</p>{:else}<Button
              disabled={busy}
              onClick={() => void revoke(entry.id)}>Zugang widerrufen</Button
            >{/if}
        </article>{/each}
    </section>{/if}
</div>

<style>
  .integration-workspace {
    display: grid;
    gap: 20px;
    min-width: 0;
  }
  .button-row {
    margin: 16px 0;
  }
  .table-scroll {
    overflow: auto;
  }
  .integration-key {
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
  }
  details {
    margin: 16px 0;
  }
  textarea {
    font-family: var(--font-mono, monospace);
    max-height: 240px;
  }
</style>
