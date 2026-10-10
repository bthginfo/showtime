<script lang="ts">
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
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { conversationTitle, ChatModule } from "./chat";
const effects=createEffects();
type ViewProps = {
    title: string;
    detail: string;
    icon: LucideIcon;
    selected: boolean;
    kind: "team" | "production" | "direct" | "group";
    unread?: number;
    onSelect: () => void;
};
export let title: ViewProps["title"] = undefined as any;
export let detail: ViewProps["detail"] = undefined as any;
export let icon = undefined as any;
let Icon; $: Icon = icon;
export let selected: ViewProps["selected"] = undefined as any;
export let kind: ViewProps["kind"] = undefined as any;
export let unread: NonNullable<ViewProps["unread"]> = 0;
export let onSelect: ViewProps["onSelect"] = undefined as any;


</script>

<button type="button" class={`channel-choice kind-${kind}${selected ? " active" : ""}`} aria-current={selected ? "page" : undefined} aria-label={unread
    ? `${title} · ${detail} · ${unread} ungelesene ${unread === 1 ? "Nachricht" : "Nachrichten"}`
    : undefined} on:click={onSelect}>
      <span class="channel-choice-icon">
        <svelte:component this={Icon} size={17} aria-hidden="true"></svelte:component>
      </span>
      <span class="channel-choice-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      {#if unread > 0}<span class="chat-unread-count" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>{/if}
      {#if selected}<ChevronRight size={15} className="channel-choice-current" aria-hidden="true"></ChevronRight>{/if}
    </button>
