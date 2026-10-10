import type { DomainRecord, RecordData } from "@/shared/contracts";
import { ids, instantDate, localDate, localDateTime, shiftDate, value } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { calendarPresentation } from "@/shared/calendar-categories";
import { calendarCategoryBehavior } from "@/shared/calendar-categories";
import { sortCalendarStaff } from "@/shared/calendar-team";
import { sortProductionsByPremiere } from "@/shared/production-order";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { calendarCategories } from "./client-calendar";

export { default as EventEditor } from "./event-editor.EventEditor.svelte";
