import { categoriesFor } from "@/shared/domain-categories";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { ApiFailure, hours, instantDate, localDate, localDateTime, num, value, } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { numberDraft, parseNumberDraft, previewNumberDraft } from "@/shared/number-draft";
import { clearTimeDraft, retainTimeDraft, timeDraftQueueKey } from "../client-drafts";
import styles from "./time-history.module.css";

export { default as TimeBookingEditor } from "./time-booking-editor.TimeBookingEditor.svelte";
