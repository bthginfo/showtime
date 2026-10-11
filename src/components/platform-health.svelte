<script lang="ts">
  import { onMount } from "svelte";
  import { api, dateLabel } from "@/shared/client-api";
  import { ErrorMessage, Button, Badge } from "./ui";
  import { ChevronDown } from "@lucide/svelte";
  export let theaters: { id: string; name: string }[] = [];
  let result: {
      generatedAt: string;
      entries: {
        organizationId: string;
        health: {
          members: number;
          filesBytes: number;
          files: number;
          records: number;
          failedEvents: number;
          pendingEvents: number;
          oldestPendingAt: string | null;
          lastBackup: string | null;
          lastRestoreTest: string | null;
          quotas: { members?: number; filesBytes?: number };
        };
      }[];
    } | null = null,
    error = "",
    search = "",
    busy = false;
  $: visible = (result?.entries || []).filter((entry) =>
    theaters.some(
      (theater) =>
        theater.id === entry.organizationId &&
        theater.name.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de")),
    ),
  );
  const needsAttention = (entry: NonNullable<typeof result>["entries"][number]) =>
    entry.health.failedEvents > 0 ||
    (entry.health.oldestPendingAt &&
      Date.parse(entry.health.oldestPendingAt) < Date.now() - 1800000);
  $: attention = (result?.entries || []).filter(needsAttention).length;
  async function load() {
    busy = true;
    error = "";
    try {
      result = await api("/api/platform/health");
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  onMount(() => void load());
</script>

<details class="surface health-panel">
  <summary
    ><strong>Betriebszustand</strong><span class="small muted"
      >{result
        ? `${result.entries.length} Theater · ${attention} mit Klärungsbedarf`
        : "Verbrauch und Wiederherstellung"}</span
    ><ChevronDown size={18} /></summary
  >
  <div class="health-content" aria-busy={busy}>
    <div class="section-heading">
      <h2>Verbrauch und Betriebsnachweise</h2>
      <Button disabled={busy} onClick={() => void load()}>Aktualisieren</Button>
    </div>
    <p class="muted">
      Tenantweise Mengen und Betriebsnachweise. Private Dokumente, Chats und Personaldaten werden
      hier nicht angezeigt.
    </p>
    <ErrorMessage message={error} />{#if result}<p class="small">
        Datenbank erreichbar · Stand {dateLabel(result.generatedAt, true)}
      </p>
      <label>Theater in den Betriebsdaten suchen<input type="search" bind:value={search} /></label>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable table needs a keyboard tab stop.) -->
      <div
        class="health-table"
        tabindex="0"
        role="region"
        aria-label="Verbrauch und Betriebsnachweise der Theater"
      >
        <table>
          <thead
            ><tr><th>Theater</th><th>Verbrauch</th><th>Ereignisse</th><th>Wiederherstellung</th></tr
            ></thead
          ><tbody
            >{#each visible as entry (entry.organizationId)}<tr
                ><th>{theaters.find((t) => t.id === entry.organizationId)?.name}</th><td
                  >{entry.health.members} / {entry.health.quotas?.members || "–"} Mitglieder<br />{(
                    entry.health.filesBytes / 1000000
                  ).toFixed(1)} / {(Number(entry.health.quotas?.filesBytes || 0) / 1000000).toFixed(
                    0,
                  )} MB · {entry.health.files} Dateien<br />{entry.health.records} Einträge</td
                ><td
                  ><Badge
                    >{needsAttention(entry)
                      ? "Klärung nötig"
                      : entry.health.pendingEvents
                        ? "In Verarbeitung"
                        : "Verarbeitet"}</Badge
                  >
                  <p class="small">
                    {entry.health.failedEvents} fehlgeschlagen · {entry.health.pendingEvents} ausstehend
                  </p>
                  {#if entry.health.oldestPendingAt}<p class="small">
                      Ältestes: {dateLabel(entry.health.oldestPendingAt, true)}
                    </p>{/if}</td
                ><td
                  >Backup: {entry.health.lastBackup
                    ? dateLabel(entry.health.lastBackup, true)
                    : "Kein bestätigter Nachweis"}<br />Test: {entry.health.lastRestoreTest
                    ? dateLabel(entry.health.lastRestoreTest, true)
                    : "Kein bestätigter Nachweis"}</td
                ></tr
              >{/each}</tbody
          >
        </table>
      </div>{:else if busy}<p role="status">Betriebsdaten werden geladen …</p>{/if}
  </div>
</details>

<style>
  .health-table {
    overflow: auto;
    max-height: 440px;
  }
  summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    min-height: 44px;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary :global(svg) {
    margin-left: auto;
    transition: transform 160ms ease;
  }
  details[open] summary :global(svg) {
    transform: rotate(180deg);
  }
  .health-content {
    margin-top: 24px;
  }
  @media (prefers-reduced-motion: reduce) {
    summary :global(svg) {
      transition: none;
    }
  }
  th,
  td {
    vertical-align: top;
    white-space: normal;
    min-width: 170px;
  }
  p {
    max-width: 80ch;
  }
</style>
