<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { FileText, Plus, Trash2, Upload } from "@lucide/svelte";
  import { Button, Empty, ErrorMessage } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { canManageRecord } from "@/shared/record-permissions";
  import type { DomainRecord } from "@/shared/contracts";
  import { api, post, value } from "@/shared/client-api";
  import { imageAccept, prepareUpload } from "@/shared/client-files";
  import { DocumentAttachment } from "./document-attachment";
  import { NewDocumentDialog } from "./new-document-dialog";
  import "../documents.css";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { DocumentEditor, documentAccept } from "./record-documents";
  const effects = createEffects();
  type ViewProps = {
    record: DomainRecord;
  };
  export let record: ViewProps["record"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, refresh, removeFile } = $workspaceStore;
  $: ({ workspace, refresh, removeFile } = $workspaceStore);
  let creating: boolean = false;
  const setCreating = (next: typeof creating | ((current: typeof creating) => typeof creating)) => {
    creating =
      typeof next === "function"
        ? (next as (current: typeof creating) => typeof creating)(creating)
        : next;
  };
  let opened: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setOpened = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    opened =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(opened)
        : next;
  };
  let busy: boolean = false;
  const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => {
    busy =
      typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let files = workspace.records.files.filter(
    (file) => file.data.recordKind === record.kind && file.data.recordId === record.id,
  );
  let canEdit = canManageRecord(workspace.user, record.kind, record);
  let upload = async (selected: FileList | null) => {
    if (!selected?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(selected)) {
        const form = new FormData();
        form.append("file", await prepareUpload(file));
        form.append("recordKind", record.kind);
        form.append("recordId", record.id);
        await api("/api/files", { method: "POST", body: form });
      }
      await refresh();
    } catch (exception) {
      setError(
        exception instanceof Error ? exception.message : "Datei konnte nicht hochgeladen werden.",
      );
    } finally {
      setBusy(false);
    }
  };

  $: files = workspace.records.files.filter(
    (file) => file.data.recordKind === record.kind && file.data.recordId === record.id,
  );
  $: canEdit = canManageRecord(workspace.user, record.kind, record);
</script>

<section class="record-documents">
  <header class="record-documents-heading">
    <h2>Dokumente</h2>
    <div class="heading-actions">
      {#if canEdit}
        <label class="button secondary">
          <Upload size={16}></Upload>
          {busy ? "Lädt hoch …" : "Hochladen"}
          <input
            class="visually-hidden"
            type="file"
            accept={documentAccept}
            multiple
            disabled={busy}
            on:input={(event) => {
              void upload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <Button variant="primary" disabled={busy} onClick={() => setCreating(true)}>
          <Plus size={16}></Plus> Dokument anlegen
        </Button>
      {/if}
    </div>
  </header>
  <ErrorMessage message={error}></ErrorMessage>
  {#if files.length}<div class="record-document-list">
      {#each files as file (file.id)}<article>
          <FileText size={20} className="record-document-icon"></FileText>
          <div>
            <DocumentAttachment {file} compact></DocumentAttachment>
            <span class="small muted">
              {dateLabel(file.createdAt)} ·{" "}
              {value(file.data, "mime").startsWith("image/") ? "Bild" : "Gemeinsame Datei"}
            </span>
          </div>
          {#if canEdit}<button
              class="icon-button"
              aria-label={`${value(file.data, "name")} löschen`}
              disabled={busy}
              on:click={() => {
                if (!confirm("Datei und ihren gemeinsamen Bearbeitungsstand löschen?")) return;
                setBusy(true);
                setError("");
                void removeFile(file)
                  .catch((exception) =>
                    setError(
                      exception instanceof Error ? exception.message : "Löschen fehlgeschlagen.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <Trash2 size={16}></Trash2>
            </button>{/if}
        </article>{/each}
    </div>{:else}<Empty
      title="Platz für eure gemeinsamen Dokumente."
      description="Lade Word, Excel oder PDF hoch oder starte ein neues Textdokument. Ihr arbeitet alle am selben Stand und könnt ihn wieder herunterladen."
    ></Empty>{/if}
  {#if creating}<NewDocumentDialog
      onClose={() => setCreating(false)}
      onCreate={async (name, format) => {
        const file = await post<DomainRecord>("/api/documents", {
          recordKind: record.kind,
          recordId: record.id,
          name,
          format,
        });
        await refresh();
        setCreating(false);
        setOpened(file);
      }}
    ></NewDocumentDialog>{/if}
  {#if opened}<DocumentEditor file={opened} onClose={() => setOpened(null)}></DocumentEditor>{/if}
</section>
