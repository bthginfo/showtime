<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import type { Field } from "./resource-fields";
  import type { DomainRecord } from "@/shared/contracts";
  import { useWorkspace } from "./workspace-context";
  import { ids, value, num, hours } from "@/shared/client-api";
  import { recordTitle } from "./resource-view";
  import { categoryName } from "@/shared/domain-categories";
  import { RecordLink } from "./record-link";
  import { LinkedText } from "./linked-text";
  import relationStyles from "./record-links.module.css";
  export let field: Field;
  export let record: DomainRecord;
  export let onNavigate: (() => void) | undefined = undefined;
  const store = useWorkspace();
  $: workspace = $store.workspace;
  $: selected =
    field.type === "multi" ? ids(record.data, field.key) : [value(record.data, field.key)];
  function formatValue(target: typeof field, row: typeof record, view: typeof workspace) {
    if (target.key === "category" && (row.kind === "time" || row.kind === "materials"))
      return categoryName(row.kind, value(row.data, "category"), view.records.categories);
    if (target.type === "lines") return ids(row.data, target.key).join(" · ");
    if (target.type === "checkbox") return row.data[target.key] ? "Ja" : "Nein";
    if (target.type === "date" || target.type === "datetime-local")
      return dateLabel(String(row.data[target.key]), target.type === "datetime-local");
    if (target.key === "pauseSeconds") return Math.round(num(row.data, target.key) / 60) + " min";
    if (target.key === "durationSeconds") return hours(num(row.data, target.key)) + " h";
    return (
      target.options?.find((x) => x[0] === row.data[target.key])?.[1] ??
      String(row.data[target.key] ?? "")
    );
  }
  $: display = formatValue(field, record, workspace);
</script>

{#if field.source}<span class={relationStyles.values}
    >{#each selected as id (id)}
      {#if field.source === "members"}<span
          >{workspace.members.find((m) => m.id === id)?.name || "Nicht mehr verfügbar"}</span
        >
      {:else}{@const linked = workspace.records[field.source].find(
          (row) => row.id === id,
        )}{#if linked}<RecordLink record={linked} from={record} {onNavigate}
            >{recordTitle(linked, workspace)}</RecordLink
          >{:else}<span>Nicht mehr verfügbar</span>{/if}{/if}
    {/each}</span
  >{:else}<LinkedText text={display}></LinkedText>{/if}
