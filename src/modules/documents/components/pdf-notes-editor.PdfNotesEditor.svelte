<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import * as Y from "yjs";
import { Plus, Trash2 } from "@lucide/svelte";
import { Button } from "@/components/ui";
import type { Member } from "@/shared/contracts";
import { PDF_NOTES } from "../contracts";
import { NOTE_EDIT } from "../client/shared-document";
import { useDocumentRevision } from "../client/use-document-revision";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { replaceText } from "./pdf-notes-editor";
import PdfPreview from "./pdf-preview.svelte";
const effects=createEffects();
type ViewProps = {
    doc: Y.Doc;
    fileId: string;
    pages: number;
    user: Member;
    editable: boolean;
};
export let doc: ViewProps["doc"] = undefined as any;
export let fileId: ViewProps["fileId"] = undefined as any;
export let pages: ViewProps["pages"] = undefined as any;
export let user: ViewProps["user"] = undefined as any;
export let editable: ViewProps["editable"] = undefined as any;
const documentRevisionStore=useDocumentRevision(doc);
let notes: any = doc.getArray<Y.Map<unknown>>(PDF_NOTES);
let tab: "file" | "notes" = initialState<"file" | "notes">(editable ? "notes" : "file");
const setTab = (next: "file" | "notes" | ((current: "file" | "notes") => "file" | "notes")) => { tab = typeof next === "function" ? (next as (current: "file" | "notes") => "file" | "notes")(tab) : next; };
let page: number = 1;
const setPage = (next: typeof page | ((current: typeof page) => typeof page)) => { page = typeof next === "function" ? (next as (current: typeof page) => typeof page)(page) : next; };
let addNote = () => doc.transact(() => {
    const note = new Y.Map<unknown>();
    note.set("id", crypto.randomUUID());
    note.set("page", page);
    note.set("authorId", user.id);
    note.set("authorName", user.name);
    note.set("createdAt", new Date().toISOString());
    note.set("text", new Y.Text());
    notes.push([note]);
}, NOTE_EDIT);

$: void $documentRevisionStore;
$: { void $documentRevisionStore; notes = doc.getArray<Y.Map<unknown>>(PDF_NOTES); }


</script>

<div class={`shared-pdf-editor show-${tab}`}>
      <div class="pdf-mobile-tabs segmented">
        <button class={tab === "file" ? "active" : ""} aria-pressed={tab === "file"} on:click={() => setTab("file")}>
          PDF ansehen
        </button>
        <button class={tab === "notes" ? "active" : ""} aria-pressed={tab === "notes"} on:click={() => setTab("notes")}>
          Gemeinsame Notizen
        </button>
      </div>
      <div class="pdf-original-view">
        <PdfPreview {fileId} bind:page />
        <a class="text-button" href={`/api/files/${fileId}`} target="_blank" rel="noreferrer">
          PDF in groß öffnen ↗
        </a>
      </div>
      <section class="pdf-notes-panel" aria-label="Gemeinsame Notizen">
        <header>
          <h3>Gemeinsame Notizen</h3>
          <p class="small muted">
            Eure Hinweise werden beim PDF-Download als zusätzliche Seiten angefügt.
          </p>
        </header>
        {#if editable}<div class="pdf-add-note">
          <label>
            Seite
            <select value={page} aria-label="PDF-Seite" on:change={(event) => setPage(Number(event.currentTarget.value))}>
              {#each Array.from({ length: Math.max(1, pages) }) as _, i (i)}<option value={i + 1}>
                  {i + 1}
                </option>{/each}
            </select>
          </label>
          <Button disabled={!editable} onClick={addNote}>
            <Plus size={16}></Plus> Notiz
          </Button>
        </div>{/if}
        <div class="pdf-notes-list">
          {#if notes.length}{#each notes.toArray() as note, index (String(note.get("id")))}{@const text = note.get("text")}<article class="pdf-shared-note">
                  <header>
                    <span>Seite {String(note.get("page"))}</span>
                    <span class="small muted">{String(note.get("authorName") || "Team")}</span>
                    {#if editable}<button class="icon-button" aria-label={`Notiz auf Seite ${note.get("page")} löschen`} on:click={() => doc.transact(() => notes.delete(index, 1), NOTE_EDIT)}>
                        <Trash2 size={15}></Trash2>
                      </button>{/if}
                  </header>
                  <textarea aria-label={`Notiz auf Seite ${note.get("page")} von ${note.get("authorName")}`} rows={4} maxLength={10000} readonly={!editable} value={text instanceof Y.Text ? text.toString() : ""} placeholder="Was möchtest du dem Team dazu sagen?" on:input={(event) => {
    if (text instanceof Y.Text && editable)
        doc.transact(() => replaceText(text, event.currentTarget.value), NOTE_EDIT);
}}></textarea>
                </article>{/each}{:else}<div class="document-notes-empty">
              <strong>Noch keine Notizen</strong>
              <p>{editable ? "Wähle eine Seite und ergänze euren ersten Hinweis." : "Zu diesem PDF liegen keine gemeinsamen Notizen vor."}</p>
            </div>{/if}
        </div>
      </section>
    </div>
