<script lang="ts">
import { Check, ChevronDown, CloudOff, Download, FileText, Loader2, RefreshCw, Save, Table2, Users, } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import type { DomainRecord } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { useSharedDocument } from "../client/use-shared-document";
import { TextEditor } from "./text-editor";
import { SheetEditor } from "./sheet-editor";
import { PdfNotesEditor } from "./pdf-notes-editor";
import "../documents.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { statusLabels } from "./document-editor";
const effects=createEffects();
type ViewProps = {
    file: DomainRecord;
    onClose: () => void;
};
export let file: ViewProps["file"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
const useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store = useSharedDocument(()=>({fileId:file.id,userId:workspace.user.id}));
let client = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.client;
let session = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.session;
let status = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.status;
let connected = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.connected;
let pending = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.pending;
let localReady = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.localReady;
let syncError = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store.error;
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let working: boolean = false;
const setWorking = (next: typeof working | ((current: typeof working) => typeof working)) => { working = typeof next === "function" ? (next as (current: typeof working) => typeof working)(working) : next; };
let leave: boolean = false;
const setLeave = (next: typeof leave | ((current: typeof leave) => typeof leave)) => { leave = typeof next === "function" ? (next as (current: typeof leave) => typeof leave)(leave) : next; };
let activeSheet: string = "";
const setActiveSheet = (next: typeof activeSheet | ((current: typeof activeSheet) => typeof activeSheet)) => { activeSheet = typeof next === "function" ? (next as (current: typeof activeSheet) => typeof activeSheet)(activeSheet) : next; };
let editable = !!session?.canEdit && !["loading", "forbidden"].includes(status);
let attempt = async (fn: () => Promise<void>) => {
    if (working)
        return;
    setWorking(true);
    setError("");
    try {
        await fn();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Aktion fehlgeschlagen.");
    }
    finally {
        setWorking(false);
    }
};
let close = () => void attempt(async () => {
    try {
        await client?.flush();
        if (status !== "forbidden")
            await client?.checkpoint();
        onClose();
    }
    catch (exception) {
        setLeave(true);
        throw exception;
    }
});
let download = (format: string) => void attempt(async () => {
    if (!client)
        return;
    await client.flush();
    const url = `/api/documents/${file.id}/export?format=${format}${format === "csv" && activeSheet ? `&sheet=${encodeURIComponent(activeSheet)}` : ""}`;
    let response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        if (response.status === 409 && failure.code === "document_session_expired") {
            await client.renewSession();
            response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        }
        else
            throw new Error(failure.error || "Die Datei konnte nicht heruntergeladen werden.");
    }
    if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || "Die Datei konnte nicht heruntergeladen werden.");
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    let filename = (session?.name || value(file.data, "name")).replace(/\.[^.]+$/, "") + `.${format}`;
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i), quoted = disposition.match(/filename="([^"]+)"/i);
    if (encoded) {
        try {
            filename = decodeURIComponent(encoded[1]);
        }
        catch {
            /* Use safe fallback. */
        }
    }
    else if (quoted)
        filename = quoted[1];
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
});
let mainFormat = session?.format === "sheet" ? "xlsx" : session?.format === "pdf" ? "pdf" : "docx";
let alternatives = session?.format === "sheet"
    ? ["xlsx", "csv", "pdf"]
    : session?.format === "pdf"
        ? ["pdf"]
        : ["docx", "pdf", "txt"];
let StatusIcon = status === "saving" || status === "loading" ? Loader2 : status === "offline" ? CloudOff : Check;

$: ({ client, session, status, connected, pending, localReady, error: syncError, } = $useSharedDocument___client__session__status__connected__pending__localReady__error__syncError___Store);
$: editable = !!session?.canEdit && !["loading", "forbidden"].includes(status);



$: mainFormat = session?.format === "sheet" ? "xlsx" : session?.format === "pdf" ? "pdf" : "docx";
$: alternatives = session?.format === "sheet"
    ? ["xlsx", "csv", "pdf"]
    : session?.format === "pdf"
        ? ["pdf"]
        : ["docx", "pdf", "txt"];
$: StatusIcon = status === "saving" || status === "loading" ? Loader2 : status === "offline" ? CloudOff : Check;

</script>

<Modal title={session?.name || value(file.data, "name") || "Gemeinsames Dokument"} onClose={close} wide className="document-editor-dialog">
      <div class="document-editor-heading">
        <div class="document-shared-label">
          <Users size={16}></Users>
          <span>Gemeinsames Dokument</span>
          {#if session && !session.canEdit}<span class="badge">Nur lesen</span>{/if}
        </div>
        <span class={`document-save-status ${status}`} role="status" title={pending && status === "offline" ? "Noch nicht an das Team übertragen" : undefined}>
          <svelte:component this={StatusIcon} size={15} className={status === "saving" || status === "loading" ? "spin" : ""}></svelte:component>
          {statusLabels[status]}
          {status === "offline" && pending && localReady ? " · auf diesem Gerät" : ""}
        </span>
        <span class={`document-live-dot ${connected ? "connected" : ""}`} title={connected
    ? "Änderungen werden live mit dem Team geteilt"
    : "Live-Verbindung wird wiederhergestellt"} aria-label={connected ? "Live verbunden" : "Live-Verbindung pausiert"}></span>
      </div>
      {#if (error || syncError)}<div class="document-sync-error">
          <ErrorMessage message={error || syncError}></ErrorMessage>
          {#if status !== "forbidden"}<Button disabled={working} onClick={() => void attempt(async () => {
    await client?.retry();
})}>
              <RefreshCw size={15}></RefreshCw> Erneut versuchen
            </Button>{/if}
        </div>{/if}
      {#if leave}<div class="document-close-warning" role="alert">
          <p>
            {localReady
    ? "Diese Änderungen sind noch nicht beim Team gespeichert. Du kannst sie auf diesem Gerät behalten und später übertragen."
    : "Diese Änderungen konnten noch nicht gespeichert werden. Lass das Dokument geöffnet, bis die Verbindung wieder verfügbar ist."}
          </p>
          {#if localReady}<Button onClick={onClose}>Lokal behalten & schließen</Button>{/if}
        </div>{/if}
      {#if session && session.metadata.warnings.length > 0}<details class="document-import-info">
          <summary>
            Hinweise zur übernommenen Datei <ChevronDown size={15}></ChevronDown>
          </summary>
          <ul>
            {#each session.metadata.warnings as warning, i (i)}<li>{warning}</li>{/each}
          </ul>
          <p>
            Die ursprüngliche Datei bleibt erhalten. Herunterladen enthält euren aktuellen
            gemeinsamen Stand.
          </p>
        </details>{/if}
      {#if status === "loading"}<div class="document-loading">
          <Loader2 size={30} className="spin"></Loader2>
          <strong>Dokument wird geöffnet …</strong>
          <p>Der gemeinsame Stand wird geladen.</p>
        </div>{:else}{#if !session}<div class="document-loading">
          <FileText size={32}></FileText>
          <strong>Das Dokument konnte nicht geöffnet werden.</strong>
          <p>Versuche es mit einer aktiven Verbindung erneut.</p>
        </div>{:else}{#if status === "forbidden"}<div class="document-loading">
          <FileText size={32}></FileText>
          <strong>Dieses Dokument ist nicht mehr zugänglich.</strong>
        </div>{:else}<div class="document-editor-canvas">
          {#if session.format === "text"}<TextEditor doc={client!.doc} editable={editable}></TextEditor>{:else}{#if session.format === "sheet"}<SheetEditor doc={client!.doc} info={session.metadata.sheets || []} editable={editable} onSheetChange={setActiveSheet}></SheetEditor>{:else}<PdfNotesEditor doc={client!.doc} fileId={file.id} pages={session.metadata.pdfPages || 1} user={workspace.user} editable={editable}></PdfNotesEditor>{/if}{/if}
        </div>{/if}{/if}{/if}
      <footer class="document-editor-footer">
        <a class="document-original-link" aria-label="Originaldatei herunterladen" title="Originaldatei herunterladen" href={`/api/files/${file.id}`} download={session?.metadata.sourceName || value(file.data, "name")}>
          <Download size={15}></Download> Original
        </a>
        <div class="document-footer-actions">
          {#if session?.canEdit}<Button disabled={working || !editable} onClick={() => void attempt(async () => {
    await client?.checkpoint();
})}>
            <Save size={15}></Save>
            {working ? "Bitte warten …" : "Speichern"}
          </Button>{/if}
          <div class="document-download-group">
            <Button variant="primary" disabled={working || !session || status === "forbidden"} onClick={() => download(mainFormat)}>
              <Download size={16}></Download>
              <span>Herunterladen</span>
              <span class="document-format-label">{mainFormat.toUpperCase()}</span>
            </Button>
            <details class="document-download-options">
              <summary class="button primary" aria-label="Weitere Download-Formate">
                <ChevronDown size={16}></ChevronDown>
              </summary>
              <div class="document-download-menu">
                {#each alternatives as format (format)}<button disabled={working || !session} on:click={() => download(format)}>
                    {#if format === "xlsx"}<Table2 size={16}></Table2>{:else}<FileText size={16}></FileText>{/if}
                    {format === "txt"
    ? "Text (.txt)"
    : format === "csv"
        ? "CSV (aktuelles Blatt)"
        : format.toUpperCase()}{" "}
                    herunterladen
                  </button>{/each}
              </div>
            </details>
          </div>
        </div>
      </footer>
    </Modal>
