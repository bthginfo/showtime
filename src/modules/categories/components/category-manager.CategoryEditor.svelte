<script lang="ts">
import { Pencil, Plus, Trash2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { categoriesFor, type CategoryScope } from "@/shared/domain-categories";
import { value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { scopes, CategoryManager } from "./category-manager";
const effects=createEffects();
type ViewProps = {
    scope: CategoryScope;
    record?: DomainRecord;
    onClose: () => void;
};
export let scope: ViewProps["scope"] = undefined as any;
export let record: ViewProps["record"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { save, busy } = $workspaceStore;
$: ({ save, busy } = $workspaceStore);
let name = value(record?.data || {}, "name");
const setName = (next: typeof name | ((current: typeof name) => typeof name)) => { name = typeof next === "function" ? (next as (current: typeof name) => typeof name)(name) : next; };
let color = value(record?.data || {}, "color") || "#377a68";
const setColor = (next: typeof color | ((current: typeof color) => typeof color)) => { color = typeof next === "function" ? (next as (current: typeof color) => typeof color)(color) : next; };
let order = numberDraft(record?.data.order, 0);
const setOrder = (next: typeof order | ((current: typeof order) => typeof order)) => { order = typeof next === "function" ? (next as (current: typeof order) => typeof order)(order) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };


</script>

<Modal title={`Kategorie ${record ? "bearbeiten" : "anlegen"}`} onClose={onClose}>
      <form class="category-form" on:submit={async (event) => {
    event.preventDefault();
    setError("");
    try {
        await save("categories", {
            scope,
            key: record ? record.data.key : `category-${crypto.randomUUID()}`,
            name: name.trim(),
            color,
            order: parseNumberDraft(order, {
                label: "Reihenfolge",
                fallback: 0,
                min: 0,
                max: 10000,
                integer: true,
            }),
        }, record);
        onClose();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
    }
}}>
        <label>
          Bezeichnung
          <input required maxLength={100} value={name} on:input={(event) => setName(event.currentTarget.value)} />
        </label>
        <label>
          Farbe
          <input type="color" value={color} on:input={(event) => setColor(event.currentTarget.value)} />
        </label>
        <label>
          Reihenfolge
          <input type="number" min={0} max={10000} value={order} on:input={(event) => setOrder(event.currentTarget.value)} />
        </label>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Speichern
          </Button>
        </footer>
      </form>
    </Modal>
