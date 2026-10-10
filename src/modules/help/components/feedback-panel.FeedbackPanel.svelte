<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { LinkedText } from "@/components/linked-text";
import { ArrowUpRight, Bug, Lightbulb, Plus } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { dateLabel, value,post,api } from "@/shared/client-api";
import {onMount} from 'svelte';
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { feedbackStatuses, FeedbackEditor } from "./feedback-panel";
const effects=createEffects();
const workspaceStore=useWorkspace();
let { workspace, save, busy } = $workspaceStore;
$: ({ workspace, save, busy } = $workspaceStore);
let superadmin = workspace.user.role === "superadmin";
let creating: boolean = false;
const setCreating = (next: typeof creating | ((current: typeof creating) => typeof creating)) => { creating = typeof next === "function" ? (next as (current: typeof creating) => typeof creating)(creating) : next; };
let editing: DomainRecord | undefined = initialState<DomainRecord | undefined>(undefined);
const setEditing = (next: DomainRecord | undefined | ((current: DomainRecord | undefined) => DomainRecord | undefined)) => { editing = typeof next === "function" ? (next as (current: DomainRecord | undefined) => DomainRecord | undefined)(editing) : next; };
let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
const setDetail = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { detail = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail) : next; };
let status: string = "";
const setStatus = (next: typeof status | ((current: typeof status) => typeof status)) => { status = typeof next === "function" ? (next as (current: typeof status) => typeof status)(status) : next; };
let type: string = "";
const setType = (next: typeof type | ((current: typeof type) => typeof type)) => { type = typeof next === "function" ? (next as (current: typeof type) => typeof type)(type) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let records = workspace.records.feedback
    .filter((record) => (superadmin || record.data.userId === workspace.user.id) &&
    (!status || record.data.status === status) &&
    (!type || record.data.type === type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
let current: any = detail
    ? workspace.records.feedback.find((record) => record.id === detail?.id) || detail
    : null;
let updateStatus = async (record: DomainRecord, status: string) => {
    setError("");
    try {
        await save("feedback", { status }, record);
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Status konnte nicht geändert werden.");
    }
};
let supportStates:Record<string,string>={};
async function loadSupport(){const entries=await api<{sourceRecordId:string;status:string}[]>('/api/support');supportStates=Object.fromEntries(entries.map(entry=>[entry.sourceRecordId,entry.status]));}
async function forward(record:DomainRecord){if(!confirm('Titel, Art und Beschreibung dieser Rückmeldung an den Plattform-Support weitergeben? Anhänge und weitere Theaterdaten werden nicht übertragen.'))return;setError('');try{await post('/api/support',{id:record.id,consent:true});await loadSupport();}catch(e){setError((e as Error).message);}}
onMount(()=>{void loadSupport().catch(e=>setError(e.message));});

$: superadmin = workspace.user.role === "superadmin";
$: records = workspace.records.feedback
    .filter((record) => (superadmin || record.data.userId === workspace.user.id) &&
    (!status || record.data.status === status) &&
    (!type || record.data.type === type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
$: current = detail
    ? workspace.records.feedback.find((record) => record.id === detail?.id) || detail
    : null;


</script>


      <div class="feedback-heading">
        <div>
          <h2>{superadmin ? "Bearbeitungsübersicht" : "Meine Rückmeldungen"}</h2>
          <p class="muted">
            {superadmin
    ? "Ideen und Fehlerberichte aus dem Team prüfen, planen und abschließen."
    : "Deine Ideen und Fehlerberichte mit aktuellem Bearbeitungsstand."}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16}></Plus>
          Idee oder Fehler melden
        </Button>
      </div>
      <div class="toolbar wrap">
        <label class="inline-label">
          Status
          <select value={status} on:change={(event) => setStatus(event.currentTarget.value)}>
            <option value="">Alle Status</option>
            {#each Object.entries(feedbackStatuses) as [id, name] (id)}<option value={id}>
                {name}
              </option>{/each}
          </select>
        </label>
        <label class="inline-label">
          Art
          <select value={type} on:change={(event) => setType(event.currentTarget.value)}>
            <option value="">Ideen & Fehler</option>
            <option value="feature">Ideen / Wünsche</option>
            <option value="bug">Fehler</option>
          </select>
        </label>
        <span class="small muted">{records.length} Rückmeldungen</span>
      </div>
      <ErrorMessage message={error}></ErrorMessage>
      {#if records.length}<div class="feedback-list">
          {#each records as record (record.id)}<article class="feedback-row">
              <span class={`feedback-type-icon ${record.data.type === "bug" ? "bug" : ""}`} aria-hidden="true">
                {#if record.data.type === "bug"}<Bug size={20}></Bug>{:else}<Lightbulb size={20}></Lightbulb>{/if}
              </span>
              <div class="feedback-row-content">
                <button class="text-button strong" on:click={() => setDetail(record)}>
                  {value(record.data, "title")}
                  <ArrowUpRight size={14}></ArrowUpRight>
                </button>
                <p class="small muted">
                  {record.data.type === "bug" ? "Fehler" : "Idee / Wunsch"} ·{" "}
                  {dateLabel(record.createdAt)}
                  {superadmin
    ? ` · ${workspace.members.find((member) => member.id === record.data.userId)?.name || "Teammitglied"}`
    : ""}
                </p>
                <p class="feedback-excerpt">
                  <LinkedText text={value(record.data, "description")}></LinkedText>
                </p>
              </div>
              {#if superadmin}<select aria-label={`Status von ${value(record.data, "title")}`} value={value(record.data, "status")} disabled={busy} on:change={(event) => void updateStatus(record, event.currentTarget.value)}>
                  {#each Object.entries(feedbackStatuses) as [id, name] (id)}<option value={id}>
                      {name}
                    </option>{/each}
                </select>{:else}<Badge tone={record.data.status === "done" ? "green" : "neutral"}>
                  {feedbackStatuses[supportStates[record.id]||value(record.data, "status")] || "Neu"}
                </Badge>{/if}
            </article>{/each}
        </div>{:else}<Empty title={status || type
    ? "Keine passenden Rückmeldungen."
    : "Deine Erfahrung macht DigitalMask besser."} description={status || type
    ? "Passe die Filter an, um weitere Rückmeldungen zu sehen."
    : "Teile eine Idee oder beschreibe einen Fehler. Der Bearbeitungsstand bleibt hier nachvollziehbar."} action="Rückmeldung schreiben" onAction={() => setCreating(true)}></Empty>{/if}
      {#if creating}<FeedbackEditor onClose={() => setCreating(false)}></FeedbackEditor>{/if}
      {#if editing}<FeedbackEditor record={editing} onClose={() => setEditing(undefined)}></FeedbackEditor>{/if}
      {#if current && !editing}<Modal title={value(current.data, "title")} onClose={() => setDetail(null)}>
          <div class="feedback-detail">
            <Badge tone={current.data.status === "done" ? "green" : "neutral"}>
              {feedbackStatuses[value(current.data, "status")] || "Neu"}
            </Badge>
            <p class="small muted">
              {current.data.type === "bug" ? "Fehler" : "Idee / Wunsch"} ·{" "}
              {dateLabel(current.createdAt, true)}
            </p>
            <p class="feedback-description">
              <LinkedText text={value(current.data, "description")}></LinkedText>
            </p>
            {#if superadmin}<label>
                Bearbeitungsstatus
                <select value={value(current.data, "status")} disabled={busy} on:change={(event) => void updateStatus(current, event.currentTarget.value)}>
                  {#each Object.entries(feedbackStatuses) as [id, name] (id)}<option value={id}>
                      {name}
                    </option>{/each}
                </select>
              </label>{/if}
            <ErrorMessage message={error}></ErrorMessage>
          </div>
          <footer class="dialog-footer">
            {#if current.data.userId===workspace.user.id}<Button disabled={busy} onClick={()=>void forward(current)}>{supportStates[current.id]?'Supportanfrage aktualisieren':'An Plattform-Support senden'}</Button>{/if}
            {#if current.data.userId === workspace.user.id}<Button onClick={() => setEditing(current)}>Rückmeldung bearbeiten</Button>{/if}
            <Button onClick={() => setDetail(null)}>Schließen</Button>
          </footer>
        </Modal>{/if}
