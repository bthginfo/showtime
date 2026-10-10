import { useViewState } from "@/shared/view-state";
import { ArrowUpRight, Plus, Search, UsersRound } from "@lucide/svelte";
import { Button, Empty, ExportButton, PageHeader } from "@/components/ui";
import { RecordLink } from "@/components/record-link";
import { ExportDialog } from "@/components/export-dialog";
import { useWorkspace } from "@/components/workspace-context";
import { textValue } from "@/shared/contracts";
import { canManageRecord } from "@/shared/record-permissions";
import { PersonEditor } from "./person-editor";
import { PersonContactLinks } from "./person-contact-links";
import { filterPeople, isDirectoryPerson } from "./person-data";
import styles from "./people.module.css";
export type Panel = {
    type: "create" | "export";
} | null;
export { default as PeopleModule } from "./people-module.PeopleModule.svelte";
