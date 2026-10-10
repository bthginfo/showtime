import { ChevronDown, ChevronRight, Hash, MessageCircle, PanelLeftClose, PanelLeftOpen, Plus, Search, Theater, Users, X, type LucideIcon, } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { ids, value } from "@/shared/client-api";
import { canManageRecord } from "@/shared/record-permissions";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal, PageHeader } from "../ui";
import { ChatChannel } from "@/modules/chat/components/chat-channel";
import { ConversationEditor } from "@/modules/chat/components/conversation-editor";
import { chatUnreadCounts } from "@/modules/notifications/unread";
import { chatChoiceKey, unreadFirstChoices, type ChatChoice } from "@/modules/chat/channel-order";
import { ChannelGroup } from "@/modules/chat/components/channel-group";
import { useCollapsedPreference } from "@/shared/use-collapsed-preference";
import styles from "@/modules/chat/components/chat-viewport.module.css";
export function conversationTitle(record: DomainRecord, members: {
    id: string;
    name: string;
}[], self: string) {
    return (value(record.data, "title") ||
        ids(record.data, "participantIds")
            .filter((id) => id !== self)
            .map((id) => members.find((person) => person.id === id)?.name || "Ehemaliges Teammitglied")
            .join(", ") ||
        "Privater Chat");
}
export { default as ChannelChoice } from "./chat.ChannelChoice.svelte";
export { default as ChatModule } from "./chat.ChatModule.svelte";
