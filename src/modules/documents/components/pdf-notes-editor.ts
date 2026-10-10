import * as Y from "yjs";
import { Plus, Trash2 } from "@lucide/svelte";
import { Button } from "@/components/ui";
import type { Member } from "@/shared/contracts";
import { PDF_NOTES } from "../contracts";
import { NOTE_EDIT } from "../client/shared-document";
import { useDocumentRevision } from "../client/use-document-revision";
export function replaceText(text: Y.Text, value: string) {
    const original = text.toString();
    let prefix = 0, suffix = 0;
    while (prefix < original.length && prefix < value.length && original[prefix] === value[prefix])
        prefix++;
    while (suffix < original.length - prefix &&
        suffix < value.length - prefix &&
        original[original.length - suffix - 1] === value[value.length - suffix - 1])
        suffix++;
    if (original.length - prefix - suffix > 0)
        text.delete(prefix, original.length - prefix - suffix);
    if (value.length - prefix - suffix > 0)
        text.insert(prefix, value.slice(prefix, value.length - suffix));
}
export { default as PdfNotesEditor } from "./pdf-notes-editor.PdfNotesEditor.svelte";
