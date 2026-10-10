import { CalendarRange, Pencil, Plus, Trash2, X } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { numberValue, textValue } from "@/shared/contracts";
import { dateLabel, instantDate, localDate, localDateTime, post, shiftDate, } from "@/shared/client-api";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { canManageRecord } from "@/shared/record-permissions";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
import { ExportDialog } from "@/components/export-dialog";
import styles from "@/modules/workflows/components/workflow.module.css";

export { default as MaterialReservations } from "./material-reservations.MaterialReservations.svelte";
export { default as ReservationEditor } from "./material-reservations.ReservationEditor.svelte";
