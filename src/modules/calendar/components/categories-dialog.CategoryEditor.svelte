<script lang="ts">
import { Pencil, Plus, Trash2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { calendarCategoryBehavior } from "@/shared/calendar-categories";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { CalendarCategoriesDialog } from "./categories-dialog";
const effects=createEffects();
type ViewProps = {
    record?: DomainRecord;
    onClose: () => void;
};
export let record: ViewProps["record"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { save, busy } = $workspaceStore;
$: ({ save, busy } = $workspaceStore);
let name = value(record?.data || {}, "name");
const setName = (next: typeof name | ((current: typeof name) => typeof name)) => { name = typeof next === "function" ? (next as (current: typeof name) => typeof name)(name) : next; };
let color = value(record?.data || {}, "color") || "#377a68";
const setColor = (next: typeof color | ((current: typeof color) => typeof color)) => { color = typeof next === "function" ? (next as (current: typeof color) => typeof color)(color) : next; };
let allDay = record?.data.allDay === true;
const setAllDay = (next: typeof allDay | ((current: typeof allDay) => typeof allDay)) => { allDay = typeof next === "function" ? (next as (current: typeof allDay) => typeof allDay)(allDay) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };


</script>

<Modal title={`Kalenderart ${record ? "bearbeiten" : "anlegen"}`} onClose={onClose}>
      <form class="category-form" on:submit={async (event) => {
    event.preventDefault();
    setError("");
    try {
        await save("calendarCategories", {
            key: record ? value(record.data, "key") : `category-${crypto.randomUUID()}`,
            name: name.trim(),
            color,
            allDay,
        }, record);
        onClose();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
    }
}}>
        <label>
          Bezeichnung
          <input required maxLength={200} value={name} on:input={(event) => setName(event.currentTarget.value)} />
        </label>
        <label>
          Farbe
          <input type="color" value={color} on:input={(event) => setColor(event.currentTarget.value)} />
        </label>
        <label class="check-label">
          <input type="checkbox" checked={allDay} on:input={(event) => setAllDay(event.currentTarget.checked)} />
          Ganztägig ohne Uhrzeiten
        </label>
        <p class="small muted">
          Bei bereits verwendeten Arten bleiben der Zeitmodus und bestehende Termine erhalten. Name
          und Farbe lassen sich ändern, solange die Bedeutung erhalten bleibt.
        </p>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            Speichern
          </Button>
        </footer>
      </form>
    </Modal>
