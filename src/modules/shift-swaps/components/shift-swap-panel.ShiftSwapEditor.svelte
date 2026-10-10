<script lang="ts">
import { ArrowRightLeft, Check, ChevronDown, Plus, X } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { listValue, textValue } from "@/shared/contracts";
import { dateLabel } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { subscribeLocation } from "@/shared/client-storage";
import { calendarPresentation } from "@/shared/calendar-categories";
import { occurrences } from "@/modules/calendar/occurrences";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
import { ExportDialog } from "@/components/export-dialog";
import { eligibleSwapService, shiftSwapStatusLabels } from "../model";
import type { ShiftSwapAction, ShiftSwapStatus } from "../schema";
import styles from "@/modules/workflows/components/workflow.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type ServiceOption, upcomingServices, serviceLabel, ShiftSwapPanel } from "./shift-swap-panel";
const effects=createEffects();
type ViewProps = {
    onClose: () => void;
};
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, runWorkflow, busy } = $workspaceStore;
$: ({ workspace, runWorkflow, busy } = $workspaceStore);
let now = (Date.now)();
let serviceKey: string = "";
const setServiceKey = (next: typeof serviceKey | ((current: typeof serviceKey) => typeof serviceKey)) => { serviceKey = typeof next === "function" ? (next as (current: typeof serviceKey) => typeof serviceKey)(serviceKey) : next; };
let partnerId: string = "";
const setPartnerId = (next: typeof partnerId | ((current: typeof partnerId) => typeof partnerId)) => { partnerId = typeof next === "function" ? (next as (current: typeof partnerId) => typeof partnerId)(partnerId) : next; };
let counterKey: string = "";
const setCounterKey = (next: typeof counterKey | ((current: typeof counterKey) => typeof counterKey)) => { counterKey = typeof next === "function" ? (next as (current: typeof counterKey) => typeof counterKey)(counterKey) : next; };
let reciprocal: boolean = false;
const setReciprocal = (next: typeof reciprocal | ((current: typeof reciprocal) => typeof reciprocal)) => { reciprocal = typeof next === "function" ? (next as (current: typeof reciprocal) => typeof reciprocal)(reciprocal) : next; };
let note: string = "";
const setNote = (next: typeof note | ((current: typeof note) => typeof note)) => { note = typeof next === "function" ? (next as (current: typeof note) => typeof note)(note) : next; };
let confirmed: boolean = false;
const setConfirmed = (next: typeof confirmed | ((current: typeof confirmed) => typeof confirmed)) => { confirmed = typeof next === "function" ? (next as (current: typeof confirmed) => typeof confirmed)(confirmed) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let events = workspace.records.events;
let categories = workspace.records.calendarCategories;
let productions = workspace.records.productions;
let mine = (() => upcomingServices(events, workspace.user.id, categories, productions, now))();
let theirs = (() => partnerId
    ? upcomingServices(events, partnerId, categories, productions, now).filter((option) => !listValue(option.event.data.participantIds).includes(workspace.user.id))
    : [])();
let selected = mine.find((option) => option.key === serviceKey);
let counter = theirs.find((option) => option.key === counterKey);
let partners = workspace.members.filter((member) => isActiveStaff(member) &&
    member.id !== workspace.user.id &&
    (!selected || !listValue(selected.event.data.participantIds).includes(member.id)));
let selectedPartner = partners.find((member) => member.id === partnerId);

$: events = workspace.records.events;
$: categories = workspace.records.calendarCategories;
$: productions = workspace.records.productions;
$: mine = (() => upcomingServices(events, workspace.user.id, categories, productions, now))();
$: theirs = (() => partnerId
    ? upcomingServices(events, partnerId, categories, productions, now).filter((option) => !listValue(option.event.data.participantIds).includes(workspace.user.id))
    : [])();
$: selected = mine.find((option) => option.key === serviceKey);
$: counter = theirs.find((option) => option.key === counterKey);
$: partners = workspace.members.filter((member) => isActiveStaff(member) &&
    member.id !== workspace.user.id &&
    (!selected || !listValue(selected.event.data.participantIds).includes(member.id)));
$: selectedPartner = partners.find((member) => member.id === partnerId);

</script>

<Modal title="Diensttausch anfragen" onClose={busy ? () => { } : onClose}>
      <form class={styles.form} on:submit={async (event) => {
    event.preventDefault();
    setError("");
    if (!selected || !selectedPartner || (reciprocal && !counter) || !confirmed) {
        setError("Bitte wähle Dienst und Kollegin und bestätige deine Anfrage.");
        return;
    }
    try {
        await runWorkflow("/api/shift-swaps", {
            serviceId: selected.event.id,
            serviceStart: selected.start,
            serviceVersion: selected.event.version,
            partnerId,
            note,
            confirmed,
            ...(reciprocal && counter
                ? {
                    counterServiceId: counter.event.id,
                    counterServiceStart: counter.start,
                    counterServiceVersion: counter.event.version,
                }
                : {}),
        });
        onClose();
    }
    catch (exception) {
        setError(exception instanceof Error
            ? exception.message
            : "Die Anfrage konnte nicht gespeichert werden.");
    }
}}>
        <p class={styles.note}>
          Zuerst stimmt die Kollegin zu. Danach prüft ein Admin den Tausch und ändert den Kalender.
        </p>
        {#if !mine.length}<p class={styles.empty}>
            Du hast aktuell keinen zukünftigen Dienst zum Tauschen. Ganztägige Abwesenheiten und
            Freiwünsche können nicht getauscht werden.
          </p>{/if}
        <div class="form-grid">
          <label class="field-wide">
            Mein Dienst
            <select required value={serviceKey} on:change={(event) => {
    setServiceKey(event.currentTarget.value);
    setPartnerId("");
    setCounterKey("");
    setConfirmed(false);
}}>
              <option value="">Dienst auswählen …</option>
              {#each mine as option (option.key)}<option value={option.key}>
                  {serviceLabel(option)}
                </option>{/each}
            </select>
          </label>
          <label class="field-wide">
            Wer soll übernehmen?
            <select required value={partnerId} disabled={!selected} on:change={(event) => {
    setPartnerId(event.currentTarget.value);
    setCounterKey("");
    setConfirmed(false);
}}>
              <option value="">Kollegin auswählen …</option>
              {#each partners as member (member.id)}<option value={member.id}>
                  {member.name}
                </option>{/each}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Art der Anfrage</legend>
          <label class={styles.confirmation}>
            <input type="checkbox" checked={reciprocal} on:input={(event) => {
    setReciprocal(event.currentTarget.checked);
    setCounterKey("");
    setConfirmed(false);
}} />
            Ich übernehme dafür einen Dienst der Kollegin.
          </label>
          {#if reciprocal}<label>
              Gegendienst
              <select required value={counterKey} disabled={!partnerId} on:change={(event) => {
    setCounterKey(event.currentTarget.value);
    setConfirmed(false);
}}>
                <option value="">Gegendienst auswählen …</option>
                {#each theirs
    .filter((option) => option.event.id !== selected?.event.id) as option (option.key)}<option value={option.key}>
                      {serviceLabel(option)}
                    </option>{/each}
              </select>
              {#if partnerId && !theirs.length}<span class={styles.note}>
                  Keine passenden zukünftigen Dienste in deinen sichtbaren Kalendern.
                </span>{/if}
            </label>{/if}
        </fieldset>
        {#if selected}<div class={styles.swapTimes}>
            <div>
              <strong>
                {selectedPartner?.name || "Kollegin"} übernimmt: {selected.title}
              </strong>
              <time>
                {dateLabel(selected.start, true)} – {dateLabel(selected.end, true)}
              </time>
            </div>
            {#if reciprocal && counter}<div>
                <strong>Ich übernehme: {counter.title}</strong>
                <time>
                  {dateLabel(counter.start, true)} – {dateLabel(counter.end, true)}
                </time>
              </div>{/if}
          </div>{/if}
        <label>
          Nachricht · optional
          <textarea rows={3} maxLength={2000} value={note} on:input={(event) => setNote(event.currentTarget.value)} placeholder="Was soll deine Kollegin wissen?"></textarea>
        </label>
        <label class={styles.confirmation}>
          <input type="checkbox" required checked={confirmed} on:input={(event) => setConfirmed(event.currentTarget.checked)} />
          Ich möchte diesen Dienst abgeben
          {reciprocal ? " und den ausgewählten Gegendienst übernehmen" : ""}.
        </label>
        {#if !!selected?.event.data.recurrence && selected.event.data.recurrence !== "none"}<p class={styles.note}>
            Dies ist ein Serientermin. Deine Anfrage betrifft nur den ausgewählten Tag.
          </p>{/if}
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !selected || !selectedPartner || !confirmed || (reciprocal && !counter)}>
            {busy ? "Wird gesendet …" : "Anfrage senden"}
          </Button>
        </footer>
      </form>
    </Modal>
