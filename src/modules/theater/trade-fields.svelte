<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import type { Field } from "./registry";
  import type { Planning } from "./types";
  import { useWorkspace } from "@/components/workspace-context";

  import { tradeChoiceLabel, euroInputToCents, centsToEuroInput } from "@/shared/trade-labels";
  import { theaterDateTime, theaterInstant } from "@/shared/theater-time";
  import { moduleById } from "./registry";
  import SelectionList from "@/components/selection-list.svelte";
  import { primaryTradeFields } from "@/shared/trade-form-presentation";
  export let fields: Field[] = [];
  export let data: Record<string, unknown> = {};
  export let planning: Planning;
  export let productionId = "";
  export let privateData = false;
  export let grouped = true;
  export let update: (key: string, value: unknown) => void;
  const store = useWorkspace();
  $: workspace = $store.workspace;
  $: primary = primaryTradeFields(fields);
  $: additional = fields.filter((field) => !primary.some((core) => core.key === field.key));
  const text = (key: string) => String(data[key] ?? "");
  const choices = (key: string) => (Array.isArray(data[key]) ? (data[key] as string[]) : []);
  const references = (field: Field) =>
    planning.items.filter(
      (i) =>
        (!i.productionId || i.productionId === productionId) &&
        !["workspace", "collaboration"].includes(i.type) &&
        (field.key === "sourceItemId" || !["archived", "cancelled"].includes(i.status)) &&
        (!field.sourceTypes?.length || field.sourceTypes.includes(i.type)) &&
        (privateData || !moduleById(i.moduleId)?.features.find((f) => f.id === i.type)?.private),
    );
</script>

{#if grouped && additional.length}
  <svelte:self
    fields={primary}
    {data}
    {planning}
    {productionId}
    {privateData}
    {update}
    grouped={false}
  />
  <details class="form-disclosure full">
    <summary
      >Weitere Angaben <span class="small muted"
        >{additional.filter((field) => !field.managed).length} zusätzliche Felder</span
      ></summary
    >
    <div class="form-grid">
      <svelte:self
        fields={additional}
        {data}
        {planning}
        {productionId}
        {privateData}
        {update}
        grouped={false}
      />
    </div>
  </details>
{:else}
  {#each fields as field (field.key)}
    {#if field.type === "trades"}<SelectionList
        label={field.label}
        options={references(field).map((item) => ({ id: item.id, label: item.title }))}
        selected={choices(field.key)}
        onChange={(ids) => update(field.key, ids)}
      />
    {:else if field.type === "members"}<SelectionList
        label={field.label}
        options={workspace.members
          .filter((member) => member.status === "active")
          .map((member) => ({ id: member.id, label: member.name }))}
        selected={choices(field.key)}
        onChange={(ids) => update(field.key, ids)}
      />
    {:else}<label class:full={field.type === "textarea" || field.key === "scene"}
        >{field.key === "amountCents" ? field.label.replace("(Cent)", "(€)") : field.label}
        {#if field.managed === "approval"}<span class="small muted"
            >Dieser Status wird durch die Freigabe unter Zusammenarbeit vergeben.</span
          >
        {:else if field.type === "textarea"}<textarea
            value={text(field.key)}
            maxlength="10000"
            on:input={(e) => update(field.key, e.currentTarget.value)}
            required={field.required}></textarea>
        {:else if field.type === "select"}<select
            value={text(field.key)}
            on:change={(e) => update(field.key, e.currentTarget.value)}
            required={field.required}
            ><option value="">Bitte wählen</option
            >{#each field.options || [] as option (option)}<option value={option}
                >{tradeChoiceLabel(option)}</option
              >{/each}</select
          >
        {:else if field.type === "checkbox"}<input
            type="checkbox"
            checked={Boolean(data[field.key])}
            on:change={(e) => update(field.key, e.currentTarget.checked)}
          />
        {:else if ["member", "resource", "record", "department", "budget", "performance", "trade"].includes(field.type)}<select
            value={text(field.key)}
            on:change={(e) => update(field.key, e.currentTarget.value)}
            required={field.required}
            ><option value=""
              >{field.type === "department" ? "Gesamtes Theater" : "Bitte wählen"}</option
            >
            {#if field.type === "trade"}{#each references(field) as item (item.id)}<option
                  value={item.id}>{item.title}</option
                >{/each}
            {:else if field.type === "member"}{#each workspace.members.filter((m) => m.status === "active") as member (member.id)}<option
                  value={member.id}>{member.name}</option
                >{/each}
            {:else if field.type === "resource"}{#each planning.resources as resource (resource.id)}<option
                  value={resource.id}>{resource.name}</option
                >{/each}
            {:else if field.type === "department"}{#each planning.departments as department (department.id)}<option
                  value={department.id}>{department.name}</option
                >{/each}
            {:else if field.type === "budget"}{#each planning.funding.filter((b) => b.productionId === (productionId || null)) as budget (budget.id)}<option
                  value={budget.id}
                  >{budget.title}{budget.costCentre ? " · " + budget.costCentre : ""}</option
                >{/each}
            {:else if field.type === "performance"}{#each planning.performances.filter((p) => (!productionId || p.productionId === productionId) && p.status !== "cancelled") as performance (performance.id)}<option
                  value={performance.id}
                  >{dateLabel(performance.curtainAt, true)} · {String(
                    workspace.records.productions.find((p) => p.id === performance.productionId)
                      ?.data.title || "Vorstellung",
                  )}</option
                >{/each}
            {:else if field.type === "record" && field.source}{#each (field.source === "files" ? [...workspace.records.files, ...planning.tradeFiles] : workspace.records[field.source]).filter((r) => !r.data.productionId || r.data.productionId === productionId) as record (record.id)}<option
                  value={record.id}
                  >{String(record.data.title || record.data.name || record.id)}</option
                >{/each}{/if}
          </select>
        {:else}<input
            type={field.type === "number"
              ? "number"
              : field.type === "datetime"
                ? "datetime-local"
                : field.type === "date"
                  ? "date"
                  : "text"}
            step={field.key === "amountCents" ? "0.01" : "any"}
            value={field.type === "datetime" && text(field.key)
              ? theaterDateTime(text(field.key), planning.timezone)
              : field.key === "amountCents"
                ? centsToEuroInput(data[field.key])
                : text(field.key)}
            maxlength="500"
            on:input={(e) =>
              update(
                field.key,
                field.key === "amountCents"
                  ? euroInputToCents(e.currentTarget.value)
                  : field.type === "number"
                    ? e.currentTarget.value === ""
                      ? undefined
                      : Number(e.currentTarget.value)
                    : field.type === "datetime" && e.currentTarget.value
                      ? theaterInstant(e.currentTarget.value, planning.timezone)
                      : e.currentTarget.value,
              )}
            required={field.required}
          />{/if}</label
      >{/if}
  {/each}
{/if}
