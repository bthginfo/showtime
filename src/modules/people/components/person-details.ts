import { LinkedText } from "@/components/linked-text";
import { Building2, Pencil, Trash2 } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { PersonRelationships } from "@/components/record-relationships";
import { useWorkspace } from "@/components/workspace-context";
import { textValue, type DomainRecord } from "@/shared/contracts";
import { canManageRecord } from "@/shared/record-permissions";
import { PersonContactLinks } from "./person-contact-links";
import { PersonEditor } from "./person-editor";
import styles from "./people.module.css";

export { default as PersonDetails } from "./person-details.PersonDetails.svelte";
