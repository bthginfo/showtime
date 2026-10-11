<script lang="ts">
  import { onMount } from "svelte";
  import {
    ArrowRight,
    ArrowUpRight,
    RefreshCw,
    Search,
    CheckCircle2,
    CircleAlert,
  } from "@lucide/svelte";
  import { Button, ErrorMessage, Badge, Empty } from "@/components/ui";
  import BarChart from "@/components/ui.BarChart.svelte";
  import { api, localDate, shiftDate, dateLabel } from "@/shared/client-api";
  import type { TheaterOverview } from "@/shared/theater-overview";
  import {
    audienceChart,
    chartPercent,
    comparisonChange,
    overviewMoney as money,
    overviewNumber as number,
    productionReadiness,
    type AudienceMetric,
  } from "@/shared/overview-presentation";
  import { stageLabels } from "./types";
  export let onProduction: (id: string) => void;
  export let onNavigate: ((url: string) => void) | null = null;
  export let pageTitle = "";
  export let onHelp: (() => void) | null = null;
  let customPeriod = false;
  let from = shiftDate(localDate(), -30),
    to = shiftDate(localDate(), 30);
  let overview: TheaterOverview | null = null,
    busy = false,
    error = "";
  let query = "",
    productionFilter = "all",
    visibleLimit = 8,
    metric: AudienceMetric = "visitors";
  $: productions = (overview?.productions || []).filter(
    (production) =>
      production.title.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")) &&
      (productionFilter === "all" ||
        (productionFilter === "ready"
          ? production.required > 0 && production.confirmed >= production.required
          : production.required === 0 || production.confirmed < production.required)),
  );
  $: readiness = productionReadiness(overview?.productions || []);
  $: points = audienceChart(overview?.trend || [], metric);
  $: visitorChange = overview
    ? comparisonChange(
        overview.audience.visitors,
        overview.comparison.visitors,
        overview.comparison.reports,
      )
    : null;
  $: hasReports = Boolean(overview?.audience.reports);
  const periodLabel = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateLabel(value) : "Datum wählen";
  function preset(days: number) {
    to = localDate();
    from = shiftDate(to, -days + 1);
    void load();
  }
  function navigate(event: MouseEvent, url: string) {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(url);
    }
  }
  async function load() {
    if (busy) return;
    if (!from || !to || to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000) {
      error = "Wähle einen gültigen Zeitraum von höchstens einem Jahr.";
      return;
    }
    busy = true;
    error = "";
    try {
      overview = await api<TheaterOverview>(`/api/theater/overview?from=${from}&to=${to}`);
      visibleLimit = 8;
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Übersicht konnte nicht geladen werden. Versuche es erneut.";
    } finally {
      busy = false;
    }
  }
  onMount(() => void load());
</script>

<section class="leadership-overview" aria-label="Dashboard für die Intendanz" aria-busy={busy}>
  <header class="dashboard-heading">
    <div>
      {#if pageTitle}<h1>{pageTitle}</h1>{:else}<h2>Das Haus im Blick</h2>{/if}
      <p>Produktionen, Publikum und Budget deines Hauses.</p>
    </div>
    <div class="dashboard-actions">
      {#if onHelp}<Button onClick={() => onHelp?.()} title="Hilfe zur Hausübersicht">Hilfe</Button
        >{/if}
      <Button disabled={busy} onClick={() => void load()}
        ><RefreshCw size={16} />{busy ? "Wird aktualisiert …" : "Aktualisieren"}</Button
      >
    </div>
  </header>
  <div class="dashboard-period" class:is-expanded={customPeriod}>
    <div class="dashboard-mobile-period">
      <span
        >{periodLabel(overview?.period.from || from)} – {periodLabel(
          overview?.period.to || to,
        )}</span
      ><button
        class="text-button"
        type="button"
        aria-expanded={customPeriod}
        aria-controls="overview-period-form"
        on:click={() => (customPeriod = !customPeriod)}
        >{customPeriod ? "Auswahl schließen" : "Zeitraum anpassen"}</button
      >
    </div>
    <form id="overview-period-form" on:submit|preventDefault={() => void load()}>
      <label>Von<input type="date" bind:value={from} required disabled={busy} /></label><label
        >Bis<input type="date" bind:value={to} min={from} required disabled={busy} /></label
      ><button class="button secondary" disabled={busy}>Zeitraum anzeigen</button>
    </form>
    <div class="dashboard-presets" aria-label="Zeitraum auswählen">
      {#each [7, 30, 90] as days}<button
          type="button"
          class="button secondary"
          aria-pressed={from === shiftDate(localDate(), -days + 1) && to === localDate()}
          disabled={busy}
          on:click={() => preset(days)}>{days} Tage</button
        >{/each}
      {#each overview?.seasons || [] as season (season.id)}<button
          type="button"
          class="button secondary"
          aria-pressed={from === season.start && to === season.end}
          disabled={busy}
          on:click={() => {
            from = season.start;
            to = season.end;
            void load();
          }}>{season.label}</button
        >{/each}
    </div>
  </div>
  <ErrorMessage message={error} />
  {#if !overview}
    {#if busy}<div class="dashboard-skeleton" role="status">
        <p>Deine Hausübersicht wird geladen …</p>
        <div></div>
        <div></div>
      </div>{:else}<Empty
        title="Hausübersicht noch nicht verfügbar"
        description="Lade die Übersicht erneut. Deine Eingaben zum Zeitraum bleiben erhalten."
      /><Button onClick={() => void load()}>Erneut versuchen</Button>{/if}
  {:else}
    <div class="dashboard-context">
      <p>
        <strong>{number(overview.productionCount)} aktive Produktionen</strong> · {number(
          readiness.ready,
        )} mit allen erforderlichen Bestätigungen
      </p>
      <span>Stand {dateLabel(overview.generatedAt, true)}</span>
    </div>
    <section class="dashboard-priorities" aria-labelledby="attention-title">
      <div class="dashboard-section-title">
        <h3 id="attention-title">Jetzt im Blick behalten</h3>
        <span>Aktive Produktionen · unabhängig vom Zeitraum</span>
      </div>
      <div class="dashboard-priority-list">
        <a
          href="/?module=theater&view=collaborations"
          on:click={(event) => navigate(event, "/?module=theater&view=collaborations")}
          ><strong>{number(overview.requests.open)}</strong><span
            >offene Abstimmungen<small
              >{overview.requests.changesRequested
                ? `${number(overview.requests.changesRequested)} mit Änderungswunsch`
                : "Rückmeldungen und Freigaben"}</small
            ></span
          ><ArrowUpRight size={18} /></a
        >
        <a
          class:needs-attention={overview.requests.overdue > 0}
          href="/?module=theater&view=collaborations"
          on:click={(event) => navigate(event, "/?module=theater&view=collaborations")}
          ><strong>{number(overview.requests.overdue)}</strong><span
            >Rückmeldungen überfällig<small
              >{overview.requests.overdue
                ? "Fristen und nächste Schritte prüfen"
                : "Keine Rückmeldung überfällig"}</small
            ></span
          ><ArrowUpRight size={18} /></a
        >
        <a
          class:needs-attention={overview.blockedItems > 0}
          href="/?module=theater&view=trade"
          on:click={(event) => navigate(event, "/?module=theater&view=trade")}
          ><strong>{number(overview.blockedItems)}</strong><span
            >Facheinträge blockiert<small
              >{overview.blockedItems
                ? "Zuständigkeit und Abhängigkeiten klären"
                : "Keine blockierten Facheinträge"}</small
            ></span
          ><ArrowUpRight size={18} /></a
        >
      </div>
    </section>
    <div class="dashboard-main-grid">
      <section class="dashboard-panel dashboard-audience" aria-labelledby="audience-title">
        <header class="dashboard-section-title">
          <div>
            <h3 id="audience-title">Publikum & Vorstellungen</h3>
            <p>{dateLabel(overview.period.from)} – {dateLabel(overview.period.to)}</p>
          </div>
          <Badge
            >{overview.audience.reports} / {overview.audience.reportablePerformances} Berichte</Badge
          >
        </header>
        <dl class="dashboard-kpis">
          <div>
            <dt>Besucher</dt>
            <dd>{hasReports ? number(overview.audience.visitors) : "—"}</dd>
            <span>in abgeschlossenen Berichten</span>
          </div>
          <div>
            <dt>Auslastung</dt>
            <dd>
              {overview.audience.occupancy === null
                ? "—"
                : number(overview.audience.occupancy, 1) + " %"}
            </dd>
            <span
              >{hasReports
                ? `${number(overview.audience.offeredSeats)} angebotene Plätze`
                : "Noch keine Berichtsdaten"}</span
            >
          </div>
          <div>
            <dt>Karteneinnahmen</dt>
            <dd>{hasReports ? money(overview.audience.incomeCents) : "—"}</dd>
            <span>laut erfassten Kassenberichten</span>
          </div>
        </dl>
        <div class="dashboard-chart-heading">
          <h4>Monate im Vergleich</h4>
          <div class="dashboard-metric-picker" aria-label="Kennzahl für das Diagramm">
            {#each [["visitors", "Besucher"], ["incomeCents", "Einnahmen"], ["occupancy", "Auslastung"]] as [key, label]}<button
                type="button"
                aria-pressed={metric === key}
                on:click={() => (metric = key as AudienceMetric)}>{label}</button
              >{/each}
          </div>
        </div>
        {#if points.some((point) => point.value !== null)}<BarChart
            title={metric === "visitors"
              ? "Besucher je Monat"
              : metric === "incomeCents"
                ? "Karteneinnahmen je Monat"
                : "Auslastung je Monat"}
            {points}
            unit={metric === "incomeCents" ? "€" : metric === "occupancy" ? "%" : "Besucher"}
            minimumMaximum={metric === "occupancy" ? 100 : 0}
          />{:else}<div class="dashboard-no-data">
            <h4>Noch keine abgeschlossenen Besucherberichte</h4>
            <p>
              Die Grafik erscheint, sobald das Vorderhaus Besucher und Einnahmen für diesen Zeitraum
              dokumentiert hat.
            </p>
            <a
              href="/?module=theater&view=trade"
              on:click={(event) => navigate(event, "/?module=theater&view=trade")}
              >Zum Theaterbetrieb <ArrowRight size={15} /></a
            >
          </div>{/if}
        <div class="dashboard-comparison">
          <div>
            <h4>Gleicher Zeitraum im Vorjahr</h4>
            <p>
              {overview.comparison.reports
                ? `${number(overview.comparison.visitors)} Besucher · ${money(overview.comparison.incomeCents)} · ${overview.comparison.reports} Berichte`
                : "Noch keine Besucherberichte für einen Vergleich vorhanden."}
            </p>
          </div>
          {#if hasReports && visitorChange !== null}<span
              >{visitorChange > 0 ? "+" : ""}{number(visitorChange, 1)} % Besucher</span
            >{/if}
        </div>
        <ul class="dashboard-inline-facts">
          <li><strong>{number(overview.performances.upcoming)}</strong> kommende Vorstellungen</li>
          <li><strong>{number(overview.performances.played)}</strong> vergangene Termine</li>
          <li><strong>{number(overview.performances.cancelled)}</strong> abgesagt</li>
        </ul>
        <p class="dashboard-note">
          Besucher, Auslastung und Einnahmen beruhen auf abgeschlossenen Berichten. Fehlende
          Berichte sind keine Nullwerte.
        </p>
      </section>
      <section class="dashboard-panel dashboard-budget" aria-labelledby="budget-title">
        <header class="dashboard-section-title">
          <div>
            <h3 id="budget-title">Budget & Beschaffung</h3>
            <p>Aktive zugängliche Produktionen</p>
          </div>
        </header>
        <div class="dashboard-budget-total">
          <span>Freigegebener Rahmen</span><strong>{money(overview.budget.plannedCents)}</strong>
        </div>
        <div
          class="dashboard-budget-bar"
          role="img"
          aria-label={`${money(overview.budget.committedCents)} genehmigte Bedarfe von ${money(overview.budget.plannedCents)} Budgetrahmen`}
        >
          <span
            style:width={`${chartPercent(overview.budget.committedCents, overview.budget.plannedCents)}%`}
          ></span>
        </div>
        <dl class="dashboard-budget-values">
          <div>
            <dt><i class="legend-dot" aria-hidden="true"></i>Genehmigte Bedarfe</dt>
            <dd>{money(overview.budget.committedCents)}</dd>
          </div>
          <div>
            <dt>Noch verfügbar</dt>
            <dd class:needs-attention={overview.budget.remainingCents < 0}>
              {money(overview.budget.remainingCents)}
            </dd>
          </div>
          <div>
            <dt>Anträge zur Entscheidung</dt>
            <dd>{money(overview.budget.pendingCents)}</dd>
          </div>
        </dl>
        {#if overview.budget.plannedCents === 0}<p class="dashboard-note">
            Noch kein Budgetrahmen freigegeben. Eine Budgetquote kann deshalb nicht berechnet
            werden.
          </p>{:else if overview.budget.remainingCents < 0}<p class="dashboard-alert">
            <CircleAlert size={16} />Die genehmigten Bedarfe überschreiten den Budgetrahmen.
          </p>{/if}
        <div class="dashboard-forecast">
          <h4>Voraussichtliche Bindung</h4>
          <strong>{money(overview.budget.forecastCents)}</strong>
          <p>Genehmigte Bedarfe, offene Anträge und erfasste Rechnungsmehrkosten.</p>
          {#if overview.budget.plannedCents > 0}<div
              class="dashboard-budget-bar forecast"
              role="img"
              aria-label={`${number((overview.budget.forecastCents / overview.budget.plannedCents) * 100, 1)} Prozent des Budgetrahmens voraussichtlich gebunden`}
            >
              <span
                style:width={`${chartPercent(overview.budget.forecastCents, overview.budget.plannedCents)}%`}
              ></span>
            </div>
            <span
              >{number((overview.budget.forecastCents / overview.budget.plannedCents) * 100, 1)} % des
              freigegebenen Rahmens</span
            >{/if}
        </div>
        <details class="dashboard-details">
          <summary>Beschaffungsstände ansehen</summary>
          <dl class="dashboard-budget-values">
            <div>
              <dt>Bestellt / geliefert</dt>
              <dd>{money(overview.budget.orderedCents)}</dd>
            </div>
            <div>
              <dt>Rechnungen erfasst</dt>
              <dd>{money(overview.budget.invoicedCents)}</dd>
            </div>
            <div>
              <dt>Als bezahlt dokumentiert</dt>
              <dd>{money(overview.budget.paidCents)}</dd>
            </div>
          </dl>
          <p class="dashboard-note">
            Erfasste Nachweise; Zahlungen erfolgen außerhalb von Showtime. Rechnungen werden nicht
            doppelt zum zugeordneten Bedarf addiert.
          </p>
        </details>
      </section>
    </div>
    <div class="dashboard-secondary-grid">
      <section class="dashboard-panel" aria-labelledby="readiness-title">
        <header class="dashboard-section-title">
          <div>
            <h3 id="readiness-title">Wie weit sind die Produktionen?</h3>
            <p>Erforderliche Bestätigungen der Gewerke</p>
          </div>
        </header>
        <div
          class="dashboard-readiness-chart"
          role="img"
          aria-label={`${readiness.ready} Produktionen vollständig bestätigt, ${readiness.pending} mit offenen Bestätigungen, ${readiness.unconfigured} ohne konfigurierte Anforderungen`}
        >
          <div>
            <span><CheckCircle2 size={16} />Vollständig bestätigt</span>
            <div class="readiness-track">
              <i style:width={`${chartPercent(readiness.ready, overview.productionCount)}%`}></i>
            </div>
            <strong>{readiness.ready}</strong>
          </div>
          <div>
            <span>Bestätigungen offen</span>
            <div class="readiness-track pending">
              <i style:width={`${chartPercent(readiness.pending, overview.productionCount)}%`}></i>
            </div>
            <strong>{readiness.pending}</strong>
          </div>
          <div>
            <span>Ohne Anforderungen</span>
            <div class="readiness-track unconfigured">
              <i style:width={`${chartPercent(readiness.unconfigured, overview.productionCount)}%`}
              ></i>
            </div>
            <strong>{readiness.unconfigured}</strong>
          </div>
        </div>
        <p class="dashboard-note">
          {overview.readiness.confirmed} von {overview.readiness.required} erforderlichen Bestätigungen
          liegen vor. Das bestätigt den erfassten Arbeitsstand, keine allgemeine Sicherheitsfreigabe.
        </p>
      </section>
      <section class="dashboard-panel" aria-labelledby="workload-title">
        <header class="dashboard-section-title">
          <div>
            <h3 id="workload-title">Geplante Personalbelastung</h3>
            <p>Im ausgewählten Zeitraum</p>
          </div>
        </header>
        {#if overview.workload.available}<dl class="dashboard-kpis workload">
            <div>
              <dt>Geplante Stunden</dt>
              <dd>{number(overview.workload.plannedHours, 1)}</dd>
            </div>
            <div>
              <dt>Disponierte Personen</dt>
              <dd>{number(overview.workload.people)}</dd>
            </div>
            <div>
              <dt>Über 40 h / Woche</dt>
              <dd class:needs-attention={overview.workload.over40Hours > 0}>
                {number(overview.workload.over40Hours)}
              </dd>
            </div>
          </dl>{:else}<p class="dashboard-no-data">
            Noch keine personengebundenen Dienste im gewählten Zeitraum erfasst.
          </p>{/if}
        <p class="dashboard-note">
          Aus zugänglichen Kalenderdiensten, abzüglich Pausen. Der Wochenmittelwert ist ein Hinweis;
          verbindliche Grenzen bestimmen die bestätigten Regelprofile.
        </p>
        <a
          class="dashboard-inline-link"
          href="/?module=calendar"
          on:click={(event) => navigate(event, "/?module=calendar")}
          >Dienste & Abwesenheiten öffnen <ArrowRight size={15} /></a
        >
      </section>
    </div>
    <section class="dashboard-panel dashboard-productions" aria-labelledby="productions-title">
      <header class="dashboard-section-title">
        <div>
          <h3 id="productions-title">Produktionsstände im Detail</h3>
          <p>Offene Bestätigungen stehen oben. Öffne eine Produktion für die nächsten Schritte.</p>
        </div>
        <span>{number(productions.length)} Produktionen</span>
      </header>
      <div class="dashboard-production-filters">
        <label
          ><span>Produktion suchen</span>
          <div class="dashboard-search">
            <Search size={17} /><input
              type="search"
              bind:value={query}
              placeholder="Name der Produktion"
              on:input={() => (visibleLimit = 8)}
            />
          </div></label
        ><label
          >Arbeitsstand<select bind:value={productionFilter} on:change={() => (visibleLimit = 8)}
            ><option value="all">Alle Produktionsstände</option><option value="open"
              >Mit offenen Punkten</option
            ><option value="ready">Vollständig bestätigt</option></select
          ></label
        >
      </div>
      {#if !productions.length}<Empty
          title="Keine passende Produktion"
          description="Passe die Suche oder den Arbeitsstand an. Neue Produktionen findest du unter Produktionen."
        />{:else}<div class="dashboard-production-list">
          {#each productions.slice(0, visibleLimit) as production (production.id)}<article
              class="dashboard-production-row"
            >
              <div class="dashboard-production-name">
                <h4>{production.title}</h4>
                <span
                  >{stageLabels[production.stage] ||
                    production.stage}{#if production.title.startsWith("DEMO")}
                    · Beispieldaten{/if}</span
                >
              </div>
              <div class="dashboard-production-progress">
                <span>{production.confirmed} / {production.required} bestätigt</span>
                <div
                  class="readiness-track"
                  role="img"
                  aria-label={`${production.confirmed} von ${production.required} erforderlichen Bestätigungen`}
                >
                  <i style:width={`${chartPercent(production.confirmed, production.required)}%`}
                  ></i>
                </div>
              </div>
              <div class="dashboard-production-state">
                {#if production.missing.length}<details>
                    <summary>{production.missing.length} Gewerke offen</summary>
                    <p>{production.missing.join(", ")}</p>
                  </details>{:else if production.required}<span class="ready-label"
                    ><CheckCircle2 size={15} />Alle erforderlichen Gewerke bestätigt</span
                  >{:else}<span>Noch keine Anforderungen konfiguriert</span>{/if}
              </div>
              <Button
                onClick={() => onProduction(production.id)}
                aria-label={`Bereitschaft öffnen: ${production.title}`}
                >Öffnen<ArrowUpRight size={15} /></Button
              >
            </article>{/each}
        </div>
        {#if productions.length > visibleLimit}<Button onClick={() => (visibleLimit += 8)}
            >Weitere {Math.min(8, productions.length - visibleLimit)} Produktionen anzeigen</Button
          >{/if}{/if}
    </section>
  {/if}
</section>
