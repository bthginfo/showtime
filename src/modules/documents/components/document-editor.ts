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
export const statusLabels = {
    loading: "Wird geöffnet …",
    saved: "Gespeichert",
    saving: "Wird gespeichert …",
    offline: "Offline",
    error: "Nicht gespeichert",
    forbidden: "Zugriff beendet",
};
export { default as DocumentEditor } from "./document-editor.DocumentEditor.svelte";
