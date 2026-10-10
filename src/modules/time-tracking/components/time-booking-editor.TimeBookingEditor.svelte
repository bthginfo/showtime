<script lang="ts">
import { canManageRecord } from "@/shared/record-permissions";
import { categoriesFor } from "@/shared/domain-categories";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { ApiFailure, hours, instantDate, localDate, localDateTime, num, value, } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { numberDraft, parseNumberDraft, previewNumberDraft } from "@/shared/number-draft";
import { clearTimeDraft, retainTimeDraft, timeDraftQueueKey } from "../client-drafts";
import styles from "./time-history.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    kind?: "time" | "attendance";
    record?: DomainRecord;
    defaults?: RecordData;
    lockedProductionId?: string;
    onClose: () => void;
    onSaved?: (record: DomainRecord) => void;
    onDraft?: (data: RecordData) => void;
    proposal?: string;
};
export let kind: NonNullable<ViewProps["kind"]> = "time";
export let record: ViewProps["record"] = undefined as any;
export let defaults: NonNullable<ViewProps["defaults"]> = {};
export let lockedProductionId: ViewProps["lockedProductionId"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
export let onSaved: ViewProps["onSaved"] = undefined as any;
export let onDraft: ViewProps["onDraft"] = undefined as any;
export let proposal: ViewProps["proposal"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, remove, busy, notify } = $workspaceStore;
$: ({ workspace, save, remove, busy, notify } = $workspaceStore);
let attendance = kind === "attendance";
let initial = { ...defaults, ...record?.data };
let date = value(initial, "date") || localDate();
let title = value(initial, "title") || (attendance ? "Anwesenheit" : "");
const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => { title = typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next; };
let notes = value(initial, "notes");
const setNotes = (next: typeof notes | ((current: typeof notes) => typeof notes)) => { notes = typeof next === "function" ? (next as (current: typeof notes) => typeof notes)(notes) : next; };
let mode = attendance || (initial.start && initial.end) ? "interval" : "duration";
const setMode = (next: typeof mode | ((current: typeof mode) => typeof mode)) => { mode = typeof next === "function" ? (next as (current: typeof mode) => typeof mode)(mode) : next; };
let day = date;
const setDay = (next: typeof day | ((current: typeof day) => typeof day)) => { day = typeof next === "function" ? (next as (current: typeof day) => typeof day)(day) : next; };
let start = initial.start ? localDateTime(String(initial.start)) : `${date}T09:00`;
const setStart = (next: typeof start | ((current: typeof start) => typeof start)) => { start = typeof next === "function" ? (next as (current: typeof start) => typeof start)(start) : next; };
let end = initial.end ? localDateTime(String(initial.end)) : `${date}T17:00`;
const setEnd = (next: typeof end | ((current: typeof end) => typeof end)) => { end = typeof next === "function" ? (next as (current: typeof end) => typeof end)(end) : next; };
let customEndDate = Boolean(initial.start &&
    initial.end &&
    localDateTime(String(initial.start)).slice(0, 10) !==
        localDateTime(String(initial.end)).slice(0, 10));
const setCustomEndDate = (next: typeof customEndDate | ((current: typeof customEndDate) => typeof customEndDate)) => { customEndDate = typeof next === "function" ? (next as (current: typeof customEndDate) => typeof customEndDate)(customEndDate) : next; };
let minutes = numberDraft(Math.round((num(initial, "durationSeconds") || 1800) / 60));
const setMinutes = (next: typeof minutes | ((current: typeof minutes) => typeof minutes)) => { minutes = typeof next === "function" ? (next as (current: typeof minutes) => typeof minutes)(minutes) : next; };
let pause = numberDraft(Math.round(num(initial, "pauseSeconds") / 60));
const setPause = (next: typeof pause | ((current: typeof pause) => typeof pause)) => { pause = typeof next === "function" ? (next as (current: typeof pause) => typeof pause)(pause) : next; };
let production = lockedProductionId ?? value(initial, "productionId");
const setProduction = (next: typeof production | ((current: typeof production) => typeof production)) => { production = typeof next === "function" ? (next as (current: typeof production) => typeof production)(production) : next; };
let categoryOptions = categoriesFor("time", workspace.records.categories);
let category = value(initial, "category") || categoryOptions[0]?.key || "";
const setCategory = (next: typeof category | ((current: typeof category) => typeof category)) => { category = typeof next === "function" ? (next as (current: typeof category) => typeof category)(category) : next; };
let taskId = value(initial, "taskId");
const setTaskId = (next: typeof taskId | ((current: typeof taskId) => typeof taskId)) => { taskId = typeof next === "function" ? (next as (current: typeof taskId) => typeof taskId)(taskId) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let receipt = {current: "" as any | null};
let submitting = {current: false as any | null};
let queueKey = timeDraftQueueKey(kind, workspace.user.id);
let pauseValue = previewNumberDraft(pause, { fallback: 0, min: 0, max: 1440, integer: true });
let minutesValue = previewNumberDraft(minutes, { min: 1, max: 10080, integer: true });
let elapsed = pauseValue === undefined
    ? undefined
    : mode === "interval" && start && end
        ? Math.floor((instantDate(end).getTime() - instantDate(start).getTime()) / 1000) -
            pauseValue * 60
        : minutesValue === undefined
            ? undefined
            : minutesValue * 60;
let tasks = workspace.records.tasks.filter((task) => value(task.data, "productionId") === production);

$: attendance = kind === "attendance";
$: initial = { ...defaults, ...record?.data };
$: date = value(initial, "date") || localDate();
$: categoryOptions = categoriesFor("time", workspace.records.categories);
$: queueKey = timeDraftQueueKey(kind, workspace.user.id);
$: pauseValue = previewNumberDraft(pause, { fallback: 0, min: 0, max: 1440, integer: true });
$: minutesValue = previewNumberDraft(minutes, { min: 1, max: 10080, integer: true });
$: elapsed = pauseValue === undefined
    ? undefined
    : mode === "interval" && start && end
        ? Math.floor((instantDate(end).getTime() - instantDate(start).getTime()) / 1000) -
            pauseValue * 60
        : minutesValue === undefined
            ? undefined
            : minutesValue * 60;
$: tasks = workspace.records.tasks.filter((task) => value(task.data, "productionId") === production);

</script>

<Modal title={proposal
    ? "Geplante Zeit prüfen"
    : `${attendance ? "Anwesenheit" : "Zeitbuchung"} ${record ? "bearbeiten" : onDraft ? "offline vormerken" : "anlegen"}`} onClose={onClose} wide>
      <form class="booking-form" on:submit={async (event) => {
    event.preventDefault();
    if (submitting.current || busy)
        return;
    submitting.current = true;
    setError("");
    let retained = false;
    let saved = false;
    try {
        const parsedPause = parseNumberDraft(pause, {
            label: "Pause in Minuten",
            fallback: 0,
            min: 0,
            max: 1440,
            integer: true,
        })!;
        const parsedMinutes = mode === "duration"
            ? parseNumberDraft(minutes, {
                label: "Dauer in Minuten",
                required: true,
                min: 1,
                max: 10080,
                integer: true,
            })!
            : undefined;
        const durationSeconds = mode === "interval"
            ? Math.floor((instantDate(end).getTime() - instantDate(start).getTime()) / 1000) -
                parsedPause * 60
            : parsedMinutes! * 60;
        if (!Number.isFinite(durationSeconds) ||
            durationSeconds <= 0 ||
            durationSeconds > 7 * 86400)
            throw new Error("Prüfe Beginn, Ende und Pause. Eine Buchung muss zwischen einer Sekunde und sieben Tagen liegen.");
        if (!attendance && !categoryOptions.some((option) => option.key === category))
            throw new Error("Bitte einen vorhandenen Tätigkeitsbereich auswählen.");
        const data: RecordData = {
            title: title.trim() || "Anwesenheit",
            date: mode === "interval" ? localDate(instantDate(start)) : day,
            durationSeconds,
            pauseSeconds: parsedPause * 60,
            start: mode === "interval" ? instantDate(start).toISOString() : "",
            end: mode === "interval" ? instantDate(end).toISOString() : "",
            ...(attendance
                ? { notes: notes.trim() }
                : { productionId: production, taskId, category }),
        };
        if (onDraft)
            onDraft(data);
        else {
            if (!record) {
                receipt.current ||= `manual:${crypto.randomUUID()}`;
                data.idempotencyKey = receipt.current;
                retained = retainTimeDraft(queueKey, receipt.current, data);
            }
            const booking = await save(kind, data, record);
            saved = true;
            if (!record)
                clearTimeDraft(queueKey, receipt.current);
            onSaved?.(booking);
        }
        onClose();
    }
    catch (exception) {
        if (saved) {
            notify("Deine Buchung wurde gespeichert. Lade die Zeiten neu, falls die Anzeige noch nicht aktuell ist.");
            onClose();
            return;
        }
        const uncertain = !saved &&
            exception instanceof ApiFailure &&
            (exception.status === 0 || exception.status >= 500);
        if (!uncertain && retained)
            clearTimeDraft(queueKey, receipt.current);
        const message = exception instanceof Error ? exception.message : "Speichern fehlgeschlagen";
        setError(uncertain
            ? `${message} ${retained ? "Deine Buchung ist in diesem Browser gesichert. Du kannst erneut speichern oder später die lokalen Entwürfe synchronisieren." : "Deine Eingaben bleiben hier stehen. Lass dieses Fenster geöffnet, bis das Speichern klappt."}`
            : message);
    }
    finally {
        submitting.current = false;
    }
}}>
        {#if proposal}<div class={styles.proposalIntro}>
            <strong>Noch nicht gebucht · {attendance ? "Anwesenheit" : "Arbeitszeit"}</strong>
            <span>Kalenderplanung: {proposal}</span>
            <p>
              Prüfe Beginn, Ende, tatsächlich geleistete Zeit und Pausen
              {attendance ? "." : " sowie Tätigkeit und Produktion."} Erst dein ausdrückliches
              Buchen speichert Stunden.
            </p>
          </div>{/if}
        <p class="muted booking-intro">
          {attendance
    ? "Wann warst du im Theater? Die Anwesenheit bleibt getrennt von der Arbeit an einzelnen Produktionen."
    : "Buche deine Tätigkeit mit Dauer oder einem genauen Zeitraum. Dein Anwesenheitstimer läuft unabhängig davon."}{" "}
          Zeiten werden in Europe/Berlin erfasst.
        </p>
        {#if record}<p class="small muted">
            Du bearbeitest die Buchung von{" "}
            {workspace.members.find((member) => member.id === record.data.userId)?.name ||
    workspace.user.name}
            . Die Änderung wird direkt gespeichert.
          </p>{/if}
        <label>
          {attendance ? "Bezeichnung (optional)" : "Tätigkeit"}
          <input required={!attendance} maxLength={200} value={title} on:input={(event) => setTitle(event.currentTarget.value)} />
        </label>
        {#if !attendance}<div class="form-grid">
            <label>
              Produktion
              <select aria-label="Produktion" disabled={lockedProductionId !== undefined} value={production} on:change={(event) => {
    setProduction(event.currentTarget.value);
    setTaskId("");
}}>
                <option value="">Allgemeine Arbeit</option>
{#if production && !workspace.records.productions.some(row=>row.id===production)}<option value={production}>Frühere Produktionszuordnung</option>{/if}
                {#each workspace.records.productions as row (row.id)}<option value={row.id}>
                    {value(row.data, "title")}
                  </option>{/each}
              </select>
            </label>
            <label>
              Tätigkeitsbereich
              <select value={category} on:change={(event) => setCategory(event.currentTarget.value)}>
                {#if !categoryOptions.length}<option value="">Keine Kategorien vorhanden</option>{/if}
                {#each categoryOptions as option (option.key)}<option value={option.key}>
                    {option.name}
                  </option>{/each}
              </select>
            </label>
            {#if tasks.length > 0}<label>
                Aufgabe (optional)
                <select value={taskId} on:change={(event) => setTaskId(event.currentTarget.value)}>
                  <option value="">Keine Aufgabe</option>
                  {#each tasks as task (task.id)}<option value={task.id}>
                      {value(task.data, "title")}
                    </option>{/each}
                </select>
              </label>{/if}
          </div>{/if}
        {#if !attendance}<fieldset class="booking-mode">
            <legend>Wie möchtest du buchen?</legend>
            <div class="feedback-type-options">
              <label>
                <input type="radio" name="booking-mode" checked={mode === "duration"} on:input={() => setMode("duration")} />
                Dauer
              </label>
              <label>
                <input type="radio" name="booking-mode" checked={mode === "interval"} on:input={() => setMode("interval")} />
                Beginn & Ende
              </label>
            </div>
          </fieldset>{/if}
        <div class="form-grid">
          {#if mode === "interval"}
              <label>
                Beginn
                <input type="datetime-local" required value={start} on:input={(event) => {
    const next = event.currentTarget.value;
    setStart(next);
    if (next && !customEndDate)
        setEnd(`${next.slice(0, 10)}T${end.slice(11) || "17:00"}`);
}} />
              </label>
              <label>
                Ende
                <input type="datetime-local" required min={start} value={end} on:input={(event) => {
    setEnd(event.currentTarget.value);
    setCustomEndDate(event.currentTarget.value.slice(0, 10) !== start.slice(0, 10));
}} />
              </label>
            {:else}
              <label>
                Datum
                <input type="date" required value={day} on:input={(event) => {
    const next = event.currentTarget.value;
    setDay(next);
    if (next) {
        setStart(`${next}T${start.slice(11) || "09:00"}`);
        if (!customEndDate)
            setEnd(`${next}T${end.slice(11) || "17:00"}`);
    }
}} />
              </label>
              <label>
                Dauer in Minuten
                <input type="number" required min={1} max={10080} value={minutes} on:input={(event) => setMinutes(event.currentTarget.value)} />
              </label>
            {/if}
          <label>
            Pause in Minuten
            <input type="number" min={0} max={1440} value={pause} on:input={(event) => setPause(event.currentTarget.value)} />
          </label>
        </div>
        {#if attendance}<label>
            Notiz
            <textarea rows={3} maxLength={20000} value={notes} on:input={(event) => setNotes(event.currentTarget.value)}></textarea>
          </label>{/if}
        <div class="booking-calculation">
          <span>
            {mode === "interval" ? "Berechnete Zeit ohne Pause" : "Gebuchte Tätigkeitsdauer"}
          </span>
          <strong>
            {elapsed === undefined || !Number.isFinite(elapsed)
    ? "–"
    : `${hours(Math.max(0, elapsed))} h`}
          </strong>
        </div>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={onClose}>Abbrechen</Button>
          {#if record && canManageRecord(workspace.user,kind,record)}{@const booking=record}
          <Button variant="danger-ghost" disabled={busy} onClick={async()=>{if(!confirm("Diese Zeitbuchung endgültig löschen?"))return;setError("");try{await remove(booking);onClose();}catch(e){setError(e instanceof Error?e.message:"Löschen fehlgeschlagen");}}}>Buchung löschen</Button>{/if}
          <Button type="submit" variant="primary" disabled={busy}>
            {onDraft
    ? "Lokal speichern"
    : busy
        ? "Wird gespeichert …"
        : proposal
            ? "Geprüfte Zeit buchen"
            : "Speichern"}
          </Button>
        </footer>
      </form>
    </Modal>
