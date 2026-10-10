import { Pencil, Plus, Trash2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { calendarCategoryBehavior } from "@/shared/calendar-categories";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal } from "@/components/ui";

export { default as CategoryEditor } from "./categories-dialog.CategoryEditor.svelte";
export { default as CalendarCategoriesDialog } from "./categories-dialog.CalendarCategoriesDialog.svelte";
