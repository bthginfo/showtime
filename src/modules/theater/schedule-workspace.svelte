<script lang="ts">
  import { tick } from "svelte";
  import { ArrowLeft, Plus, BookOpen, CalendarDays } from "@lucide/svelte";
  import { theaterLabel, theaterInstant, theaterDateTime } from "@/shared/theater-time";
  import { shiftDate } from "@/shared/client-api";
  import type {
    Planning,
    Performance,
    TheaterRun,
    ScheduleArea,
    ProductionMetadata,
  } from "./types";
  import type { Collection } from "./collections";
  import { stageLabels } from "./types";
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission, type Permission } from "@/platform/access";
  import { Button, Badge, Modal, Empty, ErrorMessage } from "@/components/ui";
  import WorkTiles from "@/components/work-tiles.svelte";
  import { scheduleAreaTiles } from "@/shared/workspace-tiles";
  import BatchPlanning from "./batch-planning.svelte";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  import SelectionList from "@/components/selection-list.svelte";
  export let planning: Planning;
  export let run: TheaterRun;
  export let busy = false;
  export let more: (collection: Collection) => Promise<void>;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  export let area: ScheduleArea = "";
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let heading: HTMLHeadingElement;
  let editor: "work" | "season" | "run" | "phase" | "performance" | null = null;
  let editing: Performance | null = null;
  let formError = "",
    saving = false;
  let loadingPerformance = false;
  let performanceLoad = 0;
  let curtainInput: HTMLInputElement;
  let chosenProduction = "",
    participantIds: string[] = [];
  let phaseProduction = "",
    phaseWork = "",
    phaseSeason = "",
    phaseStage = "concept";
  let phaseSnapshot: ProductionMetadata | undefined;
  let seasonStart = "",
    runStart = "";
  const allowed = (
    permission: Permission,
    pid = productionId,
    departmentId = workspace.department.id,
  ) =>
    hasPermission({ id: workspace.user.id, grants: workspace.user.grants || [] }, permission, {
      departmentId,
      productionId: pid,
    });
  $: manageable = workspace.records.productions.filter((p) => allowed("production.manage", p.id));
  $: schedulable = workspace.records.productions.filter((p) => allowed("schedule.manage", p.id));
  $: choices = scheduleAreaTiles
    .filter(
      (tile) =>
        !["works", "seasons", "phases"].includes(tile.id) ||
        allowed("production.manage", "") ||
        manageable.length > 0,
    )
    .filter(
      (tile) =>
        tile.id !== "shift" ||
        allowed("schedule.manage") ||
        workspace.records.events.some((event) =>
          allowed("schedule.manage", String(event.data.productionId || ""), event.departmentId),
        ),
    )
    .map((tile) => ({
      ...tile,
      count: (
        {
          performances: planning.performances.length,
          works: planning.works.length,
          seasons: planning.seasons.length,
          phases: planning.productionMetadata.length,
          runs: planning.runs.length,
          versions: planning.scheduleVersions.length,
        } as Record<string, number>
      )[tile.id],
    }));
  $: active = choices.find((tile) => tile.id === area);
  $: calendar = editing
    ? workspace.records.events.find((e) => e.id === editing?.eventId)
    : undefined;
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
  const productionTitle = (id: string) =>
    String(workspace.records.productions.find((p) => p.id === id)?.data.title || "Produktion");
  const versionLabels: Record<string, string> = {
    draft: "Entwurf",
    approved: "Geprüft",
    published: "Veröffentlicht",
  };
  async function choose(next: ScheduleArea) {
    area = next;
    editor = null;
    formError = "";
    await tick();
    heading?.focus();
  }
  function begin(next: typeof editor) {
    editor = next;
    formError = "";
    seasonStart = "";
    runStart = "";
    if (next === "run")
      chosenProduction =
        schedulable.find((p) => p.id === productionId)?.id || schedulable[0]?.id || "";
  }
  function phaseFor(id: string, workId?: string, seasonId?: string) {
    phaseProduction = id;
    phaseSnapshot = planning.productionMetadata.find((m) => m.recordId === id);
    phaseWork = workId ?? phaseSnapshot?.workId ?? "";
    phaseSeason = seasonId ?? phaseSnapshot?.seasonId ?? "";
    phaseStage = phaseSnapshot?.stage || "concept";
  }
  function assign(id?: string, workId?: string, seasonId?: string) {
    phaseFor(
      id || manageable.find((p) => p.id === productionId)?.id || manageable[0]?.id || "",
      workId,
      seasonId,
    );
    begin("phase");
  }
  async function edit(show?: Performance) {
    const loadId = ++performanceLoad;
    loadingPerformance = false;
    editing = show || null;
    chosenProduction =
      show?.productionId ||
      schedulable.find((p) => p.id === productionId)?.id ||
      schedulable[0]?.id ||
      "";
    const participants = workspace.records.events.find((event) => event.id === show?.eventId)?.data
      .participantIds;
    participantIds = Array.isArray(participants) ? participants.map(String) : [workspace.user.id];
    begin("performance");
    if (show && !workspace.records.events.some((event) => event.id === show.eventId)) {
      loadingPerformance = true;
      try {
        const date = theaterDateTime(show.curtainAt, planning.timezone).slice(0, 10);
        await $store.loadWindow("events", date, shiftDate(date, 1));
        if (loadId !== performanceLoad || editor !== "performance") return;
        const event = $store.workspace.records.events.find((event) => event.id === show.eventId);
        if (!event)
          throw new Error(
            "Der zugehörige Termin ist nicht zugänglich. Aktualisiere den Spielplan und öffne die Vorstellung erneut.",
          );
        participantIds = Array.isArray(event.data.participantIds)
          ? event.data.participantIds.map(String)
          : [];
      } catch (error) {
        if (loadId === performanceLoad && editor === "performance")
          formError =
            error instanceof Error
              ? error.message
              : "Die Terminangaben konnten nicht geladen werden. Öffne die Vorstellung erneut.";
      } finally {
        if (loadId === performanceLoad) {
          loadingPerformance = false;
          await tick();
          if (editor === "performance") curtainInput?.focus();
        }
      }
    }
  }
  async function submit(event: SubmitEvent, action: string) {
    if (
      saving ||
      busy ||
      (editor === "performance" && (loadingPerformance || (editing && !calendar)))
    )
      return;
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const data: Record<string, unknown> = Object.fromEntries(form);
    formError = "";
    try {
      for (const key of ["title", "author", "label"])
        if (typeof data[key] === "string") data[key] = data[key].trim();
      if ((action === "work" && !data.title) || (["season", "run"].includes(action) && !data.label))
        throw new Error("Bitte trage eine Bezeichnung ein.");
      if (data.start && data.end && String(data.end) < String(data.start))
        throw new Error("Das Ende muss am oder nach dem Beginn liegen.");
      if (data.curtainAt)
        data.curtainAt = theaterInstant(String(data.curtainAt), planning.timezone);
      for (const key of ["durationMinutes", "pauseMinutes"])
        if (data[key] !== undefined) data[key] = Number(data[key]);
      if (action === "performance") data.participantIds = form.getAll("participantIds").map(String);
      saving = true;
      await run("schedule", {
        action,
        data,
        ...(editing && action === "performance"
          ? { id: editing.id, expectedVersion: editing.version }
          : {}),
        ...(action === "production-metadata" && phaseSnapshot
          ? { expectedVersion: phaseSnapshot.version }
          : {}),
      });
      editor = null;
      editing = null;
    } catch (error) {
      formError =
        error instanceof Error
          ? error.message
          : "Speichern fehlgeschlagen. Bitte erneut versuchen.";
    } finally {
      saving = false;
    }
  }
</script>

{#if !area || !active}
  <section class="catalog-section" aria-label="Spielplanübersicht">
    <div>
      <h2 bind:this={heading} tabindex="-1">Was möchtest du planen?</h2>
      <p class="muted">Wähle einen Bereich. Dort findest du die passenden Einträge und Aktionen.</p>
    </div>
    <WorkTiles
      label="Aufgaben im Spielplan"
      tiles={choices}
      disabled={busy}
      onChoose={(id) => void choose(id as ScheduleArea)}
    />
  </section>
{:else}
  <section class="catalog-section" aria-label={active.title}>
    <Button onClick={() => void choose("")}><ArrowLeft size={16} />Zur Spielplanübersicht</Button>
    <div class="section-heading">
      <div>
        <h2 bind:this={heading} tabindex="-1">{active.title}</h2>
        <p class="muted">{active.description}</p>
      </div>
      {#if area === "performances" && schedulable.length}<Button
          variant="primary"
          disabled={busy}
          onClick={() => edit()}><Plus size={16} />Vorstellung anlegen</Button
        >
      {:else if area === "works" && allowed("production.manage", "")}<Button
          variant="primary"
          disabled={busy}
          onClick={() => begin("work")}><Plus size={16} />Werk anlegen</Button
        >
      {:else if area === "seasons" && allowed("production.manage", "")}<Button
          variant="primary"
          disabled={busy}
          onClick={() => begin("season")}><Plus size={16} />Spielzeit anlegen</Button
        >
      {:else if area === "runs" && schedulable.length}<Button
          variant="primary"
          disabled={busy || !workspace.records.productions.length}
          onClick={() => begin("run")}><Plus size={16} />Serie anlegen</Button
        >
      {:else if area === "phases" && manageable.length}<Button
          variant="primary"
          disabled={busy}
          onClick={() => assign()}><Plus size={16} />Produktion zuordnen</Button
        >{/if}
    </div>
    {#if area === "shift"}<BatchPlanning {planning} {productionId} {onChanged} initiallyExpanded />
    {:else if area === "performances"}
      <div class="catalog-grid">
        {#each [...planning.performances].sort( (a, b) => a.curtainAt.localeCompare(b.curtainAt) ) as show (show.id)}
          {@const event = workspace.records.events.find((event) => event.id === show.eventId)}
          <article class="catalog-card">
            <div class="catalog-card-heading">
              <CalendarDays size={20} /><Badge>{tradeChoiceLabel(show.status)}</Badge>
            </div>
            <h3>{productionTitle(show.productionId)}</h3>
            <p>{dateLabel(show.curtainAt, true)}</p>
            {#if event?.data.end}<p class="small muted">
                Ende: {dateLabel(String(event.data.end), true)}
              </p>{/if}
            {#if show.runId}<p class="small muted">
                {planning.runs.find((r) => r.id === show.runId)?.label || "Vorstellungsserie"}
              </p>{/if}
            {#if allowed("schedule.manage", show.productionId)}<div class="catalog-card-actions">
                <Button disabled={busy} onClick={() => edit(show)}>Vorstellung bearbeiten</Button>
              </div>{/if}
          </article>
        {:else}<Empty
            title="Noch keine Vorstellungen in diesem Zeitraum"
            description="Wähle einen anderen Zeitraum oder lege eine Vorstellung an."
          />{/each}
      </div>
      {#if planning.pages.performances}<Button
          disabled={busy}
          onClick={() => void more("performances")}>Weitere Vorstellungen laden</Button
        >{/if}
    {:else if area === "works"}
      <div class="catalog-grid">
        {#each planning.works as work (work.id)}<article class="catalog-card">
            <BookOpen size={22} />
            <h3>{work.title}</h3>
            <p class="muted">{work.author || "Urheberangabe noch offen"}</p>
            {#if manageable.length}<div class="catalog-card-actions">
                <Button disabled={busy} onClick={() => assign(undefined, work.id)}
                  >Zu Produktion zuordnen</Button
                >
              </div>{/if}
          </article>{:else}<Empty
            title="Das erste Werk anlegen"
            description="Ein Werk beschreibt das Stück und seine Urheber. Ordne es anschließend einer Produktion zu."
          />{/each}
      </div>
      {#if planning.pages.works}<Button disabled={busy} onClick={() => void more("works")}
          >Weitere Werke laden</Button
        >{/if}
    {:else if area === "seasons"}
      <div class="catalog-grid">
        {#each planning.seasons as season (season.id)}<article class="catalog-card">
            <CalendarDays size={22} />
            <h3>{season.label}</h3>
            <dl class="catalog-facts">
              <div>
                <dt>Beginn</dt>
                <dd>{dateLabel(season.startAt)}</dd>
              </div>
              <div>
                <dt>Ende</dt>
                <dd>{dateLabel(season.endAt)}</dd>
              </div>
            </dl>
            {#if manageable.length}<div class="catalog-card-actions">
                <Button disabled={busy} onClick={() => assign(undefined, undefined, season.id)}
                  >Zu Produktion zuordnen</Button
                >
              </div>{/if}
          </article>{:else}<Empty
            title="Noch keine Spielzeit erfasst"
            description="Lege die Bezeichnung und den Zeitraum eurer Spielzeit fest."
          />{/each}
      </div>
      {#if planning.pages.seasons}<Button disabled={busy} onClick={() => void more("seasons")}
          >Weitere Spielzeiten laden</Button
        >{/if}
    {:else if area === "phases"}
      <div class="catalog-grid">
        {#each planning.productionMetadata as metadata (metadata.id)}<article class="catalog-card">
            <div class="catalog-card-heading">
              <BookOpen size={20} /><Badge>{stageLabels[metadata.stage] || metadata.stage}</Badge>
            </div>
            <h3>{productionTitle(metadata.recordId)}</h3>
            <dl class="catalog-facts">
              <div>
                <dt>Werk</dt>
                <dd>
                  {metadata.workId
                    ? planning.works.find((w) => w.id === metadata.workId)?.title ||
                      "Werk außerhalb dieser Ansicht"
                    : "Noch nicht zugeordnet"}
                </dd>
              </div>
              <div>
                <dt>Spielzeit</dt>
                <dd>
                  {metadata.seasonId
                    ? planning.seasons.find((s) => s.id === metadata.seasonId)?.label ||
                      "Spielzeit außerhalb dieser Ansicht"
                    : "Noch nicht zugeordnet"}
                </dd>
              </div>
            </dl>
            {#if allowed("production.manage", metadata.recordId)}<div class="catalog-card-actions">
                <Button disabled={busy} onClick={() => assign(metadata.recordId)}
                  >Phase und Zuordnung ändern</Button
                >
              </div>{/if}
          </article>{:else}<Empty
            title="Produktionen zuordnen"
            description="Verknüpfe eine Produktion mit ihrem Werk und ihrer Spielzeit und wähle die aktuelle Phase."
          />{/each}
      </div>
      {#if planning.pages.productionMetadata}<Button
          disabled={busy}
          onClick={() => void more("productionMetadata")}>Weitere Produktionsstände laden</Button
        >{/if}
    {:else if area === "runs"}
      <div class="catalog-grid">
        {#each planning.runs as series (series.id)}<article class="catalog-card">
            <CalendarDays size={22} />
            <h3>{series.label}</h3>
            <p>{productionTitle(series.productionId)}</p>
            <p class="small muted">
              {series.startAt ? dateLabel(series.startAt) : "Beginn noch offen"} – {series.endAt
                ? dateLabel(series.endAt)
                : "Ende noch offen"}
            </p>
          </article>{:else}<Empty
            title="Vorstellungen zu einer Serie bündeln"
            description="Eine Serie gehört zu einer Produktion und hat einen eigenen Zeitraum, beispielsweise die Premierenserie."
          />{/each}
      </div>
      {#if planning.pages.runs}<Button disabled={busy} onClick={() => void more("runs")}
          >Weitere Serien laden</Button
        >{/if}
    {:else if area === "versions"}
      <p class="muted">
        Die Planversion enthält Vorstellungen, Raumbelegungen und persönliche Dienste im gewählten
        Zeitraum. Prüfe einen aktuellen Entwurf vor der Veröffentlichung.
      </p>
      {#if allowed("schedule.manage", "", "")}<Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run("schedule", { action: "schedule-draft", data: planning.window }).catch(
              () => {},
            )}><Plus size={16} />Aktuellen Plan als Entwurf sichern</Button
        >{/if}
      <div class="catalog-grid">
        {#each [...planning.scheduleVersions].sort((a, b) => b.version - a.version) as version (version.id)}<article
            class="catalog-card"
          >
            <Badge>{versionLabels[version.state] || version.state}</Badge>
            <h3>Planversion {version.version}</h3>
            <p class="muted">{dateLabel(version.createdAt, true)}</p>
            <div class="catalog-card-actions">
              {#if version.state === "draft" && allowed("schedule.manage", "", "")}<Button
                  disabled={busy}
                  onClick={() =>
                    void run("schedule", { action: "schedule-approve", id: version.id }).catch(
                      () => {},
                    )}>Prüfung abschließen</Button
                >{/if}
              {#if version.state === "approved" && allowed("schedule.publish", "", "")}<Button
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    void run("schedule", { action: "schedule-publish", id: version.id }).catch(
                      () => {},
                    )}>Veröffentlichen</Button
                >{/if}
            </div>
          </article>{:else}<Empty
            title="Noch keine Planversion gespeichert"
            description="Sichere den aktuellen Plan als Entwurf. Danach kannst du ihn prüfen und veröffentlichen."
          />{/each}
      </div>
      {#if planning.pages.scheduleVersions}<Button
          disabled={busy}
          onClick={() => void more("scheduleVersions")}>Weitere Versionen laden</Button
        >{/if}
    {/if}
  </section>
{/if}

{#if editor}<Modal
    title={editor === "work"
      ? "Werk anlegen"
      : editor === "season"
        ? "Spielzeit anlegen"
        : editor === "run"
          ? "Serie anlegen"
          : editor === "phase"
            ? "Phase und Zuordnung ändern"
            : editing
              ? "Vorstellung bearbeiten"
              : "Vorstellung anlegen"}
    onClose={() => (editor = null)}
    wide={editor === "performance"}
    initialFocus="input:not([disabled]):not([type=hidden]),select:not([disabled])"
  >
    <form
      class="form-grid"
      aria-busy={saving}
      on:submit|preventDefault={(event) =>
        void submit(event, editor === "phase" ? "production-metadata" : editor!)}
    >
      {#if editor === "work"}
        <label class="full">Titel des Werks<input name="title" required maxlength="200" /></label
        ><label class="full"
          >Autor / Autorin (optional)<input name="author" maxlength="150" /></label
        >
        <p class="small muted full">
          Eine Produktion kann diesem Werk nach dem Speichern zugeordnet werden.
        </p>
      {:else if editor === "season"}
        <label class="full"
          >Bezeichnung<input
            name="label"
            placeholder="Zum Beispiel 2026/2027"
            required
            maxlength="100"
          /></label
        ><label>Beginn<input name="start" type="date" bind:value={seasonStart} required /></label
        ><label>Ende<input name="end" type="date" min={seasonStart || undefined} required /></label>
      {:else if editor === "run"}
        <label class="full"
          >Produktion<select name="productionId" bind:value={chosenProduction} required
            >{#each schedulable as p (p.id)}<option value={p.id}>{String(p.data.title)}</option
              >{/each}</select
          ></label
        >
        <label class="full"
          >Name der Serie<input
            name="label"
            placeholder="Zum Beispiel Premierenserie"
            required
            maxlength="100"
          /></label
        ><label>Beginn<input type="date" name="start" bind:value={runStart} required /></label
        ><label>Ende<input type="date" name="end" min={runStart || undefined} required /></label>
      {:else if editor === "phase"}
        <label class="full"
          >Produktion<select
            name="recordId"
            bind:value={phaseProduction}
            on:change={() => phaseFor(phaseProduction)}
            required
            >{#each manageable as p (p.id)}<option value={p.id}>{String(p.data.title)}</option
              >{/each}</select
          ></label
        >
        <label class="full"
          >Werk<select name="workId" bind:value={phaseWork}
            ><option value="">Ohne Zuordnung</option
            >{#if phaseWork && !planning.works.some((work) => work.id === phaseWork)}<option
                value={phaseWork}>Aktuell zugeordnetes Werk · noch nicht geladen</option
              >{/if}{#each planning.works as work (work.id)}<option value={work.id}
                >{work.title}</option
              >{/each}</select
          ></label
        >
        <label
          >Spielzeit<select name="seasonId" bind:value={phaseSeason}
            ><option value="">Ohne Zuordnung</option
            >{#if phaseSeason && !planning.seasons.some((season) => season.id === phaseSeason)}<option
                value={phaseSeason}>Aktuell zugeordnete Spielzeit · noch nicht geladen</option
              >{/if}{#each planning.seasons as season (season.id)}<option value={season.id}
                >{season.label}</option
              >{/each}</select
          ></label
        >
        <label
          >Phase<select name="stage" bind:value={phaseStage}
            >{#each Object.entries(stageLabels) as [key, label]}<option value={key}>{label}</option
              >{/each}</select
          ></label
        >
        {#if planning.pages.works || planning.pages.seasons}<div class="full actions">
            {#if planning.pages.works}<Button disabled={busy} onClick={() => void more("works")}
                >Weitere Werke laden</Button
              >{/if}
            {#if planning.pages.seasons}<Button disabled={busy} onClick={() => void more("seasons")}
                >Weitere Spielzeiten laden</Button
              >{/if}
          </div>{/if}
      {:else if editor === "performance"}
        {#if loadingPerformance}<p class="muted full" role="status">
            Terminangaben werden geladen …
          </p>{:else if !editing || calendar}
          <label class="full"
            >Produktion<select
              name="productionId"
              bind:value={chosenProduction}
              disabled={!!editing}
              required
              >{#each schedulable as p (p.id)}<option value={p.id}>{String(p.data.title)}</option
                >{/each}</select
            >{#if editing}<input
                type="hidden"
                name="productionId"
                value={chosenProduction}
              />{/if}</label
          >
          <label
            >Vorstellungsbeginn<input
              bind:this={curtainInput}
              name="curtainAt"
              type="datetime-local"
              value={editing ? theaterDateTime(editing.curtainAt, planning.timezone) : ""}
              required
            /></label
          ><label
            >Dauer (Min.)<input
              name="durationMinutes"
              type="number"
              value={calendar
                ? Math.round(
                    (Date.parse(String(calendar.data.end)) -
                      Date.parse(String(calendar.data.start))) /
                      60000,
                  )
                : 120}
              min="1"
              max="480"
              required
            /></label
          >
          <label
            >Bühne / Raum<select name="resourceId" value={String(calendar?.data.resourceId || "")}
              ><option value="">Ohne Raum</option
              >{#if calendar?.data.resourceId && !planning.resources.some((resource) => resource.id === calendar?.data.resourceId)}<option
                  value={String(calendar.data.resourceId)}
                  >Zugeordneter Raum · noch nicht geladen</option
                >{/if}
              {#each planning.resources as resource (resource.id)}<option value={resource.id}
                  >{resource.name}</option
                >{/each}</select
            ></label
          >
          <label
            >Status<select name="status" value={editing?.status || "planned"}
              ><option value="planned">Geplant</option><option value="confirmed">Bestätigt</option
              ><option value="cancelled">Abgesagt</option></select
            ></label
          >
          <details class="form-disclosure full">
            <summary>Serie und Pause (optional)</summary>
            <div class="form-grid">
              <label
                >Serie<select name="runId" value={editing?.runId || ""}
                  ><option value="">Ohne Serie</option
                  >{#if editing?.runId && !planning.runs.some((series) => series.id === editing?.runId)}<option
                      value={editing.runId}>Zugeordnete Serie · noch nicht geladen</option
                    >{/if}
                  {#each planning.runs.filter((r) => r.productionId === chosenProduction) as series (series.id)}<option
                      value={series.id}>{series.label}</option
                    >{/each}</select
                ></label
              ><label
                >Pause (Min.)<input
                  type="number"
                  name="pauseMinutes"
                  min="0"
                  max="480"
                  value={Number(calendar?.data.pauseMinutes || 0)}
                /></label
              >
            </div>
          </details>
          <SelectionList
            label="Beteiligte Teammitglieder"
            name="participantIds"
            options={workspace.members
              .filter((m) => m.status === "active")
              .map((m) => ({ id: m.id, label: m.name }))}
            selected={participantIds}
            onChange={(ids) => (participantIds = ids)}
            disabled={busy || saving}
          />
          <p class="small muted full">
            Besetzungen werden aus der zentralen Produktionsbesetzung übernommen. Änderungen werden
            für die zuständigen Gewerke vorgemerkt.
          </p>
        {/if}
      {/if}
      <div class="full"><ErrorMessage message={formError} /></div>
      <div class="dialog-footer full">
        <Button disabled={saving} onClick={() => (editor = null)}>Abbrechen</Button><Button
          type="submit"
          variant="primary"
          disabled={busy ||
            saving ||
            (editor === "performance" && (loadingPerformance || (!!editing && !calendar)))}
          >{saving ? "Wird gespeichert …" : "Speichern"}</Button
        >
      </div>
    </form>
  </Modal>{/if}
