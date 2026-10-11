<script lang="ts">
  import type { DomainRecord } from "@/shared/contracts";
  import { LinkedText } from "@/components/linked-text";
  import { documentSections, pieceDuration, sectionName } from "@/shared/document-sections";
  import { useWorkspace } from "@/components/workspace-context";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  const effects = createEffects();
  type ViewProps = {
    record: DomainRecord;
  };
  export let record: ViewProps["record"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let kind: "looks" | "handovers" = record.kind === "handovers" ? "handovers" : "looks";
  let sections = documentSections(record.data, kind);
  let duration = pieceDuration(record.data, workspace.records.productions);

  $: kind = record.kind === "handovers" ? "handovers" : "looks";
  $: sections = documentSections(record.data, kind).filter(
    (section) =>
      record.data.documentMode !== "general" ||
      section.entries.some((entry) => entry.text.trim() || entry.label?.trim()),
  );
  $: duration = pieceDuration(record.data, workspace.records.productions);
</script>

<div class="document-content">
  {#if record.kind === "looks" && record.data.documentMode !== "general" && !!duration}<p
      class="document-duration"
    >
      Stückdauer: <strong>{duration} Minuten</strong>
    </p>{/if}
  {#each sections as section (section.key)}<section class="document-read-section">
      <h3>{sectionName(section.key, kind, workspace.records.categories)}</h3>
      {#if section.entries.length}{#each section.entries as entry (entry.id)}<div>
            {#if entry.label}<h4>{entry.label}</h4>{/if}
            <p>
              <LinkedText text={entry.text || "Noch kein Text eingetragen."}></LinkedText>
            </p>
          </div>{/each}{:else}<p class="small muted">Noch kein Text eingetragen.</p>{/if}
    </section>{/each}
  {#if !!(record.data.scene || record.data.durationMinutes || record.data.legacyProductionId)}<details
      class="document-legacy"
    >
      <summary>Historische Angaben</summary>
      {#if !!record.data.scene}<p>Frühere Szene / Akt: {String(record.data.scene)}</p>{/if}
      {#if !!record.data.durationMinutes}<p>
          Früherer Zeitbedarf: {String(record.data.durationMinutes)} Minuten.
        </p>{/if}
      {#if !!record.data.legacyProductionId}<p>
          Frühere Produktion:{" "}
          {String(
            workspace.records.productions.find((row) => row.id === record.data.legacyProductionId)
              ?.data.title || "Archivierte Produktionszuordnung",
          )}
        </p>{/if}
    </details>{/if}
</div>
