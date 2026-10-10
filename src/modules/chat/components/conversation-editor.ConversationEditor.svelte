<script lang="ts">
import {hasPermission} from "@/platform/access";
import type { DomainRecord } from "@/shared/contracts";
import { ids, value } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    record?: DomainRecord;
    initialMode?: "direct" | "group" | "team";
    onClose: () => void;
    onSaved: (record: DomainRecord) => void;
};
export let record: ViewProps["record"] = undefined as any;
export let initialMode: NonNullable<ViewProps["initialMode"]> = "direct";
export let onClose: ViewProps["onClose"] = undefined as any;
export let onSaved: ViewProps["onSaved"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, busy } = $workspaceStore;
$: ({ workspace, save, busy } = $workspaceStore);
let mode = value(record?.data || {}, "mode") || initialMode;
let scope=value(record?.data||{},"scope")||"department";
$: houseChannels=hasPermission({id:workspace.user.id,grants:workspace.user.grants||[]},"chat.channels.manage",{departmentId:""});
const setMode = (next: typeof mode | ((current: typeof mode) => typeof mode)) => { mode = typeof next === "function" ? (next as (current: typeof mode) => typeof mode)(mode) : next; };
let title = value(record?.data || {}, "title");
const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => { title = typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next; };
let people = ids(record?.data || {}, "participantIds").filter((id) => id !== workspace.user.id);
const setPeople = (next: typeof people | ((current: typeof people) => typeof people)) => { people = typeof next === "function" ? (next as (current: typeof people) => typeof people)(people) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let members = workspace.members.filter((member) => member.id !== workspace.user.id && (isActiveStaff(member) || people.includes(member.id)));
let teamChannel = mode === "team";

$: members = workspace.members.filter((member) => member.id !== workspace.user.id && (isActiveStaff(member) || people.includes(member.id)));
$: teamChannel = mode === "team";

</script>

<Modal title={teamChannel
    ? record
        ? "Teamkanal bearbeiten"
        : "Teamkanal anlegen"
    : record
        ? "Privaten Chat bearbeiten"
        : "Privaten Chat starten"} onClose={onClose}>
      <form class="conversation-form" on:submit={async (event) => {
    event.preventDefault();
    setError("");
    try {
        if (teamChannel && !title.trim())
            throw new Error("Bitte gib dem Teamkanal einen Namen.");
        if (!teamChannel && (!people.length || (mode === "direct" && people.length !== 1)))
            throw new Error(mode === "direct"
                ? "Wähle genau eine weitere Person."
                : "Wähle mindestens eine weitere Person.");
        const saved = await save("conversations", {
            title: title.trim(),
            mode,
            scope:teamChannel?scope:undefined,
            participantIds: teamChannel ? [] : [workspace.user.id, ...people],
        }, record);
        onSaved(saved);
        onClose();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
    }
}}>
        <p class="muted booking-intro">
          {teamChannel
    ? "Alle aktiven Mitglieder des gewählten Bereichs können hier mitlesen und schreiben."
    : "Nur die Teilnehmenden können Nachrichten und Dateien dieses Chats lesen. Du bist automatisch dabei."}
        </p>
        {#if teamChannel}<label>Bereich<select bind:value={scope} disabled={!!record}><option value="department">{workspace.department.name}</option>{#if houseChannels}<option value="theater">Gesamtes Theater</option>{/if}</select></label>{/if}
        {#if !teamChannel}<fieldset class="booking-mode">
            <legend>Chatart</legend>
            <div class="feedback-type-options">
              <label>
                <input type="radio" name="chat-mode" checked={mode === "direct"} disabled={!!record} on:input={() => {
    setMode("direct");
    setPeople(people.slice(0, 1));
}} />
                Direktchat
              </label>
              <label>
                <input type="radio" name="chat-mode" checked={mode === "group"} disabled={!!record} on:input={() => setMode("group")} />
                Gruppe
              </label>
            </div>
          </fieldset>{/if}
        {#if (mode === "group" || teamChannel)}<label>
            {teamChannel ? "Kanalname" : "Gruppenname (optional)"}
            <input required={teamChannel} maxLength={200} value={title} on:input={(event) => setTitle(event.currentTarget.value)} placeholder={teamChannel
    ? "Zum Beispiel Werkstatt oder Dienstplanung"
    : "Zum Beispiel Frühdienst"} />
          </label>{/if}
        {#if !teamChannel}<fieldset class="form-multi">
            <legend>{mode === "direct" ? "Mit wem möchtest du schreiben?" : "Teilnehmende"}</legend>
            {#each members as member (member.id)}<label class="check-label">
                <input type={mode === "direct" ? "radio" : "checkbox"} name="chat-person" disabled={!!record && mode === "direct"} checked={people.includes(member.id)} on:input={(event) => setPeople(mode === "direct"
    ? [member.id]
    : event.currentTarget.checked
        ? [...people, member.id]
        : people.filter((id) => id !== member.id))} />
                {member.name}
                {#if !isActiveStaff(member)}<span class="small muted"> · historische Zuordnung (entfernen)</span>{/if}
              </label>{/each}
          </fieldset>{/if}
        {#if record && mode === "direct"}<p class="small muted">
            Die beiden Personen eines Direktchats bleiben fest zugeordnet.
          </p>{/if}
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" disabled={busy || (teamChannel ? !title.trim() : !people.length)}>
            {record ? "Speichern" : teamChannel ? "Kanal anlegen" : "Chat starten"}
          </Button>
        </footer>
      </form>
    </Modal>
