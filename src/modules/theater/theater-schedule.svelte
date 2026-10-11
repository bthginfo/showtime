<script lang="ts">
  import { theaterLabel } from "@/shared/theater-time";
  import type { Planning, Performance, TheaterRun } from "./types";
  import type { Collection } from "./collections";
  import { stageLabels } from "./types";
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission, type Permission } from "@/platform/access";
  import { Button, Badge, Modal } from "@/components/ui";
  import {} from "@/shared/client-api";
  import { theaterInstant, theaterDateTime } from "@/shared/theater-time";
  import BatchPlanning from "./batch-planning.svelte";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  export let planning: Planning;
  export let run: TheaterRun;
  export let busy = false;
  export let more: (collection: Collection) => Promise<void>;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let editing: Performance | null = null;
  let open = false;
  let chosenProduction = "";
  let phaseProduction = "";
  $: if (!workspace.records.productions.some((p) => p.id === phaseProduction))
    phaseProduction = workspace.records.productions[0]?.id || "";
  $: phaseMetadata = planning.productionMetadata.find((m) => m.recordId === phaseProduction);
  const allowed = (
    permission: Permission,
    pid = productionId,
    departmentId = workspace.department.id,
  ) =>
    hasPermission({ id: workspace.user.id, grants: workspace.user.grants || [] }, permission, {
      departmentId,
      productionId: pid,
    });
  async function submit(event: SubmitEvent, action: string) {
    const formElement = event.currentTarget as HTMLFormElement;
    const form = new FormData(formElement);
    const data: Record<string, unknown> = Object.fromEntries(form);
    for (const key of ["curtainAt"])
      if (data[key]) data[key] = theaterInstant(String(data[key]), planning.timezone);
    for (const key of ["durationMinutes", "pauseMinutes"])
      if (data[key] !== undefined) data[key] = Number(data[key]);
    if (action === "performance") data.participantIds = form.getAll("participantIds").map(String);
    const metadata =
      action === "production-metadata"
        ? planning.productionMetadata.find((m) => m.recordId === data.recordId)
        : null;
    try {
      await run("schedule", {
        action,
        data,
        ...(editing && action === "performance"
          ? { id: editing.id, expectedVersion: editing.version }
          : {}),
        ...(metadata ? { expectedVersion: metadata.version } : {}),
      });
      if (action === "performance") {
        open = false;
        editing = null;
      } else if (action !== "production-metadata") formElement.reset();
    } catch {}
  }
  function edit(show?: Performance) {
    editing = show || null;
    chosenProduction =
      show?.productionId || productionId || workspace.records.productions[0]?.id || "";
    open = true;
  }
  $: calendar = editing
    ? workspace.records.events.find((e) => e.id === editing?.eventId)
    : undefined;
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
</script>

<BatchPlanning {planning} {productionId} {onChanged} />
<section class="surface">
  <div class="section-heading">
    <h2>Vorstellungen</h2>
    {#if allowed("schedule.manage")}<Button variant="primary" onClick={() => edit()}
        >Vorstellung anlegen</Button
      >{/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus enables arrow-key scrolling of this named table region.) -->
  <div class="table-wrap" tabindex="0" role="region" aria-label="Vorstellungen: Tabelle">
    <table>
      <thead><tr><th>Produktion</th><th>Beginn</th><th>Status</th><th>Aktionen</th></tr></thead
      ><tbody
        >{#each planning.performances as show (show.id)}<tr
            ><td
              >{String(
                workspace.records.productions.find((p) => p.id === show.productionId)?.data.title ||
                  "Produktion",
              )}</td
            ><td>{dateLabel(show.curtainAt, true)}</td><td
              ><Badge>{tradeChoiceLabel(show.status)}</Badge></td
            ><td
              >{#if allowed("schedule.manage", show.productionId)}<Button
                  disabled={busy}
                  onClick={() => edit(show)}>Bearbeiten / absagen</Button
                >{/if}</td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>
  {#if planning.pages.performances}<Button disabled={busy} onClick={() => void more("performances")}
      >Weitere Vorstellungen laden</Button
    >{/if}
</section>
<section class="surface">
  <h2>Planversionen</h2>
  <p>
    Eine Planversion umfasst Vorstellungen, Raumbelegungen und persönliche Dienste im gewählten
    Zeitraum. Neue Änderungen erfordern einen aktuellen Entwurf.
  </p>
  {#if allowed("schedule.manage", "", "")}<Button
      disabled={busy}
      onClick={() =>
        void run("schedule", { action: "schedule-draft", data: planning.window }).catch(() => {})}
      >Aktuellen Plan als Entwurf sichern</Button
    >{/if}{#each planning.scheduleVersions.sort((a, b) => b.version - a.version) as version (version.id)}<p
    >
      Version {version.version} · {version.state} · {dateLabel(
        version.createdAt,
        true,
      )}{#if version.state === "draft" && allowed("schedule.manage", "", "")}<Button
          disabled={busy}
          onClick={() =>
            void run("schedule", { action: "schedule-approve", id: version.id }).catch(() => {})}
          >Prüfung abschließen</Button
        >{/if}{#if version.state === "approved" && allowed("schedule.publish", "", "")}<Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run("schedule", { action: "schedule-publish", id: version.id }).catch(() => {})}
          >Veröffentlichen</Button
        >{/if}
    </p>{/each}{#if planning.pages.scheduleVersions}<Button
      disabled={busy}
      onClick={() => void more("scheduleVersions")}>Weitere Versionen laden</Button
    >{/if}
</section>
{#if allowed("production.manage")}<section class="surface">
    <h2>Werke und Spielzeiten</h2>
    <form class="form-grid" on:submit|preventDefault={(e) => void submit(e, "work")}>
      <label>Werk<input name="title" required maxlength="200" /></label><label
        >Autor / Autorin<input name="author" maxlength="150" /></label
      ><button class="button" disabled={busy}>Werk hinzufügen</button>
    </form>
    <ul>
      {#each planning.works as work (work.id)}<li>
          {work.title}{work.author ? " · " + work.author : ""}
        </li>{/each}
    </ul>
    {#if planning.pages.works}<Button onClick={() => void more("works")}>Weitere Werke laden</Button
      >{/if}
    <form class="form-grid" on:submit|preventDefault={(e) => void submit(e, "season")}>
      <label>Spielzeit<input name="label" placeholder="2026/2027" required /></label><label
        >Beginn<input name="start" type="date" required /></label
      ><label>Ende<input name="end" type="date" required /></label><button
        class="button"
        disabled={busy}>Spielzeit hinzufügen</button
      >
    </form>
    <ul>
      {#each planning.seasons as season (season.id)}<li>
          {season.label} · {dateLabel(season.startAt)} – {dateLabel(season.endAt)}
        </li>{/each}
    </ul>
    {#if planning.pages.seasons}<Button onClick={() => void more("seasons")}
        >Weitere Spielzeiten laden</Button
      >{/if}
  </section>
  <section class="surface">
    <h2>Produktionsphase</h2>
    <form class="form-grid" on:submit|preventDefault={(e) => void submit(e, "production-metadata")}>
      <label
        >Produktion<select name="recordId" bind:value={phaseProduction} required
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      ><label
        >Werk<select name="workId" value={phaseMetadata?.workId || ""}
          ><option value="">Ohne Zuordnung</option>{#each planning.works as work (work.id)}<option
              value={work.id}>{work.title}</option
            >{/each}</select
        ></label
      ><label
        >Spielzeit<select name="seasonId" value={phaseMetadata?.seasonId || ""}
          ><option value="">Ohne Zuordnung</option
          >{#each planning.seasons as season (season.id)}<option value={season.id}
              >{season.label}</option
            >{/each}</select
        ></label
      ><label
        >Phase<select name="stage" value={phaseMetadata?.stage || "concept"}
          >{#each Object.entries(stageLabels) as [key, label]}<option value={key}>{label}</option
            >{/each}</select
        ></label
      ><button class="button" disabled={busy}>Phase und Zuordnung speichern</button>
    </form>
    <ul>
      {#each planning.productionMetadata as metadata (metadata.id)}<li>
          {String(
            workspace.records.productions.find((p) => p.id === metadata.recordId)?.data.title ||
              "Produktion",
          )} · {stageLabels[metadata.stage]}
        </li>{/each}
    </ul>
  </section>{/if}
{#if allowed("schedule.manage")}<section class="surface">
    <h2>Vorstellungsserien</h2>
    <form class="form-grid" on:submit|preventDefault={(e) => void submit(e, "run")}>
      <label
        >Produktion<select name="productionId" required
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      ><label>Serie<input name="label" placeholder="Premierenserie" required /></label><label
        >Von<input type="date" name="start" required /></label
      ><label>Bis<input type="date" name="end" required /></label><button
        class="button"
        disabled={busy}>Serie anlegen</button
      >
    </form>
    <ul>
      {#each planning.runs as series (series.id)}<li>{series.label}</li>{/each}
    </ul>
    {#if planning.pages.runs}<Button onClick={() => void more("runs")}>Weitere Serien laden</Button
      >{/if}
  </section>{/if}
{#if open}<Modal
    title={editing ? "Vorstellung bearbeiten" : "Vorstellung anlegen"}
    onClose={() => {
      open = false;
      editing = null;
    }}
    wide
    ><form class="form-grid" on:submit|preventDefault={(e) => void submit(e, "performance")}>
      <label
        >Produktion<select
          name="productionId"
          bind:value={chosenProduction}
          disabled={!!editing}
          required
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        >{#if editing}<input
            type="hidden"
            name="productionId"
            value={chosenProduction}
          />{/if}</label
      ><label
        >Serie<select name="runId" value={editing?.runId || ""}
          ><option value="">Ohne Serie</option
          >{#each planning.runs.filter((r) => r.productionId === chosenProduction) as series (series.id)}<option
              value={series.id}>{series.label}</option
            >{/each}</select
        ></label
      ><label
        >Vorstellungsbeginn<input
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
                (Date.parse(String(calendar.data.end)) - Date.parse(String(calendar.data.start))) /
                  60000,
              )
            : 120}
          min="1"
          max="480"
          required
        /></label
      ><label
        >Bühne / Raum<select name="resourceId" value={String(calendar?.data.resourceId || "")}
          ><option value="">Ohne Raum</option
          >{#each planning.resources as resource (resource.id)}<option value={resource.id}
              >{resource.name}</option
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
      ><label
        >Status<select name="status" value={editing?.status || "planned"}
          ><option value="planned">Geplant</option><option value="confirmed">Bestätigt</option
          ><option value="cancelled">Abgesagt</option></select
        ></label
      >
      <fieldset class="form-multi full">
        <legend>Beteiligte Teammitglieder</legend
        >{#each workspace.members as member (member.id)}<label class="check-label"
            ><input
              type="checkbox"
              name="participantIds"
              value={member.id}
              checked={Array.isArray(calendar?.data.participantIds)
                ? calendar.data.participantIds.includes(member.id)
                : member.id === workspace.user.id}
            />{member.name}</label
          >{/each}
      </fieldset>
      <p class="small muted full">
        Besetzungen werden aus der zentralen Produktionsbesetzung übernommen. Änderungen werden für
        die zuständigen Gewerke vorgemerkt.
      </p>
      <div class="dialog-footer full">
        <Button disabled={busy} onClick={() => (open = false)}>Abbrechen</Button><button
          class="button primary"
          disabled={busy}>Speichern</button
        >
      </div>
    </form></Modal
  >{/if}
