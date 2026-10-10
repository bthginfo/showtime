import { LinkedText } from "@/components/linked-text";
import { ArrowUpRight, Bug, Lightbulb, Plus } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { dateLabel, value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal } from "@/components/ui";
export const feedbackStatuses: Record<string, string> = {
    new: "Neu",
    review: "In Prüfung",
    planned: "Geplant",
    doing: "In Arbeit",
    done: "Umgesetzt",
    closed: "Abgeschlossen",
};
export { default as FeedbackEditor } from "./feedback-panel.FeedbackEditor.svelte";
export { default as FeedbackPanel } from "./feedback-panel.FeedbackPanel.svelte";
