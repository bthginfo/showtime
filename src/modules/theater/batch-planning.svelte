<script lang="ts">
  import { tick } from "svelte";
  import { SvelteDate } from "svelte/reactivity";
  import { ArrowRight, CheckCircle2 } from "@lucide/svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission } from "@/platform/access";
  import { post } from "@/shared/client-api";
  import { Button, ErrorMessage } from "@/components/ui";
  import SelectionList from "@/components/selection-list.svelte";
  import { planningEventLabel, planningEventOptions } from "@/shared/planning-presentation";
  import { theaterDateTime, theaterInstant, theaterLabel } from "@/shared/theater-time";
  import type { Planning } from "./types";
  export let planning: Planning;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  export let initiallyExpanded = false;
  const store = useWorkspace();
  let expanded = initiallyExpanded,
    step = 1,
    selected: string[] = [],
    days = 1,
    minutes = 0;
  let busy = false,
    error = "",
    notice = "",
    operationId = crypto.randomUUID();
  let from = planning.window.from,
    to = planning.window.to;
  let heading: HTMLHeadingElement;
  type Preview = {
    id: string;
    before: { start: string; end: string };
    after: { start: string; end: string };
  };
  let preview: Preview[] = [],
    previewKey = "";
  let selectionNotice = "";
  const countLabel = (count: number) => `${count} ${count === 1 ? "Termin" : "Termine"}`;
  $: workspace = $store.workspace;
  $: events = workspace.records.events.filter(
    (event) =>
      !event.data.cancelled &&
      (!productionId || event.data.productionId === productionId) &&
      hasPermission(
        { id: workspace.user.id, grants: workspace.user.grants || [] },
        "schedule.manage",
        { departmentId: event.departmentId, productionId: String(event.data.productionId || "") },
      ),
  );
  $: options = planningEventOptions(
    events,
    planning.timezone,
    workspace.records.productions,
  ).filter((option) => {
    const date = theaterDateTime(
      String(events.find((event) => event.id === option.id)?.data.start),
      planning.timezone,
    ).slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  });
  $: {
    const visible = new Set(options.map((option) => option.id));
    const retained = selected.filter((id) => visible.has(id));
    const removed = selected.length - retained.length;
    if (removed) {
      selected = retained;
      selectionNotice = `${countLabel(removed)} außerhalb des Zeitraums oder nicht mehr verfügbar. Die Auswahl wurde angepasst.`;
    }
  }
  $: selectionKey = JSON.stringify([
    selected.map((id) => [id, events.find((event) => event.id === id)?.version]),
    days,
    minutes,
  ]);
  $: if (preview.length && selectionKey !== previewKey) {
    preview = [];
    step = 2;
  }
  function choose(ids: string[]) {
    selected = ids;
    selectionNotice = "";
    error = "";
    selectionNotice = "";
    notice = "";
  }
  async function go(next: number) {
    step = next;
    await tick();
    heading?.focus();
  }
  function cancel() {
    expanded = false;
    step = 1;
    selected = [];
    preview = [];
    error = "";
    selectionNotice = "";
  }
  function shifted(value: unknown) {
    const date = new SvelteDate(theaterDateTime(String(value), planning.timezone) + "Z");
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCMinutes(date.getUTCMinutes() + minutes);
    return theaterInstant(date.toISOString().slice(0, 16), planning.timezone);
  }
  async function run(apply = false) {
    busy = true;
    error = "";
    try {
      if (!selected.length || selected.length > 50 || (!days && !minutes))
        throw new Error("Wähle 1 bis 50 Termine und eine Verschiebung aus.");
      const changes = selected.map((id) => {
        const event = events.find((event) => event.id === id);
        if (!event)
          throw new Error(
            "Ein ausgewählter Termin ist nicht mehr verfügbar. Lade den Spielplan neu und wähle die Termine erneut.",
          );
        return {
          id,
          expectedVersion: event.version,
          start: shifted(event.data.start),
          end: shifted(event.data.end),
        };
      });
      const response = await post<{ preview: Preview[]; changed: Preview[] }>(
        "/api/theater/operations",
        { action: apply ? "batch-apply" : "batch-preview", data: { operationId, changes } },
      );
      if (apply) {
        notice = `${countLabel(response.changed.length)} verschoben.`;
        selected = [];
        preview = [];
        step = 1;
        expanded = false;
        operationId = crypto.randomUUID();
        await onChanged();
      } else {
        preview = response.preview;
        previewKey = selectionKey;
        await go(3);
      }
    } catch (exception) {
      error = (exception as Error).message;
      preview = [];
      if (step === 3) await go(2);
    } finally {
      busy = false;
    }
  }
</script>

{#if events.length}
  {#if notice}<p class="batch-success" role="status"><CheckCircle2 size={18} />{notice}</p>{/if}
  <details class="surface task-disclosure batch-planning" bind:open={expanded}>
    <summary
      >Mehrere Termine verschieben<span class="small muted"
        >Mit Konfliktprüfung vor dem Speichern</span
      ></summary
    >
    <div class="disclosure-body">
      <ol class="task-steps" aria-label="Schritte der Terminverschiebung">
        {#each ["Termine wählen", "Verschiebung", "Vorschau"] as label, index}<li
            aria-current={step === index + 1 ? "step" : undefined}
            class:active={step === index + 1}
          >
            <span>{index + 1}</span>{label}
          </li>{/each}
      </ol>
      <ErrorMessage message={error} />
      {#if selectionNotice}<p class="small muted" role="status">{selectionNotice}</p>{/if}
      <h3 bind:this={heading} tabindex="-1">
        {step === 1
          ? "Welche Termine möchtest du verschieben?"
          : step === 2
            ? "Um wie viel sollen die Termine verschoben werden?"
            : "Prüfe die neuen Zeiten"}
      </h3>
      {#if step === 1}
        <div class="form-grid batch-window">
          <label>Von<input type="date" bind:value={from} disabled={busy} /></label><label
            >Bis<input type="date" bind:value={to} disabled={busy} /></label
          >
        </div>
        {#if from && to && from > to}<ErrorMessage
            message="Das Bis-Datum muss am oder nach dem Von-Datum liegen."
          />{/if}
        <SelectionList
          label="Termine"
          {options}
          {selected}
          onChange={choose}
          max={50}
          disabled={busy}
        />
        <p class="small muted">
          {selected.length} von maximal 50 Terminen ausgewählt. Es werden nur geladene, bearbeitbare Termine
          angeboten.
        </p>
        <div class="task-footer">
          <Button onClick={cancel}>Abbrechen</Button><Button
            variant="primary"
            disabled={busy ||
              !selected.length ||
              selected.length > 50 ||
              Boolean(from && to && from > to)}
            onClick={() => void go(2)}>Weiter<ArrowRight size={16} /></Button
          >
        </div>
      {:else if step === 2}
        <p>
          {countLabel(selected.length)}
          {selected.length === 1 ? "wird" : "werden"} um die gewählte Zeit verschoben.
        </p>
        <form on:submit|preventDefault={() => void run()}>
          <div class="form-grid">
            <label
              >Tage verschieben<input
                type="number"
                min="-366"
                max="366"
                bind:value={days}
                required
                disabled={busy}
              /><span class="small muted">Positiv = später, negativ = früher</span></label
            ><label
              >Minuten verschieben<input
                type="number"
                min="-1440"
                max="1440"
                bind:value={minutes}
                required
                disabled={busy}
              /><span class="small muted">Für eine reine Datumsänderung bei 0 belassen</span></label
            >
          </div>
          <details class="batch-explanation">
            <summary>Was wird geprüft?</summary>
            <p>
              Personen, Abwesenheiten, bestätigte Dienstregeln und Räume. Terminserien behalten ihre
              Serienstruktur. Ein Konflikt verhindert die gesamte Änderung.
            </p>
          </details>
          <div class="task-footer">
            <Button disabled={busy} onClick={() => void go(1)}>Zurück</Button><button
              class="button primary"
              disabled={busy || (!days && !minutes)}
              >{busy ? "Zeiten werden geprüft …" : "Vorschau prüfen"}</button
            >
          </div>
        </form>
      {:else}
        <p class="batch-success">
          <CheckCircle2 size={18} />Keine Planungskonflikte gefunden. Noch nicht gespeichert.
        </p>
        <ul class="batch-preview">
          {#each preview as entry (entry.id)}<li>
              <strong
                >{planningEventLabel(
                  events.find((event) => event.id === entry.id) || { data: {} },
                )}</strong
              >
              <div>
                <span
                  ><span class="small muted">Bisher</span>{theaterLabel(
                    entry.before.start,
                    planning.timezone,
                    true,
                  )}</span
                ><ArrowRight size={18} /><span
                  ><span class="small muted">Neu</span>{theaterLabel(
                    entry.after.start,
                    planning.timezone,
                    true,
                  )}</span
                >
              </div>
            </li>{/each}
        </ul>
        <p class="small muted">
          Beim Speichern werden die Zeiten erneut geprüft. Ein bereits veröffentlichter Plan
          benötigt danach eine neue Planversion.
        </p>
        <div class="task-footer">
          <Button disabled={busy} onClick={() => void go(2)}>Zurück</Button><Button
            variant="primary"
            disabled={busy || !preview.length}
            onClick={() => void run(true)}
            >{busy ? "Wird gespeichert …" : `${countLabel(preview.length)} verschieben`}</Button
          >
        </div>
      {/if}
    </div>
  </details>
{/if}

<style>
  .batch-planning {
    margin: 0;
  }
  .task-steps {
    display: flex;
    gap: 24px;
    padding: 0;
    margin: 0 0 24px;
    list-style: none;
    flex-wrap: wrap;
  }
  .task-steps li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;
  }
  .task-steps li > span {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 50%;
  }
  .task-steps li.active {
    color: var(--text);
    font-weight: 600;
  }
  .task-steps li.active > span {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }
  h3 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  .batch-window {
    max-width: 520px;
    margin-bottom: 20px;
  }
  .task-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 20px;
    margin-top: 20px;
    border-top: 1px solid var(--border);
  }
  .batch-explanation {
    margin-top: 20px;
  }
  .batch-explanation summary {
    cursor: pointer;
    min-height: 44px;
    display: list-item;
  }
  .batch-success {
    display: flex;
    gap: 10px;
    align-items: center;
    padding-block: 12px;
  }
  .batch-preview {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 440px;
    overflow-y: auto;
  }
  .batch-preview li {
    display: grid;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
  }
  .batch-preview li > div {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .batch-preview li > div > span {
    display: grid;
    gap: 4px;
  }
  @media (max-width: 760px) {
    .task-steps {
      gap: 8px;
    }
    .task-steps li {
      font-size: 12px;
      gap: 4px;
    }
    .task-steps li > span {
      width: 22px;
      height: 22px;
    }
    .batch-preview li > div {
      gap: 12px;
      font-size: 13px;
    }
    .task-footer .button {
      flex: 1;
    }
  }
</style>
