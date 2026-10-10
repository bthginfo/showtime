import { LinkedText } from "@/components/linked-text";
import { Clock3, MapPin, Pencil, Trash2, Users } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { calendarPresentation } from "@/shared/calendar-categories";
import { dateLabel, ids, instantDate, localDate, shiftDate, value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
import { ExportDialog } from "@/components/export-dialog";
import { TimeBookingEditor } from "@/modules/time-tracking/components/time-booking-editor";
import { EventEditor } from "./event-editor";
import { canManageRecord } from "@/shared/record-permissions";
import { RecordLink } from "@/components/record-link";

export { default as EventDetail } from "./event-detail.EventDetail.svelte";
