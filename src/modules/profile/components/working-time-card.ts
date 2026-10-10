import { Check, Clock3, Trash2 } from "@lucide/svelte";
import type { Member } from "@/shared/contracts";
import { localDate, weekStart, dateLabel, hours } from "@/shared/client-api";
import { isStaff } from "@/shared/client-members";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { currentWorkingSchedule, defaultWorkingDays, workingDayLabels, type WorkingTimeSchedule, } from "@/shared/working-time";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal, Section } from "@/components/ui";
import { signedHours } from "@/modules/time-tracking/balance";
import styles from "./working-time-card.module.css";

export { default as WorkingTimeCard } from "./working-time-card.WorkingTimeCard.svelte";
export { default as WorkingTimeForm } from "./working-time-card.WorkingTimeForm.svelte";
