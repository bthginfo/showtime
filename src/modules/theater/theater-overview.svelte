<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowUpRight, RefreshCw } from "@lucide/svelte";
  import { Button, ErrorMessage, Badge, Empty } from "@/components/ui";
  import { api, localDate, shiftDate, dateLabel } from "@/shared/client-api";
  import type { TheaterOverview } from "@/shared/theater-overview";
  import { stageLabels } from "./types";
  export let onProduction: (id: string) => void;
  let from = shiftDate(localDate(), -30),
    to = shiftDate(localDate(), 30),
    overview: TheaterOverview | null = null,
    busy = false,
    error = "";
  let query = "";
  $: productions =
    overview?.productions.filter((production) =>
      production.title.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")),
    ) || [];
  const money = (cents: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
  async function load() {
    busy = true;
    error = "";
    try {
      overview = await api<TheaterOverview>(`/api/theater/overview?from=${from}&to=${to}`);
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Übersicht konnte nicht geladen werden.";
    } finally {
      busy = false;
    }
  }
  onMount(() => void load());
</script>

<section class="leadership-overview" aria-label="Dashboard für die Intendanz">
  <div class="section-heading">
    <div>
      <h2>Das Haus im Blick</h2>
      <p class="muted">Produktionsstand, offene Abstimmungen und Budgetbindung.</p>
    </div>
    <Button disabled={busy} onClick={() => void load()}><RefreshCw size={16} />Aktualisieren</Button
    >
  </div>
  <form class="filters" on:submit|preventDefault={() => void load()}>
    <label>Zeitraum von<input type="date" bind:value={from} required /></label><label
      >Bis<input type="date" bind:value={to} min={from} required /></label
    ><button class="button secondary" disabled={busy}>Zeitraum anzeigen</button>
  </form>
  <ErrorMessage message={error} />
  {#if !overview}<p role="status" class="muted">
      {busy ? "Hausübersicht wird geladen …" : "Lade die Übersicht erneut."}
    </p>{:else}
    <div class="overview-statement">
      <strong>{overview.productionCount} aktive Produktionen</strong><span
        >{overview.readiness.readyProductions} mit bestätigten erforderlichen Gewerken</span
      ><span class="small muted">Stand {dateLabel(overview.generatedAt, true)}</span>
    </div>
    <div class="overview-layout">
      <section class="panel overview-attention">
        <h3>Was Aufmerksamkeit braucht</h3>
        <dl class="overview-values">
          <div>
            <dt>Offene Abstimmungen</dt>
            <dd>{overview.requests.open}</dd>
          </div>
          <div>
            <dt>Rückmeldung überfällig</dt>
            <dd class:overdue={overview.requests.overdue > 0}>{overview.requests.overdue}</dd>
          </div>
          <div>
            <dt>Überarbeitung erbeten</dt>
            <dd>{overview.requests.changesRequested}</dd>
          </div>
          <div>
            <dt>Blockierte Facheinträge</dt>
            <dd>{overview.blockedItems}</dd>
          </div>
        </dl>
        <p class="small muted">
          Abstimmungen und Produktionsstände beziehen sich auf die für dich zugänglichen aktiven
          Produktionen, unabhängig vom Zeitraum.
        </p>
      </section>
      <section class="panel">
        <h3>Budget aktiver Produktionen</h3>
        <dl class="overview-values">
          <div>
            <dt>Freigegebener Rahmen</dt>
            <dd>{money(overview.budget.plannedCents)}</dd>
          </div>
          <div>
            <dt>Genehmigte Bedarfe</dt>
            <dd>{money(overview.budget.committedCents)}</dd>
          </div>
          <div>
            <dt>Noch verfügbar</dt>
            <dd>{money(overview.budget.remainingCents)}</dd>
          </div>
          <div>
            <dt>Anträge zur Entscheidung</dt>
            <dd>{money(overview.budget.pendingCents)}</dd>
          </div>
        </dl>
        <p class="small muted">
          Budgetbindung aus den erfassten Rahmen und Bedarfsanträgen. Zahlungen und Buchhaltung sind
          darin nicht enthalten.
        </p>
      </section>
    </div>
    <section class="panel overview-audience">
      <div class="section-heading">
        <div>
          <h3>Vorstellungen und Publikum</h3>
          <p class="muted">{dateLabel(overview.period.from)} bis {dateLabel(overview.period.to)}</p>
        </div>
        <Badge
          >{overview.audience.reports} von {overview.audience.reportablePerformances} Vorstellungen dokumentiert</Badge
        >
      </div>
      <dl class="overview-values overview-audience-values">
        <div>
          <dt>Kommende Vorstellungen</dt>
          <dd>{overview.performances.upcoming}</dd>
        </div>
        <div>
          <dt>Vergangene Termine</dt>
          <dd>{overview.performances.played}</dd>
        </div>
        <div>
          <dt>Besucher laut Berichten</dt>
          <dd>{overview.audience.reports ? overview.audience.visitors : "—"}</dd>
        </div>
        <div>
          <dt>Auslastung berichteter Vorstellungen</dt>
          <dd>{overview.audience.occupancy === null ? "—" : `${overview.audience.occupancy} %`}</dd>
        </div>
        <div>
          <dt>Erfasste Karteneinnahmen</dt>
          <dd>{overview.audience.reports ? money(overview.audience.incomeCents) : "—"}</dd>
        </div>
        <div>
          <dt>Abgesagte Vorstellungen</dt>
          <dd>{overview.performances.cancelled}</dd>
        </div>
      </dl>
      <p class="small muted">
        Besucher und Einnahmen stammen ausschließlich aus abgeschlossenen Besucher- und
        Kassenberichten des Vorderhauses. Fehlende Berichte erscheinen als fehlende Daten. Die
        Auslastung teilt erfasste Besucher durch angebotene Plätze derselben Berichte.
      </p>
    </section>
    <section class="panel overview-productions">
      <div class="section-heading">
        <h3>Produktionsbereitschaft</h3>
        <span class="small muted"
          >{overview.readiness.confirmed} von {overview.readiness.required} erforderlichen Bestätigungen</span
        >
      </div>
      <label
        >Produktionen durchsuchen<input
          type="search"
          bind:value={query}
          placeholder="Produktion suchen"
        /></label
      >{#if !productions.length}<Empty
          title="Keine passende Produktion"
          description="Passe die Suche an oder lege eine zugängliche Produktion an."
        />{:else}<div class="table-wrap">
          <table>
            <thead
              ><tr
                ><th>Produktion</th><th>Phase</th><th>Bestätigt</th><th>Noch offen</th><th></th></tr
              ></thead
            ><tbody
              >{#each productions as production (production.id)}<tr
                  ><td
                    ><strong>{production.title}</strong
                    >{#if production.title.startsWith("DEMO")}<span class="small muted">
                        · Beispieldaten</span
                      >{/if}</td
                  ><td>{stageLabels[production.stage] || production.stage}</td><td
                    >{production.confirmed} / {production.required}</td
                  ><td
                    >{production.missing.length
                      ? production.missing.join(", ")
                      : production.required
                        ? "Alle erforderlichen Gewerke bereit"
                        : "Keine erforderlichen Gewerke konfiguriert"}</td
                  ><td
                    ><Button onClick={() => onProduction(production.id)}
                      >Bereitschaft öffnen<ArrowUpRight size={15} /></Button
                    ></td
                  ></tr
                >{/each}</tbody
            >
          </table>
        </div>{/if}
    </section>
  {/if}
</section>
