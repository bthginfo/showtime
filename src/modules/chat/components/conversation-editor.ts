import type { DomainRecord } from "@/shared/contracts";
import { ids, value } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";

export { default as ConversationEditor } from "./conversation-editor.ConversationEditor.svelte";
