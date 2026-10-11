<script lang="ts">
  import { moduleRegistry } from "@/modules/theater/registry";
  import { adapterProfiles } from "@/shared/adapter-profiles";
</script>

<svelte:head><title>Offene Schnittstellen · Showtime</title></svelte:head>
<main class="interface-docs">
  <header>
    <h1>Offene Schnittstellen</h1>
    <p>
      Verbinde Fachstände, Spielplan, Ticketing und Finanzexporte mit deinen bestehenden Systemen.
    </p>
    <a class="button secondary" href="/?module=theater&view=integrations"
      >Zur Schnittstellenverwaltung</a
    >
  </header>
  <section class="surface">
    <h2>API v1</h2>
    <p>
      Die <a href="/api/v1/openapi.json">OpenAPI-Beschreibung</a> enthält Pfade, Rechte und aktuelle Fachverträge.
      Erstelle einen befristeten Zugang im berechtigten Theater und sende ihn im Authorization-Header.
      Schlüssel gehören niemals in URLs.
    </p>
    <pre><code
        >Authorization: Bearer &lt;Showtime-Zugang&gt;
Content-Type: application/json
Idempotency-Key: eindeutiger-vorgang-2026</code
      ></pre>
    <p>
      Scopes begrenzen aktuelle Benutzerrechte. Tenant, Gewerk und Produktion werden serverseitig
      geprüft. Ein Rechteentzug oder Schlüsselwiderruf gilt beim nächsten Abruf. Änderungen brauchen
      einen Wiederholschlüssel; dieselbe Nutzlast wird einmal verarbeitet, eine abweichende Nutzlast
      mit demselben Schlüssel erhält 409.
    </p>
    <ul>
      <li>
        GET /api/v1/trade-items: Facheinträge, filterbar nach moduleId, type und productionId.
      </li>
      <li>
        GET/POST /api/v1/records: gemeinsame Produktionen, Personen, Besetzung, Aufgaben und
        Bestand; kind angeben.
      </li>
      <li>GET/POST /api/v1/calendar: Termine mit UTC-Zeitpunkten und Personen-/Raumbezug.</li>
      <li>POST /api/v1/ticketing: Besucher-/Kassenbericht zu einer Showtime-Vorstellung.</li>
      <li>
        GET /api/v1/finance, /time, /resources, /performances: berechtigte Daten und nächste
        Seitenposition.
      </li>
      <li>
        GET/POST /api/v1/exchange: CSV/JSON-Export sowie validierte Importvorschau und Übernahme.
      </li>
    </ul>
    <p>
      Listen sind paginiert; folge nextCursor, bis es null ist. from/to sind ISO-Datumswerte.
      Datenmengen und Anfragen sind begrenzt: 120 Anfragen je Minute und Zugang; Importe bis 100
      Zeilen und 1 MB.
    </p>
  </section>
  <section class="surface">
    <h2>Dateiformate und Zuordnung</h2>
    <p>
      CSV mit Komma, Semikolon oder Tabulator und UTF-8-BOM sowie JSON-Arrays werden unterstützt.
      Titel, externe ID und Fachfelder lassen sich zuordnen. Referenzen enthalten Showtime-IDs;
      gleiche Personennamen werden nicht automatisch verknüpft. Zeiten sind ISO 8601 in UTC,
      Geldbeträge ganzzahlige Eurocent. Die Oberfläche zeigt Euro und die Theaterzeitzone.
    </p>
    <p>
      Vorschau speichert keine Datensätze. Die Übernahme prüft alle Zeilen erneut und rollt bei
      einem Fehler den gesamten Import zurück. Gleiche externe IDs werden je Zugang und Fachfunktion
      wiedererkannt; Updates benötigen id und expectedVersion. Formale Freigaben und
      Bestandsbewegungen werden über ihren eigenen Ablauf vorgenommen.
    </p>
  </section>
  <section class="surface">
    <h2>Marktübliche Austauschwege</h2>
    <ul>
      <li>
        <strong>Ticketing:</strong> EVENTIM.Inhouse bietet Ticketing für Theater- und Konzerthäuser. Verwende
        den neutralen Besucherbericht mit performanceId, visitors, offeredSeats, paidTickets, complimentaryTickets
        und amountCents; ein Vertrag mit dem Ticketinganbieter legt später dessen tatsächlichen Abrufweg
        fest.
      </li>
      <li>
        <strong>Finanz / Lohn:</strong> DATEV unterstützt definierte ASCII-/CSV-Wege. Showtime liefert
        abgegrenzte Zeit- und Finanzdaten als CSV/JSON. Eine DATEV-Datei benötigt das bestätigte Importprofil
        des zuständigen Rechnungswesens; ein neutraler CSV-Export ist keine zertifizierte Lohnabrechnung.
      </li>
      <li>
        <strong>Showtechnik:</strong> MVR-Szenen werden als Patchvorschau und GDTF-Gerätebeschreibungen
        als Geräteprofile eingelesen. Prüfe DMX-Modus und Footprint vor der Übernahme. Überschneidungen
        werden beim Speichern abgewiesen.
      </li>
      <li>
        <strong>CAD und Medien:</strong> DWG, DXF, MVR, GDTF, Audio, Video, PDF und Office-Dateien können
        als geschützte Anlagen bis 64 MB abgelegt werden. Originale bleiben unverändert; es werden keine
        Gerätebefehle ausgeführt.
      </li>
      <li>
        <strong>Kalender:</strong> iCalendar-Export nach RFC 5545 für die berechtigten Termine. Wiederholungen
        und Abwesenheiten bleiben dem eingestellten Theater zugeordnet.
      </li>
    </ul>
    <p>
      Primärquellen: <a href="https://www.eventim-inhouse.de/produkte/ticketing">EVENTIM</a>,
      <a
        href="https://www.datev.de/web/de/unternehmen/loesungen/lohn-und-personal/lohn-und-gehaltsabrechnung/schnittstellen"
        >DATEV</a
      >, <a href="https://gdtf-share.com/help/developers/">GDTF/MVR</a>,
      <a href="https://www.rfc-editor.org/info/rfc5545/">RFC 5545</a>.
    </p>
  </section>
  <section class="surface">
    <h2>Adapterprofile und Vorlagen</h2>
    <p>
      Diese offenen Profile liefern die Ausgangsspalten für deine Zuordnung. Prüfe Referenzen und
      Feldzuordnung in der Importvorschau, bevor du Daten übernimmst.
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Austausch</th><th>Weg</th><th>Vorlage</th></tr></thead><tbody
          >{#each adapterProfiles as profile (profile.id)}<tr
              ><td
                ><strong>{profile.label}</strong>
                <p class="small muted">{profile.note}</p></td
              ><td><code>{profile.endpoint}</code></td><td
                >{#if "moduleId" in profile}<a
                    class="button secondary"
                    download={"showtime-" + profile.id + "-vorlage.csv"}
                    href={"data:text/csv;charset=utf-8," +
                      encodeURIComponent("\uFEFF" + profile.columns.join(";") + "\n")}
                    >CSV-Vorlage</a
                  >{:else}<a href="/api/v1/openapi.json">Datenvertrag</a>{/if}</td
              ></tr
            >{/each}</tbody
        >
      </table>
    </div>
  </section>
  <section class="surface">
    <h2>Verträge je Gewerk</h2>
    {#each moduleRegistry as module (module.id)}<details>
        <summary>{module.label} · {module.features.length} Fachabläufe</summary
        >{#each module.features as feature (feature.id)}<h3>{feature.label}</h3>
          <p>
            <code>{module.id}/{feature.id}</code> · {feature.private
              ? "Geschützter Fachbereich"
              : "Allgemeiner Fachstand"} · {feature.permission}
          </p>
          <ul>
            {#each feature.fields as field (field.key)}<li>
                <code>{field.key}</code>: {field.label}
                {field.required ? "(Pflichtfeld)" : ""}{field.managed
                  ? " · nur durch formale Freigabe"
                  : ""}
              </li>{/each}
          </ul>{/each}
      </details>{/each}
  </section>
</main>

<style>
  .interface-docs {
    max-width: 960px;
    margin: auto;
    padding: 48px 24px;
    display: grid;
    gap: 24px;
  }
  .interface-docs header {
    display: grid;
    gap: 16px;
  }
  .surface {
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, 16px);
    background: var(--panel);
  }
  h1 {
    font-size: clamp(1.8rem, 4vw, 2.8rem);
  }
  h2,
  h3,
  p,
  ul {
    margin-bottom: 16px;
  }
  li {
    margin-bottom: 8px;
  }
  pre {
    overflow: auto;
    background: var(--surface);
    padding: 16px;
  }
  details {
    padding: 16px 0;
    border-top: 1px solid var(--border);
  }
  summary {
    cursor: pointer;
    font-weight: 600;
  }
  @media (max-width: 600px) {
    .interface-docs {
      padding: 24px 16px;
    }
    .surface {
      padding: 16px;
    }
  }
</style>
