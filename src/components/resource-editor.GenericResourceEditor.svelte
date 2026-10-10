<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { contactsValue, type DomainRecord, type RecordData, type RecordKind, } from "@/shared/contracts";
import { ids, instantDate, localDate, localDateTime, num, value } from "@/shared/client-api";
import { fields, labels, type Field } from "./resource-fields";
import { useWorkspace } from "./workspace-context";
import { Button, ErrorMessage, Modal } from "./ui";
import { ProductionPeopleFields } from "./production-people";
import { isActiveStaff } from "@/shared/client-members";
import { TimeBookingEditor } from "@/modules/time-tracking/components/time-booking-editor";
import { EventEditor } from "@/modules/calendar/components/event-editor";
import { PersonEditor } from "@/modules/people/components";
import { DocumentEditor } from "@/modules/documentation/components/document-editor";
import { CastingEditor } from "@/modules/productions/components/casting-editor";
import { RepeatableList } from "./repeatable-list";
import { categoriesFor } from "@/shared/domain-categories";
import { CastingImpact } from "./casting-impact";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { actorSeasons, initialPeriod, seasonKey, teamTaskSeason } from "@/shared/period-filter";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { initialData, type ResourceEditorProps, ResourceEditor } from "./resource-editor";
const effects=createEffects();
type ViewProps = {
    kind: RecordKind;
    record?: DomainRecord;
    defaults?: RecordData;
    onClose: () => void;
    lockedProductionId?: string;
    onSaved?: (record: DomainRecord) => void;
};
export let kind: ViewProps["kind"] = undefined as any;
export let record: ViewProps["record"] = undefined as any;
export let defaults: NonNullable<ViewProps["defaults"]> = {};
export let onClose: ViewProps["onClose"] = undefined as any;
export let lockedProductionId: ViewProps["lockedProductionId"] = undefined as any;
export let onSaved: ViewProps["onSaved"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, busy } = $workspaceStore;
$: ({ workspace, save, busy } = $workspaceStore);
let taskSeason = (taskData: RecordData, createdAt?: string) => {
    if (value(taskData, "season"))
        return value(taskData, "season");
    if (taskData.productionId)
        return initialPeriod(workspace.records.productions, value(taskData, "productionId")).season;
    return (teamTaskSeason(taskData, createdAt || localDate()) ||
        initialPeriod(workspace.records.productions).season);
};
let data: RecordData = initialState<RecordData>((() => {
    const merged = { ...defaults, ...record?.data };
    const parent = workspace.records.tasks.find((task) => task.id === merged.parentId);
    return {
        ...initialData(kind),
        ...(kind === "tasks"
            ? {
                assigneeIds: workspace.user.role === "superadmin" ? [] : [workspace.user.id],
                season: parent
                    ? taskSeason(parent.data, parent.createdAt)
                    : taskSeason({
                        ...merged,
                        ...(lockedProductionId !== undefined
                            ? { productionId: lockedProductionId }
                            : {}),
                    }, record?.createdAt),
            }
            : {}),
        ...(kind === "actors" ? { ensembleSeasons: actorSeasons(merged) } : {}),
        ...(kind === "materials"
            ? { category: categoriesFor("materials", workspace.records.categories)[0]?.key || "" }
            : {}),
        ...merged,
    };
})());
const setData = (next: RecordData | ((current: RecordData) => RecordData)) => { data = typeof next === "function" ? (next as (current: RecordData) => RecordData)(data) : next; };
let productionContext = lockedProductionId ??
    (record && ["tasks", "sprints", "characters", "casting", "looks", "handovers"].includes(kind)
        ? value(record.data, "productionId")
        : undefined);
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let numberDrafts: Record<string, string> = initialState<Record<string, string>>({});
const setNumberDrafts = (next: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => { numberDrafts = typeof next === "function" ? (next as (current: Record<string, string>) => Record<string, string>)(numberDrafts) : next; };
let change = (key: string, next: unknown) => setData((current) => {
    const parent = kind === "tasks" && key === "parentId"
        ? workspace.records.tasks.find((task) => task.id === next)
        : undefined;
    return {
        ...current,
        [key]: next,
        ...(parent ? { season: taskSeason(parent.data, parent.createdAt) } : {}),
        ...(kind === "tasks" && key === "productionId"
            ? { season: initialPeriod(workspace.records.productions, String(next || "")).season }
            : {}),
    };
});
let configuredFields = fields[kind] || [];
let selectedTemplate = workspace.records.templates.find((template) => template.id === data.templateId);
let customFields = selectedTemplate
    ? ids(selectedTemplate.data, "fields").filter((name) => ![
        "vorbereitung",
        "material",
        "materialien",
        "arbeitsablauf",
        "umbau",
        "wechsel",
    ].includes(name.toLowerCase().trim()))
    : [];
let submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
        const result: RecordData = {
            ...data,
            ...(productionContext !== undefined ? { productionId: productionContext } : {}),
        };
        for (const field of configuredFields.filter((field) => field.type === "number")) {
            const factor = kind === "time" && ["durationSeconds", "pauseSeconds"].includes(field.key) ? 60 : 1;
            const raw = numberDrafts[field.key] ??
                numberDraft(data[field.key] === undefined ? 0 : Number(data[field.key]) / factor);
            result[field.key] =
                parseNumberDraft(raw, {
                    label: field.label,
                    required: field.required,
                    fallback: 0,
                    min: field.min,
                })! * factor;
        }
        if (kind === "tasks" && productionContext === "")
            result.sprintId = "";
        if (kind === "tasks" && value(result, "season").trim()) {
            const normalized = seasonKey(value(result, "season"));
            if (!normalized)
                throw new Error("Bitte gib die Spielzeit als Jahr/Jahr ein, z. B. 2026/2027.");
            result.season = normalized;
        }
        if (kind === "actors") {
            const seasons = ids(result, "ensembleSeasons")
                .map((season) => season.trim())
                .filter(Boolean);
            const normalized = seasons.map((season) => seasonKey(season));
            if (normalized.some((season) => !season))
                throw new Error("Bitte gib jede Ensemble-Spielzeit als Jahr/Jahr ein, z. B. 2026/2027.");
            result.ensembleSeasons = [...new Set(normalized)];
        }
        if (Array.isArray(result.checklist))
            result.checklist = (result.checklist as {
                text: string;
                done: boolean;
            }[]).filter((item) => item.text.trim());
        for (const key of ["fields", "exceptions"])
            if (Array.isArray(result[key]))
                result[key] = (result[key] as string[]).map((item) => item.trim()).filter(Boolean);
        if (kind === "time") {
            if (result.start && result.end) {
                const diff = (instantDate(String(result.end)).getTime() -
                    instantDate(String(result.start)).getTime()) /
                    1000 -
                    Number(result.pauseSeconds || 0);
                if (diff <= 0)
                    throw new Error("Das Ende muss nach dem Beginn liegen und die Pause kleiner als die Gesamtdauer sein.");
                result.durationSeconds = diff;
            }
        }
        if (kind === "looks") {
            const template = workspace.records.templates.find((x) => x.id === result.templateId);
            result.templateVersion = template ? num(template.data, "version") : 1;
            result.imageIds = result.imageIds || [];
        }
        for (const field of configuredFields)
            if (field.type === "datetime-local" && result[field.key])
                result[field.key] = instantDate(String(result[field.key])).toISOString();
        const saved = await save(kind, result, record);
        onClose();
        onSaved?.(saved);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
};
const render = true;


$: productionContext = lockedProductionId ??
    (record && ["tasks", "sprints", "characters", "casting", "looks", "handovers"].includes(kind)
        ? value(record.data, "productionId")
        : undefined);

$: configuredFields = fields[kind] || [];
$: selectedTemplate = workspace.records.templates.find((template) => template.id === data.templateId);
$: customFields = selectedTemplate
    ? ids(selectedTemplate.data, "fields").filter((name) => ![
        "vorbereitung",
        "material",
        "materialien",
        "arbeitsablauf",
        "umbau",
        "wechsel",
    ].includes(name.toLowerCase().trim()))
    : [];


</script>
{#if true}
{#snippet render_render(field: Field)}{#if field.key === "productionId" && productionContext !== undefined}<div class="locked-production-field">
          <span class="small muted">Arbeitsraum</span>
          <strong>
            {productionContext
    ? value(workspace.records.productions.find((row) => row.id === productionContext)?.data ||
        {}, "title")
    : "Teamboard · ohne Produktion"}
          </strong>
        </div>{:else}{#if field.key === "sprintId" && productionContext === ""}{:else}{#if kind === "productions" && field.key === "memberIds"}{:else}{@const options = (field.key === "category" && (kind === "materials" || kind === "time")
    ? categoriesFor(kind, workspace.records.categories).map((option) => [option.key, option.name] as [
        string,
        string
    ])
    : field.options) ||
    (field.source === "members"
        ? workspace.members
            .filter((x) => isActiveStaff(x) || ids(data, field.key).includes(x.id))
            .map((x) => [
            x.id,
            `${x.name}${isActiveStaff(x) ? "" : " · historische Zuordnung (entfernen)"}`,
        ] as [
            string,
            string
        ])
        : field.source
            ? workspace.records[field.source]
                .filter((x) => x.id !== record?.id &&
                (!["characters", "sprints", "tasks"].includes(field.source!) ||
                    value(x.data, "productionId") === value(data, "productionId")))
                .map((x) => [x.id, value(x.data, "title") || value(x.data, "name")] as [
                string,
                string
            ])
            : [])}{#if field.type === "lines" || field.type === "checklist"}{#snippet local_list_0()}{#key field.key}<RepeatableList label={field.label.replace(/\s*\(.*\)/, "")} checklist={field.type === "checklist"} items={field.type === "checklist"
    ? Array.isArray(data[field.key])
        ? (data[field.key] as {
            text: string;
            done: boolean;
        }[])
        : []
    : ids(data, field.key).map((text) => ({ text }))} onChange={(items) => change(field.key, field.type === "checklist" ? items : items.map((item) => item.text))}></RepeatableList>{/key}{/snippet}{#if field.key === "ensembleSeasons"}<div class="field-wide">
          {@render local_list_0()}
          <p class="small muted">
            Eine Spielzeit pro Eintrag, z. B. 2026/2027. Ohne Einträge erscheint die Person nur
            unter „Alle Spielzeiten“.
          </p>
        </div>{:else}{@render local_list_0()}{/if}{:else}{#if field.type === "multi"}<fieldset class="form-multi">
          <legend>{field.label}</legend>
          {#if !options.length}<p class="muted small">Noch keine Einträge verfügbar.</p>{/if}
          {#each options as [id, label] (id)}<label class="check-label">
              <input type="checkbox" checked={ids(data, field.key).includes(id)} on:input={(event) => change(field.key, event.currentTarget.checked
    ? [...ids(data, field.key), id]
    : ids(data, field.key).filter((x) => x !== id))} />
              {label}
            </label>{/each}
        </fieldset>{:else}{#if field.type === "checkbox"}<label class="check-label">
          <input type="checkbox" checked={!!data[field.key]} on:input={(event) => change(field.key, event.currentTarget.checked)} />
          {field.label}
        </label>{:else}{@const val = field.type === "number"
    ? (numberDrafts[field.key] ??
        numberDraft(Number(data[field.key] || 0) /
            (kind === "time" && ["durationSeconds", "pauseSeconds"].includes(field.key) ? 60 : 1)))
    : field.type === "datetime-local" && data[field.key]
        ? localDateTime(String(data[field.key]))
        : value(data, field.key)}<label class={field.type === "textarea" ? "field-wide" : ""}>
        {field.label}
        {#if field.required}<span class="required"> *</span>{/if}
        {#if field.type === "select"}<select required={field.required} value={String(val)} on:change={(event) => change(field.key, event.currentTarget.value)}>
            {#if !field.options}<option value="">Bitte auswählen</option>{/if}
            {#each options as [id, label] (id)}<option value={id}>
                {label}
              </option>{/each}
          </select>{:else}{#if field.type === "textarea"}<textarea rows={4} required={field.required} placeholder={field.placeholder} value={String(val)} on:input={(event) => change(field.key, event.currentTarget.value)}></textarea>{:else}<input type={field.type || "text"} required={field.required} min={field.min} step={field.type === "number" ? "any" : undefined} placeholder={field.placeholder} value={val} on:input={(event) => field.type === "number"
    ? setNumberDrafts((current) => ({ ...current, [field.key]: event.currentTarget.value }))
    : change(field.key, event.currentTarget.value)} />{/if}{/if}
      </label>{/if}{/if}{/if}{/if}{/if}{/if}{/snippet}
<Modal title={`${labels[kind][1]} ${record ? "bearbeiten" : "anlegen"}`} onClose={onClose} wide>
      <form on:submit={submit}>
        <div class="form-grid">
          {#each configuredFields as item}{@render render_render(item)}{/each}
          {#if kind === "productions"}<ProductionPeopleFields contacts={contactsValue(data.contacts)} memberIds={ids(data, "memberIds")} onChange={(contacts, memberIds) => setData((current) => ({ ...current, contacts, memberIds }))}></ProductionPeopleFields>{/if}
          {#if kind === "casting" && record}<CastingImpact previous={record} next={data}></CastingImpact>{/if}
          {#if kind === "looks"}{#each customFields as name (name)}<label class="field-wide">
                {name}
                <textarea rows={3} value={typeof data.templateFields === "object" && data.templateFields
    ? String((data.templateFields as Record<string, string>)[name] || "")
    : ""} on:input={(event) => change("templateFields", {
    ...(typeof data.templateFields === "object" ? data.templateFields : {}),
    [name]: event.currentTarget.value,
})}></textarea>
              </label>{/each}{/if}
        </div>
        {#if !record && ["characters", "casting", "looks", "actors"].includes(kind)}<p class="small muted">
            Nach dem Speichern öffnet sich die Galerie. Dort kannst du mehrere Bilder hochladen,
            auch direkt vom Smartphone.
          </p>{/if}
        {#if kind === "time"}<p class="small muted">
            Mit Beginn und Ende wird die Arbeitsdauer abzüglich Pause automatisch berechnet. Ohne
            Zeitraum kannst du direkt Minuten buchen.
          </p>{/if}
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </footer>
      </form>
    </Modal>

{/if}
