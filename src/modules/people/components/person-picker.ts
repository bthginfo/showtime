import { Plus } from "@lucide/svelte";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { textValue, type DomainRecord } from "@/shared/contracts";
import { filterPeople, isDirectoryPerson } from "./person-data";
import { PersonEditor } from "./person-editor";
import { PersonContactLinks } from "./person-contact-links";
import styles from "./people.module.css";
export interface PersonPickerProps {
    value: string;
    onChange: (personId: string) => void;
    disabled?: boolean;
    label?: string;
    onCreated?: (person: DomainRecord) => void;
}
export { default as PersonPicker } from "./person-picker.PersonPicker.svelte";
