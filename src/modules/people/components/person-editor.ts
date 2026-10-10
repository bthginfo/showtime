import { Save } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { textValue, type DomainRecord, type RecordData } from "@/shared/contracts";
import { isDirectoryPerson } from "./person-data";
import styles from "./people.module.css";
export interface PersonEditorProps {
    record?: DomainRecord;
    defaults?: RecordData;
    onClose: () => void;
    onSaved?: (person: DomainRecord) => void;
    /** Inline mode never mounts another form or dialog inside a production form. */
    embedded?: boolean;
    onSelectExisting?: (person: DomainRecord) => void;
}
export const fields = [
    { key: "name", label: "Name", maxLength: 200, required: true, autoComplete: "name" },
    { key: "organization", label: "Organisation", maxLength: 200, autoComplete: "organization" },
    { key: "position", label: "Funktion", maxLength: 200, autoComplete: "organization-title" },
    { key: "email", label: "E-Mail", maxLength: 320, type: "email", autoComplete: "email" },
    { key: "phone", label: "Telefon", maxLength: 100, type: "tel", autoComplete: "tel" },
] as const;
export { default as PersonEditor } from "./person-editor.PersonEditor.svelte";
