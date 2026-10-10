<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { FileText, Table2 } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import type { DocumentFormat } from "../contracts";
import "../documents.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    onCreate: (name: string, format: Exclude<DocumentFormat, "pdf">) => Promise<void>;
    onClose: () => void;
};
export let onCreate: ViewProps["onCreate"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
let name: string = "";
const setName = (next: typeof name | ((current: typeof name) => typeof name)) => { name = typeof next === "function" ? (next as (current: typeof name) => typeof name)(name) : next; };
let format: "text" | "sheet" = initialState<"text" | "sheet">("text");
const setFormat = (next: "text" | "sheet" | ((current: "text" | "sheet") => "text" | "sheet")) => { format = typeof next === "function" ? (next as (current: "text" | "sheet") => "text" | "sheet")(format) : next; };
let busy: boolean = false;
const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => { busy = typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };


</script>

<Modal title="Gemeinsames Dokument anlegen" onClose={() => {
    if (!busy)
        onClose();
}} className="new-document-dialog" initialFocus="#new-document-name">
      <form on:submit={(event) => {
    event.preventDefault();
    if (busy || !name.trim())
        return;
    setBusy(true);
    setError("");
    void onCreate(name.trim(), format).catch((exception) => {
        setError(exception instanceof Error
            ? exception.message
            : "Dokument konnte nicht angelegt werden.");
        setBusy(false);
    });
}}>
        <div class="new-document-types" role="group" aria-label="Dokumentart">
          <button type="button" aria-pressed={format === "text"} class={format === "text" ? "selected" : ""} on:click={() => setFormat("text")} disabled={busy}>
            <FileText size={25}></FileText>
            <strong>Textdokument</strong>
            <span>Texte, Listen & Tabellen</span>
          </button>
          <button type="button" aria-pressed={format === "sheet"} class={format === "sheet" ? "selected" : ""} on:click={() => setFormat("sheet")} disabled={busy}>
            <Table2 size={25}></Table2>
            <strong>Tabelle</strong>
            <span>Zellen & Berechnungen</span>
          </button>
        </div>
        <label for="new-document-name">Name</label>
        <input id="new-document-name" value={name} required maxLength={120} disabled={busy} placeholder="Zum Beispiel: Vorbereitung Abschiedsdinner" on:input={(event) => setName(event.currentTarget.value)} />
        <p class="small muted">
          Alle Personen mit Zugriff auf diesen Bereich arbeiten im selben Dokument.
        </p>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Wird angelegt …" : "Anlegen & öffnen"}
          </Button>
        </footer>
      </form>
    </Modal>
