<script lang="ts">
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission } from "@/platform/access";
  import { post } from "@/shared/client-api";
  import { Button, ErrorMessage, Badge } from "@/components/ui";
  import type { Planning } from "./types";
  import { theaterDateTime, theaterInstant, theaterLabel } from "@/shared/theater-time";
  import { SvelteDate } from "svelte/reactivity";
  export let planning: Planning;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  const store = useWorkspace();
  let selected: string[] = [],
    days = 1,
    minutes = 0,
    busy = false,
    error = "",
    notice = "",
    operationId = crypto.randomUUID(),
    preview: {
      id: string;
      before: { start: string; end: string };
      after: { start: string; end: string };
    }[] = [];
  $: events = $store.workspace.records.events.filter(
    (e) =>
      !e.data.cancelled &&
      (!productionId || e.data.productionId === productionId) &&
      hasPermission(
        { id: $store.workspace.user.id, grants: $store.workspace.user.grants || [] },
        "schedule.manage",
        { departmentId: e.departmentId, productionId: String(e.data.productionId || "") },
      ),
  );
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
  function shifted(value: unknown) {
    const local = theaterDateTime(String(value), planning.timezone);
    const date = new SvelteDate(local + "Z");
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCMinutes(date.getUTCMinutes() + minutes);
    return theaterInstant(date.toISOString().slice(0, 16), planning.timezone);
  }
  function changes() {
    return selected.map((id) => {
      const e = events.find((e) => e.id === id)!;
      return {
        id,
        expectedVersion: e.version,
        start: shifted(e.data.start),
        end: shifted(e.data.end),
      };
    });
  }
  function reset() {
    preview = [];
    operationId = crypto.randomUUID();
    notice = "";
  }
  async function run(apply = false) {
    busy = true;
    error = "";
    try {
      const response = await post<{ preview: typeof preview; changed: typeof preview }>(
        "/api/theater/operations",
        {
          action: apply ? "batch-apply" : "batch-preview",
          data: { operationId, changes: changes() },
        },
      );
      if (apply) {
        notice =
          response.changed.length +
          " Termine gemeinsam geändert. Verknüpfte Vorstellungen und Fachstände wurden aktualisiert.";
        selected = [];
        preview = [];
        await onChanged();
      } else preview = response.preview;
    } catch (e) {
      error = (e as Error).message;
      preview = [];
    } finally {
      busy = false;
    }
  }
</script>

{#if events.length}<section class="surface">
    <h2>Sammelplanung & Szenarioprüfung</h2>
    <p>
      Verschiebe bis zu 50 geladene Termine und Serien gemeinsam. Serienende und ausgelassene Tage
      werden entsprechend mitverschoben. Die Vorschau prüft Personen, Abwesenheiten, bestätigte
      Regelprofile und Ressourcen ohne Speicherung. Beim Übernehmen wird der gesamte Satz erneut
      geprüft; ein Konflikt verhindert alle Änderungen.
    </p>
    <ErrorMessage message={error} />{#if notice}<p role="status">{notice}</p>{/if}
    <form class="form-grid" on:submit|preventDefault={() => void run()}>
      <label
        >Verschiebung (Kalendertage)<input
          type="number"
          min="-366"
          max="366"
          bind:value={days}
          on:input={reset}
          required
        /></label
      ><label
        >Zusätzlich (Minuten)<input
          type="number"
          min="-1440"
          max="1440"
          bind:value={minutes}
          on:input={reset}
          required
        /></label
      >
      <fieldset class="form-multi full">
        <legend>Termine der Variante · Ortszeit {planning.timezone}</legend
        >{#each events as event (event.id)}<label class="check-label"
            ><input
              type="checkbox"
              bind:group={selected}
              value={event.id}
              on:change={reset}
            />{String(event.data.title)} · {theaterDateTime(
              String(event.data.start),
              planning.timezone,
            ).replace("T", " ")}</label
          >{/each}
      </fieldset>
      <button class="button" disabled={busy || !selected.length || selected.length > 50}
        >Variante auf Konflikte prüfen</button
      >
    </form>
    {#if preview.length}<div class="table-wrap">
        <table>
          <thead><tr><th>Termin</th><th>Bisher</th><th>Variante</th></tr></thead><tbody
            >{#each preview as entry (entry.id)}<tr
                ><td>{String(events.find((e) => e.id === entry.id)?.data.title || "Termin")}</td><td
                  >{dateLabel(entry.before.start, true)}</td
                ><td>{dateLabel(entry.after.start, true)}</td></tr
              >{/each}</tbody
          >
        </table>
      </div>
      <p>
        <Badge>Konfliktprüfung bestanden</Badge> Noch nicht gespeichert. Eine vorhandene Planfreigabe
        braucht anschließend eine neue Planversion.
      </p>
      <Button variant="primary" disabled={busy} onClick={() => void run(true)}
        >Diese Variante verbindlich übernehmen</Button
      >{/if}
  </section>{/if}
