<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { LinkedText } from "@/components/linked-text";
import { AlertTriangle, Check, Copy, MoreHorizontal, Download, Pencil, Plus, Save, Settings2, Trash2, Undo2, } from "@lucide/svelte";
import { Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { ApiFailure, value } from "@/shared/client-api";
import { contactsValue, type DomainRecord } from "@/shared/contracts";
import { isActiveStaff } from "@/shared/client-members";
import { maskPlanSchema } from "../schema";
import { cloneMaskPlan, maskPlanBlockLabel, maskPlanOverlaps, maskPlanValue, newMaskPlan, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane, } from "../model";
import { BlockEditor, LaneEditor, PlanOptions } from "./plan-editors";
import { Timetable } from "./timetable";
import { SavedTimetable } from "./saved-timetable";
import styles from "./mask-plans.module.css";
import { useViewState } from "@/shared/view-state";
import { navigateWorkspace } from "@/shared/client-navigation";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type Draft, type Editor, updateLocation } from "./mask-plans-module";
const effects=createEffects();
type ViewProps = {
    production: DomainRecord;
};
export let production: ViewProps["production"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, remove, refresh, busy, online, notify } = $workspaceStore;
$: ({ workspace, save, remove, refresh, busy, online, notify } = $workspaceStore);
let plans = workspace.records.maskPlans.filter((record) => record.data.productionId === production.id);
const selectedIdStore = useViewState<any>(workspace.user.id, `mask-plans:${production.id}`, "selected", () => {
    const queryId = typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("record");
    return plans.find((record) => record.id === queryId)?.id || plans[0]?.id || "";
});
let selectedId: any = $selectedIdStore; $: selectedId = $selectedIdStore;
const setSelectedId = selectedIdStore.set;
let draft: Draft | null = initialState<Draft | null>(null);
const setDraft = (next: Draft | null | ((current: Draft | null) => Draft | null)) => { draft = typeof next === "function" ? (next as (current: Draft | null) => Draft | null)(draft) : next; };
let editor: Editor = initialState<Editor>(null);
const setEditor = (next: Editor | ((current: Editor) => Editor)) => { editor = typeof next === "function" ? (next as (current: Editor) => Editor)(editor) : next; };
let editing: boolean = false;
const setEditing = (next: typeof editing | ((current: typeof editing) => typeof editing)) => { editing = typeof next === "function" ? (next as (current: typeof editing) => typeof editing)(editing) : next; };
const performanceTimeStore = useViewState<any>(workspace.user.id, `mask-plans:${production.id}`, "performanceTime", "");
let performanceTime: any = $performanceTimeStore; $: performanceTime = $performanceTimeStore;
const setPerformanceTime = performanceTimeStore.set;
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let conflict: boolean = false;
const setConflict = (next: typeof conflict | ((current: typeof conflict) => typeof conflict)) => { conflict = typeof next === "function" ? (next as (current: typeof conflict) => typeof conflict)(conflict) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
let pending: boolean = false;
const setPending = (next: typeof pending | ((current: typeof pending) => typeof pending)) => { pending = typeof next === "function" ? (next as (current: typeof pending) => typeof pending)(pending) : next; };
let dragSnapshot = {current: null as Draft | null | null};
let selected = plans.find((record) => record.id === selectedId) || (!draft ? plans[0] : undefined);
let dirty = !!draft &&
    (!draft.base || JSON.stringify(draft.data) !== JSON.stringify(maskPlanValue(draft.base.data)));
let plan = dirty ? draft!.data : selected ? maskPlanValue(selected.data) : null;
let compact = !!plan && !editing && !dirty;
let remoteChanged = dirty &&
    !!draft?.base &&
    (selected?.id !== draft.base.id || selected.version !== draft.base.version);
let latest = {current: { dirty, selectedId: selected?.id || selectedId, plans }};
$: effects.run(0, () => {
    latest.current = {
        dirty: dirty || editor !== null,
        selectedId: selected?.id || selectedId,
        plans,
    };
}, undefined);
$: effects.run(1, () => {
    const changed = () => {
        const url = new URL(location.href);
        if (url.searchParams.get("productionId") !== production.id ||
            url.searchParams.get("tab") !== "mask-plan")
            return;
        const id = url.searchParams.get("record") || "";
        const current = latest.current;
        if (!id || id === current.selectedId || !current.plans.some((record: DomainRecord) => record.id === id))
            return;
        if (current.dirty &&
            !confirm("Den anderen Maskenplan öffnen und deine ungespeicherten Änderungen verwerfen?")) {
            updateLocation(current.selectedId);
            return;
        }
        latest.current = { ...current, selectedId: id, dirty: false };
        setSelectedId(id);
        setDraft(null);
        setEditing(false);
        setConflict(false);
        setError("");
        setEditor(null);
    };
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
}, [production.id, setSelectedId]);
$: effects.run(2, () => {
    if (!dirty && !editor)
        return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
}, [dirty, editor]);
let guard = () => !dirty || confirm("Deine ungespeicherten Änderungen verwerfen?");
let reset = () => {
    setDraft(null);
    setEditing(false);
    setConflict(false);
    setError("");
};
let changePlan = (id: string) => {
    if (id === selected?.id || !guard())
        return;
    latest.current = { ...latest.current, selectedId: id, dirty: false };
    setSelectedId(id);
    reset();
    setEditor(null);
    updateLocation(id, true);
};
let change = (data: MaskPlanData, base?: DomainRecord) => {
    setDraft({ data, base: dirty ? draft?.base : base || selected });
    setError("");
};
let openEditor = (next: Exclude<Editor, null>, origin?: Draft) => {
    if (!(next.type === "options" && next.creating))
        setEditing(true);
    setEditor({
        ...next,
        base: origin ? origin.base : dirty ? draft?.base : selected,
        snapshot: origin?.data || plan || undefined,
    });
};
let beginNew = () => {
    if (!guard())
        return;
    openEditor({ type: "options", creating: true, plan: newMaskPlan(production.id) });
};
let addLane = () => {
    if (!plan)
        return;
    const contacts = plan.lanes.length
        ? []
        : contactsValue(production.data.contacts).filter((contact) => contact.type === "makeup");
    const memberIds = [
        ...new Set(contacts
            .map((contact) => contact.memberId)
            .filter((id) => workspace.members.some((member) => member.id === id && isActiveStaff(member)))),
    ];
    const staffNames = [
        ...new Set(contacts
            .filter((contact) => !memberIds.includes(contact.memberId))
            .map((contact) => value(workspace.records.people.find((person) => person.id === contact.personId)?.data ||
            {}, "name") || contact.name)
            .filter(Boolean)),
    ];
    openEditor({
        type: "lane",
        creating: true,
        lane: { id: crypto.randomUUID(), label: "", memberIds, staffNames },
    });
};
let addBlock = (laneId = plan?.lanes[0]?.id || "", startMinutes = -30) => {
    if (!plan || !laneId || plan.blocks.length >= 250)
        return;
    openEditor({
        type: "block",
        creating: true,
        block: {
            id: crypto.randomUUID(),
            laneId,
            startMinutes,
            durationMinutes: Math.min(15, -startMinutes),
            actorIds: [],
            actorNames: [],
            title: "",
            notes: "",
            color: "",
        },
    }, dragSnapshot.current || undefined);
};
let moveBlock = (id: string, laneId: string, startMinutes: number) => {
    const origin = dragSnapshot.current || (plan ? { data: plan, base: dirty ? draft?.base : selected } : null);
    if (!origin)
        return;
    const original = origin.data.blocks.find((block) => block.id === id);
    if (!original || (original.laneId === laneId && original.startMinutes === startMinutes))
        return;
    setDraft({
        data: {
            ...origin.data,
            blocks: origin.data.blocks.map((block) => block.id === id ? { ...block, laneId, startMinutes } : block),
        },
        base: origin.base,
    });
    setError("");
};
let castings = workspace.records.casting.filter((record) => record.data.productionId === production.id);
let castActorIds = new Set(castings.map((record) => value(record.data, "actorId")));
let castActors = workspace.records.actors
    .filter((record) => castActorIds.has(record.id))
    .sort((left, right) => value(left.data, "name").localeCompare(value(right.data, "name"), "de"));
let castNames = [
    ...new Set(castings.map((record) => value(record.data, "actorName")).filter(Boolean)),
];
let overlaps = plan ? maskPlanOverlaps(plan) : [];
let conflictVisible = conflict || remoteChanged;
let savePlan = async () => {
    if (!plan || !dirty || pending)
        return;
    setError("");
    setPending(true);
    try {
        const parsed = maskPlanSchema.safeParse(plan);
        if (!parsed.success)
            throw new Error(parsed.error.issues[0]?.message || "Bitte prüfe den Maskenplan.");
        const saved = await save("maskPlans", parsed.data, draft?.base);
        latest.current = { ...latest.current, selectedId: saved.id, dirty: false };
        setSelectedId(saved.id);
        reset();
        updateLocation(saved.id);
        notify("Maskenplan gespeichert.");
    }
    catch (exception) {
        if (exception instanceof ApiFailure && exception.status === 409)
            setConflict(true);
        else
            setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen.");
    }
    finally {
        setPending(false);
    }
};
let reload = async () => {
    if (!guard())
        return;
    setPending(true);
    try {
        await refresh();
        reset();
    }
    finally {
        setPending(false);
    }
};
let beginDrag = () => {
    if (plan)
        dragSnapshot.current = { data: plan, base: dirty ? draft?.base : selected };
};
let cancelDrag = () => {
    dragSnapshot.current = null;
};
let timetableProps = {
    plan: plan!,
    compact,
    members: workspace.members,
    actors: workspace.records.actors,
    performanceTime,
    productionColor: value(production.data, "color"),
    onEditLane: (lane: MaskPlanLane) => openEditor({ type: "lane", creating: false, lane }),
    onEditBlock: (block: MaskPlanBlock) => openEditor({ type: "block", creating: false, block }),
    onAddBlock: addBlock,
    onMoveBlock: moveBlock,
    onDragStart: beginDrag,
    onDragCancel: cancelDrag,
};
const beginningControl = true;

$: plans = workspace.records.maskPlans.filter((record) => record.data.productionId === production.id);
$: selected = plans.find((record) => record.id === selectedId) || (!draft ? plans[0] : undefined);
$: dirty = !!draft &&
    (!draft.base || JSON.stringify(draft.data) !== JSON.stringify(maskPlanValue(draft.base.data)));
$: plan = dirty ? draft!.data : selected ? maskPlanValue(selected.data) : null;
$: compact = !!plan && !editing && !dirty;
$: remoteChanged = dirty &&
    !!draft?.base &&
    (selected?.id !== draft.base.id || selected.version !== draft.base.version);









$: castings = workspace.records.casting.filter((record) => record.data.productionId === production.id);
$: castActorIds = new Set(castings.map((record) => value(record.data, "actorId")));
$: castActors = workspace.records.actors
    .filter((record) => castActorIds.has(record.id))
    .sort((left, right) => value(left.data, "name").localeCompare(value(right.data, "name"), "de"));
$: castNames = [
    ...new Set(castings.map((record) => value(record.data, "actorName")).filter(Boolean)),
];
$: overlaps = plan ? maskPlanOverlaps(plan) : [];
$: conflictVisible = conflict || remoteChanged;




$: timetableProps = {
    plan: plan!,
    compact,
    members: workspace.members,
    actors: workspace.records.actors,
    performanceTime,
    productionColor: value(production.data, "color"),
    onEditLane: (lane: MaskPlanLane) => openEditor({ type: "lane", creating: false, lane }),
    onEditBlock: (block: MaskPlanBlock) => openEditor({ type: "block", creating: false, block }),
    onAddBlock: addBlock,
    onMoveBlock: moveBlock,
    onDragStart: beginDrag,
    onDragCancel: cancelDrag,
};

</script>
{#if true}
{#snippet render_beginningControl()}<div class={styles.viewControls}>
      <label>
        <span>Beginn (optional)</span>
        <input type="time" aria-label="Vorstellungsbeginn (optional)" value={performanceTime} on:input={(event) => setPerformanceTime(event.currentTarget.value)} />
      </label>
    </div>{/snippet}
<section class={styles.module} data-dirty={dirty} data-compact={compact} aria-label="Maskenpläne dieser Produktion">
      <header class={styles.heading}>
        <div>
          <h2>Maskenplan</h2>
          {#if compact}<span class={styles.savedIndicator} role="status">
              <Check size={13}></Check> Gespeichert
            </span>{:else}<span class={styles.planCount}>
              {plans.length} {plans.length === 1 ? "gespeicherter Plan" : "gespeicherte Pläne"}
            </span>{/if}
        </div>
        <Button onClick={beginNew} disabled={busy || pending} aria-label="Neuer Plan" title="Neuen Maskenplan anlegen">
          <Plus size={16}></Plus>
          <span class={styles.newPlanLabel}>Neuer Plan</span>
        </Button>
      </header>
      {#if plan}
          <div class={styles.planBar}>
            <label class={styles.planSelect}>
              <span>Plan auswählen</span>
              <select value={dirty && !draft?.base ? "new" : selected?.id || ""} on:change={(event) => changePlan(event.currentTarget.value)} disabled={pending}>
                {#if dirty && !draft?.base}<option value="new">{plan.title} · neuer Entwurf</option>{/if}
                {#each plans as record (record.id)}<option value={record.id}>
                    {value(record.data, "title")}
                  </option>{/each}
              </select>
            </label>
            {compact && beginningControl}
            <div class={styles.planActions}>
              {#if compact}<Button variant="primary" onClick={() => setEditing(true)} disabled={pending}>
                  <Pencil size={16}></Pencil>
                  Plan bearbeiten
                </Button>{/if}
              {#if dirty}<div class={styles.desktopSave}>
                  <Button variant="primary" onClick={() => void savePlan()} disabled={busy || pending || conflictVisible || !online}>
                    <Save size={17}></Save>
                    Speichern
                  </Button>
                </div>{/if}
              <details class={styles.moreActions}>
                <summary class="button" aria-label="Planoptionen">
                  <MoreHorizontal size={17}></MoreHorizontal>
                  <span class={styles.moreLabel}>Planoptionen</span>
                </summary>
                <div class={styles.moreMenu}>
                  <Button onClick={() => openEditor({ type: "options", creating: false, plan })} disabled={pending}>
                    <Settings2 size={16}></Settings2>
                    Name &amp; Vorlauf
                  </Button>
                  <Button onClick={() => {
    setDraft({
        data: {
            ...cloneMaskPlan(plan),
            title: `${plan.title} – Kopie`.slice(0, 200),
        },
    });
    setSelectedId("");
    setConflict(false);
    setError("");
    updateLocation("");
}} disabled={pending}>
                    <Copy size={16}></Copy>
                    Duplizieren
                  </Button>
                  {#if selected && !(dirty && !draft?.base)}<Button variant="danger-ghost" disabled={pending || busy} onClick={async () => {
    if (!confirm(`Maskenplan „${value(selected.data, "title")}“ mit allen Personalspalten und Zeitblöcken löschen?${dirty ? " Auch dein ungespeicherter Entwurf wird verworfen." : ""}`))
        return;
    setPending(true);
    setError("");
    try {
        await remove(selected);
        reset();
        const next = plans.find((record) => record.id !== selected.id)?.id || "";
        setSelectedId(next);
        updateLocation(next);
    }
    catch (exception) {
        setError(exception instanceof Error
            ? exception.message
            : "Löschen fehlgeschlagen.");
    }
    finally {
        setPending(false);
    }
}}>
                      <Trash2 size={16}></Trash2>
                      Löschen
                    </Button>{/if}
                </div>
              </details>
              <Button onClick={() => setExporting(true)} disabled={dirty || !selected || pending} title={dirty
    ? "Speichere deine Änderungen vor dem Export."
    : "PDF, Excel, CSV oder JSON herunterladen"}>
                <Download size={16}></Download>
                Exportieren
              </Button>
            </div>
          </div>
          <div class={styles.planTitle}>
            <h3>{plan.title}</h3>
          </div>
          {#if conflictVisible}<div class={styles.conflict} role="alert">
              <AlertTriangle size={20}></AlertTriangle>
              <div>
                <strong>Dieser Plan wurde inzwischen geändert.</strong>
                <p>
                  Dein Entwurf ist noch hier. Lade den aktuellen Stand oder sichere deinen Entwurf
                  als eigenen Plan.
                </p>
                <div class={styles.bannerActions}>
                  <Button onClick={() => void reload()} disabled={pending}>
                    Aktuellen Stand laden
                  </Button>
                  <Button onClick={() => {
    setDraft({
        data: {
            ...cloneMaskPlan(plan),
            title: `${plan.title} – mein Entwurf`.slice(0, 200),
        },
    });
    setSelectedId("");
    setConflict(false);
    setError("");
    updateLocation("");
}} disabled={pending}>
                    Als neuen Plan behalten
                  </Button>
                </div>
              </div>
            </div>{/if}
          <ErrorMessage message={error}></ErrorMessage>
          {#if !compact}<div class={styles.toolbar}>
              <div class={styles.addActions}>
                <Button onClick={addLane} disabled={pending || plan.lanes.length >= 24}>
                  <Plus size={16}></Plus>
                  Personalspalte
                </Button>
                <Button onClick={() => addBlock()} disabled={pending || !plan.lanes.length || plan.blocks.length >= 250}>
                  <Plus size={16}></Plus>
                  Zeitblock
                </Button>
              </div>
              {@render render_beginningControl()}
            </div>{/if}
          <div inert={pending} class={styles.workspaceContent} on:click|capture={(event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (link &&
        dirty &&
        event.button === 0 &&
        !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
        link.getAttribute("target") !== "_blank" &&
        !guard()) {
        event.preventDefault();
        event.stopPropagation();
    }
}}>
            {#if plan.lanes.length}{#if compact}<SavedTimetable {...timetableProps}></SavedTimetable>{:else}<Timetable {...timetableProps}></Timetable>{/if}{:else}<div class={styles.empty}>
                <Empty title="Wer arbeitet in der Maske?" description="Lege zuerst eine Personalspalte an. Eine oder mehrere Maskenpersonen können sich eine Spalte teilen. Danach kommen die Zeitblöcke für Schauspieler und Tätigkeiten dazu." action="Personalspalte hinzufügen" onAction={addLane}></Empty>
              </div>{/if}
          </div>
          {#if plan.notes}<details class={styles.planNotes}>
              <summary>Hinweise zum Plan</summary>
              <p>
                <LinkedText text={plan.notes}></LinkedText>
              </p>
            </details>{/if}
          {#if overlaps.length > 0}<details class={styles.warnings}>
              <summary>
                <AlertTriangle size={17}></AlertTriangle>
                {overlaps.length} {overlaps.length === 1 ? "Überschneidung" : "Überschneidungen"}{" "}
                prüfen
              </summary>
              <p>
                Das sind Hinweise. Wenn ihr parallel arbeiten könnt, darf der Plan so gespeichert
                werden.
              </p>
              <ul>
                {#each overlaps.slice(0, 30) as overlap, index (index)}{@const first = plan.blocks.find((block) => block.id === overlap.firstId)!}{@const second = plan.blocks.find((block) => block.id === overlap.secondId)!}<li>
                      <button type="button" on:click={() => openEditor({ type: "block", creating: false, block: first })}>
                        {maskPlanBlockLabel(first, workspace.records.actors)}
                      </button>
                      <span> und </span>
                      <button type="button" on:click={() => openEditor({ type: "block", creating: false, block: second })}>
                        {maskPlanBlockLabel(second, workspace.records.actors)}
                      </button>
                      <span>
                        {" "}
                        überschneiden sich{" "}
                        {overlap.reason === "lane"
    ? "in derselben Personalspalte"
    : overlap.reason === "actor"
        ? "für dieselbe Schauspielperson"
        : "bei gemeinsamem Maskenpersonal"}
                        .
                      </span>
                    </li>{/each}
              </ul>
              {#if overlaps.length > 30}<p>{overlaps.length - 30} weitere Überschneidungen im Plan.</p>{/if}
            </details>{/if}
          {#if !compact}<footer class={styles.saveBar} data-dirty={dirty}>
              <span class={styles.saveStatus} role="status">
                {#if dirty}
                    <span class={styles.dirtyDot}></span>
                    Ungespeicherte Änderungen
                  {:else}
                    <Check size={16}></Check>
                    Keine ungespeicherten Änderungen
                  {/if}
                {#if dirty}<small>Export nach dem Speichern</small>{/if}
              </span>
              <div>
                {#if !dirty}<Button onClick={() => setEditing(false)} disabled={pending}>
                    Bearbeiten beenden
                  </Button>{/if}
                <Button onClick={() => {
    if (guard()) {
        reset();
        if (!selected)
            setSelectedId(plans[0]?.id || "");
    }
}} disabled={!dirty || pending}>
                  <Undo2 size={16}></Undo2>
                  Verwerfen
                </Button>
                <Button variant="primary" onClick={() => void savePlan()} disabled={!dirty || busy || pending || conflictVisible || !online}>
                  <Save size={16}></Save>
                  {pending ? "Wird gespeichert …" : "Plan speichern"}
                </Button>
              </div>
              {#if !online}<p class={styles.offline}>
                  Ohne Verbindung bleibt der Entwurf in dieser Ansicht. Speichere, sobald du wieder
                  online bist.
                </p>{/if}
            </footer>{/if}
        {:else}<div class={styles.empty}>
          <Empty title="Ein klarer Ablauf bis zum Beginn." description="Plant, welche Schauspieler wann in die Maske kommen, wer sie betreut und wie lange es dauert. Alle Zeiten zählen rückwärts zum Vorstellungsbeginn." action="Maskenplan anlegen" onAction={beginNew}></Empty>
        </div>{/if}
      {#if editor?.type === "options"}{@const optionsEditor=editor}<PlanOptions plan={optionsEditor.plan} creating={optionsEditor.creating} onClose={() => setEditor(null)} onApply={(next) => {
    if (optionsEditor.creating) {
        setDraft({ data: next });
        setEditing(true);
        setSelectedId("");
        setConflict(false);
        setError("");
        updateLocation("");
    }
    else
        change(next, optionsEditor.base);
}}></PlanOptions>{/if}
      {#if plan && editor?.type === "lane"}{@const laneEditor=editor}{@const activePlan=plan}<LaneEditor lane={laneEditor.lane} creating={laneEditor.creating} blockCount={plan.blocks.filter((block) => block.laneId === laneEditor.lane.id).length} onClose={() => setEditor(null)} onApply={(lane) => change({
    ...(laneEditor.snapshot || activePlan),
    lanes: laneEditor.creating
        ? [...(laneEditor.snapshot || activePlan).lanes, lane]
        : (laneEditor.snapshot || activePlan).lanes.map((item) => item.id === lane.id ? lane : item),
}, laneEditor.base)} onRemove={() => change({
    ...(laneEditor.snapshot || activePlan),
    lanes: (laneEditor.snapshot || activePlan).lanes.filter((item) => item.id !== laneEditor.lane.id),
    blocks: (laneEditor.snapshot || activePlan).blocks.filter((item) => item.laneId !== laneEditor.lane.id),
}, laneEditor.base)}></LaneEditor>{/if}
      {#if plan && editor?.type === "block"}{@const blockEditor=editor}{@const activePlan=plan}<BlockEditor block={blockEditor.block} plan={blockEditor.snapshot || activePlan} castActors={castActors} castNames={castNames} performanceTime={performanceTime} creating={blockEditor.creating} onClose={() => setEditor(null)} onApply={(block) => change({
    ...(blockEditor.snapshot || activePlan),
    blocks: blockEditor.creating
        ? [...(blockEditor.snapshot || activePlan).blocks, block]
        : (blockEditor.snapshot || activePlan).blocks.map((item) => item.id === block.id ? block : item),
}, blockEditor.base)} onRemove={() => change({
    ...(blockEditor.snapshot || activePlan),
    blocks: (blockEditor.snapshot || activePlan).blocks.filter((item) => item.id !== blockEditor.block.id),
}, blockEditor.base)}></BlockEditor>{/if}
      {#if exporting && selected}<Modal title="Maskenplan exportieren" onClose={() => setExporting(false)} className={styles.modal}>
          <p class={styles.hint}>
            Gespeicherter Plan: <strong>{value(selected.data, "title")}</strong>
            {#if performanceTime} · Beginn {performanceTime}{/if}. PDF zeigt die Zeittabelle zum
            Ausdrucken.
          </p>
          <div class={styles.exportLinks}>
            {#each [
    ["pdf", "PDF · drucken"],
    ["xlsx", "Excel · Zeittabelle"],
    ["csv", "CSV · Zeitblöcke"],
    ["json", "JSON · vollständiger Plan"],
] as [format, label] (format)}<a class="button" href={`/api/export?${new URLSearchParams({ kind: "maskPlans", id: selected.id, productionId: production.id, format, ...(performanceTime ? { performanceTime } : {}) })}`} download>
                <Download size={17}></Download>
                {label}
              </a>{/each}
          </div>
          <footer class="dialog-footer">
            <Button onClick={() => setExporting(false)}>Schließen</Button>
          </footer>
        </Modal>{/if}
    </section>

{/if}
