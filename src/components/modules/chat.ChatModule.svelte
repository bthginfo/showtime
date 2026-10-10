<script lang="ts">
import {memberCan} from "@/shared/access-policy";import { initialState } from '@/shared/svelte-runtime';

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
import { conversationTitle, ChannelChoice } from "./chat";
const effects=createEffects();
type ViewProps = {
    productionId?: string;
    conversationId?: string;
    onNavigate?: (conversationId: string, productionId?: string) => void;
};
export let productionId: NonNullable<ViewProps["productionId"]> = "";
export let conversationId: NonNullable<ViewProps["conversationId"]> = "";
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, remove, busy, online } = $workspaceStore;
$: ({ workspace, save, remove, busy, online } = $workspaceStore);
let viewport = {current: null as HTMLDivElement | null};
$: effects.run(0, () => {
    const panel = viewport.current;
    if (!panel)
        return;
    const visual = window.visualViewport;
    const resize = () => {
        // Safari's keyboard resizes the visual viewport, independently of the page.
        const height = visual?.height || window.innerHeight;
        const navigation = document.querySelector<HTMLElement>(".bottom-nav");
        const mobile = window.matchMedia("(max-width: 1100px)").matches;
        if (mobile) {
            const visualBottom = (visual?.offsetTop || 0) + height;
            const nav = navigation?.getBoundingClientRect();
            const navigationOverlap = nav && nav.height ? Math.max(0, visualBottom - nav.top) : 0;
            const available = Math.max(0, visualBottom - panel.getBoundingClientRect().top - navigationOverlap - 8);
            panel.style.setProperty("--chat-available-height", `${Math.round(available)}px`);
            panel.dataset.chatCompact = String(height < 560);
            return;
        }
        const bottomGap = 24;
        const top = Math.min(Math.max(0, panel.getBoundingClientRect().top + window.scrollY), height * 0.4);
        const available = Math.min(760, Math.max(280, height - top - bottomGap), Math.max(220, height - bottomGap));
        panel.style.setProperty("--chat-available-height", `${Math.round(available)}px`);
        panel.dataset.chatCompact = String(height < 560);
    };
    resize();
    window.addEventListener("resize", resize);
    visual?.addEventListener("resize", resize);
    visual?.addEventListener("scroll", resize);
    return () => {
        window.removeEventListener("resize", resize);
        visual?.removeEventListener("resize", resize);
        visual?.removeEventListener("scroll", resize);
    };
}, [online]);
let unread = chatUnreadCounts(workspace.records.notifications, workspace.user.id);
const sidebarId = createId();
let sidebarKey = `digitalmask:chat-sidebar:${workspace.user.id}`;
const collapsedStore = useCollapsedPreference<any>(sidebarKey);
let collapsed: any = $collapsedStore; $: collapsed = $collapsedStore;
const setCollapsed = collapsedStore.set;
let toggleSidebar = () => setCollapsed(!collapsed);
let selection = { conversationId, productionId };
const setSelection = (next: typeof selection | ((current: typeof selection) => typeof selection)) => { selection = typeof next === "function" ? (next as (current: typeof selection) => typeof selection)(selection) : next; };
let channelToggle = {current: null as HTMLButtonElement | null};
let channelsOpen: boolean = false;
const setChannelsOpen = (next: typeof channelsOpen | ((current: typeof channelsOpen) => typeof channelsOpen)) => { channelsOpen = typeof next === "function" ? (next as (current: typeof channelsOpen) => typeof channelsOpen)(channelsOpen) : next; };
let search: string = "";
const setSearch = (next: typeof search | ((current: typeof search) => typeof search)) => { search = typeof next === "function" ? (next as (current: typeof search) => typeof search)(search) : next; };
$: effects.run(1, () => {
    if (!channelsOpen)
        return;
    const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            setChannelsOpen(false);
            channelToggle.current?.focus();
        }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
}, [channelsOpen]);
let editor: DomainRecord | "new" | "new-team" | null = initialState<DomainRecord | "new" | "new-team" | null>(null);
const setEditor = (next: DomainRecord | "new" | "new-team" | null | ((current: DomainRecord | "new" | "new-team" | null) => DomainRecord | "new" | "new-team" | null)) => { editor = typeof next === "function" ? (next as (current: DomainRecord | "new" | "new-team" | null) => DomainRecord | "new" | "new-team" | null)(editor) : next; };
let manage: boolean = false;
const setManage = (next: typeof manage | ((current: typeof manage) => typeof manage)) => { manage = typeof next === "function" ? (next as (current: typeof manage) => typeof manage)(manage) : next; };
let archived: boolean = false;
const setArchived = (next: typeof archived | ((current: typeof archived) => typeof archived)) => { archived = typeof next === "function" ? (next as (current: typeof archived) => typeof archived)(archived) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let locked = !!productionId && !onNavigate;
let selectedConversation = onNavigate ? conversationId : selection.conversationId;
let selectedProduction = locked ? productionId : onNavigate ? productionId : selection.productionId;
let selectedUnread = selectedConversation
    ? unread.conversations[selectedConversation] || 0
    : selectedProduction
        ? unread.productions[selectedProduction] || 0
        : unread.general;
let otherUnread = Math.max(0, unread.total - selectedUnread);
let visibleConversations = (workspace.records.conversations || []).filter((record) => record.data.mode === "team" || ids(record.data, "participantIds").includes(workspace.user.id));
let conversation = visibleConversations.find((record) => record.id === selectedConversation);
let query = search.trim().toLocaleLowerCase("de");
let matches = (text: string) => !query || text.toLocaleLowerCase("de").includes(query);
let productions = workspace.records.productions.filter((record) => record.data.status !== "archived");
let matchingProductions = productions.filter((record) => matches(value(record.data, "title")));
let channels = visibleConversations.filter((record) => archived || record.data.archived !== true);
let teamChannels = channels.filter((record) => record.data.mode === "team");
let matchingTeamChannels = teamChannels.filter((record) => matches(value(record.data, "title")));
let privateChats = channels.filter((record) => record.data.mode !== "team");
let matchingChats = privateChats.filter((record) => matches([
    conversationTitle(record, workspace.members, workspace.user.id),
    ...ids(record.data, "participantIds").map((id) => workspace.members.find((member) => member.id === id)?.name || ""),
].join(" ")));
let showGeneral = matches((workspace.department.name+" · Allgemein Teamkanal"));
let choices: ChatChoice[] = [
    ...(showGeneral
        ? [
            {
                key: "general",
                title: (workspace.department.name+" · Allgemein"),
                detail: (workspace.department.name+" · Gewerkkanal"),
                kind: "team" as const,
                conversationId: "",
                productionId: "",
                unread: unread.general,
            },
        ]
        : []),
    ...matchingTeamChannels.map((record): ChatChoice => ({
        key: chatChoiceKey(record.id),
        title: value(record.data, "title"),
        detail: record.data.archived === true ? "Archiviert · Teamkanal" : (workspace.department.name+" · Gewerkkanal"),
        kind: "team",
        conversationId: record.id,
        productionId: "",
        unread: unread.conversations[record.id] || 0,
    })),
    ...matchingProductions.map((record): ChatChoice => ({
        key: chatChoiceKey("", record.id),
        title: value(record.data, "title"),
        detail: "Absprachen zum Stück",
        kind: "production",
        conversationId: "",
        productionId: record.id,
        unread: unread.productions[record.id] || 0,
    })),
    ...matchingChats.map((record): ChatChoice => ({
        key: chatChoiceKey(record.id),
        title: conversationTitle(record, workspace.members, workspace.user.id),
        detail: record.data.archived === true
            ? "Archiviert · privat"
            : record.data.mode === "direct"
                ? "Persönliches Gespräch · privat"
                : `${ids(record.data, "participantIds").length} Teilnehmende · privat`,
        kind: record.data.mode === "direct" ? "direct" : "group",
        conversationId: record.id,
        productionId: "",
        unread: unread.conversations[record.id] || 0,
    })),
];
let ordered = unreadFirstChoices(choices, workspace.records.messages, workspace.records.notifications, workspace.user.id);
let icons = { team: Hash, production: Theater, direct: MessageCircle, group: Users };
let SelectedIcon = conversation
    ? conversation.data.mode === "team"
        ? Hash
        : conversation.data.mode === "direct"
            ? MessageCircle
            : Users
    : selectedProduction
        ? Theater
        : Hash;
const renderChoice = true;
let title = conversation
    ? conversationTitle(conversation, workspace.members, workspace.user.id)
    : selectedProduction
        ? value(workspace.records.productions.find((record) => record.id === selectedProduction)?.data ||
            {}, "title")
        : (workspace.department.name+" · Allgemein");
let choose = (id: string, project = "") => {
    if (channelsOpen)
        channelToggle.current?.focus();
    setChannelsOpen(false);
    setManage(false);
    setError("");
    if (onNavigate)
        onNavigate(id, project);
    else
        setSelection({ conversationId: id, productionId: project });
};
let update = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
        await fn();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Aktion fehlgeschlagen");
    }
};
const sidebarToggle = true;

$: unread = chatUnreadCounts(workspace.records.notifications, workspace.user.id);
$: sidebarKey = `digitalmask:chat-sidebar:${workspace.user.id}`;

$: locked = !!productionId && !onNavigate;
$: selectedConversation = onNavigate ? conversationId : selection.conversationId;
$: selectedProduction = locked ? productionId : onNavigate ? productionId : selection.productionId;
$: selectedUnread = selectedConversation
    ? unread.conversations[selectedConversation] || 0
    : selectedProduction
        ? unread.productions[selectedProduction] || 0
        : unread.general;
$: otherUnread = Math.max(0, unread.total - selectedUnread);
$: visibleConversations = (workspace.records.conversations || []).filter((record) => record.data.mode === "team" || ids(record.data, "participantIds").includes(workspace.user.id));
$: conversation = visibleConversations.find((record) => record.id === selectedConversation);
$: query = search.trim().toLocaleLowerCase("de");

$: productions = workspace.records.productions.filter((record) => record.data.status !== "archived");
$: matchingProductions = productions.filter((record) => matches(value(record.data, "title")));
$: channels = visibleConversations.filter((record) => archived || record.data.archived !== true);
$: teamChannels = channels.filter((record) => record.data.mode === "team");
$: matchingTeamChannels = teamChannels.filter((record) => matches(value(record.data, "title")));
$: privateChats = channels.filter((record) => record.data.mode !== "team");
$: matchingChats = privateChats.filter((record) => matches([
    conversationTitle(record, workspace.members, workspace.user.id),
    ...ids(record.data, "participantIds").map((id) => workspace.members.find((member) => member.id === id)?.name || ""),
].join(" ")));
$: showGeneral = matches((workspace.department.name+" · Allgemein Teamkanal"));
$: choices = [
    ...(showGeneral
        ? [
            {
                key: "general",
                title: (workspace.department.name+" · Allgemein"),
                detail: (workspace.department.name+" · Gewerkkanal"),
                kind: "team" as const,
                conversationId: "",
                productionId: "",
                unread: unread.general,
            },
        ]
        : []),
    ...matchingTeamChannels.map((record): ChatChoice => ({
        key: chatChoiceKey(record.id),
        title: value(record.data, "title"),
        detail: record.data.archived === true ? "Archiviert · Teamkanal" : (workspace.department.name+" · Gewerkkanal"),
        kind: "team",
        conversationId: record.id,
        productionId: "",
        unread: unread.conversations[record.id] || 0,
    })),
    ...matchingProductions.map((record): ChatChoice => ({
        key: chatChoiceKey("", record.id),
        title: value(record.data, "title"),
        detail: "Absprachen zum Stück",
        kind: "production",
        conversationId: "",
        productionId: record.id,
        unread: unread.productions[record.id] || 0,
    })),
    ...matchingChats.map((record): ChatChoice => ({
        key: chatChoiceKey(record.id),
        title: conversationTitle(record, workspace.members, workspace.user.id),
        detail: record.data.archived === true
            ? "Archiviert · privat"
            : record.data.mode === "direct"
                ? "Persönliches Gespräch · privat"
                : `${ids(record.data, "participantIds").length} Teilnehmende · privat`,
        kind: record.data.mode === "direct" ? "direct" : "group",
        conversationId: record.id,
        productionId: "",
        unread: unread.conversations[record.id] || 0,
    })),
];
$: ordered = unreadFirstChoices(choices, workspace.records.messages, workspace.records.notifications, workspace.user.id);
$: icons = { team: Hash, production: Theater, direct: MessageCircle, group: Users };
$: SelectedIcon = conversation
    ? conversation.data.mode === "team"
        ? Hash
        : conversation.data.mode === "direct"
            ? MessageCircle
            : Users
    : selectedProduction
        ? Theater
        : Hash;
$: title = conversation
    ? conversationTitle(conversation, workspace.members, workspace.user.id)
    : selectedProduction
        ? value(workspace.records.productions.find((record) => record.id === selectedProduction)?.data ||
            {}, "title")
        : (workspace.department.name+" · Allgemein");



</script>
{#if true}
{#snippet render_renderChoice(choice: ChatChoice)}{#key choice.key}<ChannelChoice title={choice.title} detail={choice.detail} icon={icons[choice.kind]} kind={choice.kind} unread={choice.unread} selected={selectedConversation === choice.conversationId &&
    (!choice.conversationId ? selectedProduction === choice.productionId : true)} onSelect={() => choose(choice.conversationId, choice.productionId)}></ChannelChoice>{/key}{/snippet}
{#snippet render_sidebarToggle()}{#if !locked}<button type="button" class="button ghost chat-desktop-sidebar-toggle" aria-label={`${collapsed ? "Kanalauswahl öffnen" : "Kanalauswahl einklappen"}${collapsed && unread.total ? ` · ${unread.total} ungelesene ${unread.total === 1 ? "Nachricht" : "Nachrichten"}` : ""}`} title={collapsed ? "Kanalauswahl öffnen" : "Kanalauswahl einklappen"} aria-expanded={!collapsed} aria-controls={sidebarId} on:click={toggleSidebar}>
      {#if collapsed}<PanelLeftOpen size={20} aria-hidden="true"></PanelLeftOpen>{:else}<PanelLeftClose size={20} aria-hidden="true"></PanelLeftClose>{/if}
      <span class="visually-hidden">Kanalauswahl</span>
      {#if collapsed && unread.total > 0}<span class="chat-unread-count" aria-hidden="true">
          {unread.total > 99 ? "99+" : unread.total}
        </span>{/if}
    </button>{/if}{/snippet}

      <div class={styles.pageHeading}>
        <PageHeader eyebrow="KURZE WEGE. GUTE ABSPRACHEN." title={locked ? "Projektchat" : "Kommunikation"} description={locked
    ? "Alles zum Stück an einem gemeinsamen Ort."
    : "Allgemeine Informationen, Projektkanäle und private Gespräche."}>
          {#if !locked && memberCan(workspace.user, 'chat.channels.manage')}<Button onClick={() => setEditor("new-team")}>
              <Plus size={16}></Plus>
              Teamkanal
            </Button>{/if}
          {#if !locked}<Button variant="primary" onClick={() => setEditor("new")}>
              <Plus size={16}></Plus>
              Privater Chat
            </Button>{/if}
        </PageHeader>
      </div>
      <div bind:this={viewport.current} class={locked
    ? `chat-layout single-channel ${styles.viewport}`
    : `chat-layout ${styles.viewport}${collapsed ? " channels-collapsed" : ""}`}>
        {#if channelsOpen}<button type="button" class="chat-channel-backdrop" aria-label="Kanalauswahl schließen" on:click={() => {
    setChannelsOpen(false);
    channelToggle.current?.focus();
}}></button>{/if}
        {#if !locked}<aside id={sidebarId} class={`chat-channels${channelsOpen ? " is-open" : ""}`} aria-label="Chats auswählen">
            <div class="chat-channels-heading">
              <strong>Deine Kanäle</strong>
              <span>{1 + productions.length + channels.length}</span>
              <button type="button" class="chat-compact-button chat-channel-close" aria-label="Kanalauswahl schließen" on:click={() => {
    setChannelsOpen(false);
    channelToggle.current?.focus();
}}>
                <X size={18} aria-hidden="true"></X>
              </button>
            </div>
            <div class="chat-channel-lists" id="chat-channel-navigation">
              <div class="chat-channel-search">
                <Search size={16} aria-hidden="true"></Search>
                <label class="visually-hidden" for="channel-search">
                  Kanäle und Personen suchen
                </label>
                <input id="channel-search" type="search" value={search} placeholder="Kanal oder Person suchen" on:input={(event) => setSearch(event.currentTarget.value)} />
              </div>
              <nav aria-label="Kommunikationskanäle">
                {#if ordered.unread.length > 0}<ChannelGroup label="Ungelesen" count={ordered.unread.length} storageKey={`digitalmask:chat-group:${workspace.user.id}:unread`} query={query}>
                    {#each ordered.unread as item}{@render render_renderChoice(item)}{/each}
                  </ChannelGroup>{/if}
                {#each ([
    ["team", "Team"],
    ["production", "Produktionen"],
    ["direct", "Direktnachrichten"],
    ["group", "Gruppen"],
] as const) as [kind, label] (kind)}{@const group = ordered.ordinary.filter((choice) => choice.kind === kind)}{#if !(!group.length)}{#key kind}<ChannelGroup label={label} count={group.length} storageKey={`digitalmask:chat-group:${workspace.user.id}:${kind}`} defaultCollapsed={kind === "production"} query={query}>
                      {#each group as item}{@render render_renderChoice(item)}{/each}
                    </ChannelGroup>{/key}{/if}{/each}
              </nav>
              {#if query &&
    !showGeneral &&
    !matchingTeamChannels.length &&
    !matchingProductions.length &&
    !matchingChats.length}<p class="channel-empty">
                    Kein passender Kanal. Probiere einen anderen Namen.
                  </p>{/if}
              {#if !query && !privateChats.length}<div class="channel-private-note">
                  <MessageCircle size={17} aria-hidden="true"></MessageCircle>
                  <p>
                    Ein Gespräch nur für euch?
                    <br />
                    <button type="button" class="text-button" on:click={() => setEditor("new")}>
                      Privaten Chat starten
                    </button>
                  </p>
                </div>{/if}
              <label class="check-label">
                <input type="checkbox" checked={archived} on:input={(event) => setArchived(event.currentTarget.checked)} />
                Archivierte einblenden
              </label>
            </div>
          </aside>{/if}
        {#if selectedConversation && !conversation}<section class="chat-unavailable">
            {@render render_sidebarToggle()}
            <div class="chat-mobile-heading">
              <button type="button" bind:this={channelToggle.current} class="chat-mobile-channel-toggle" aria-expanded={channelsOpen} aria-controls={sidebarId} on:click={() => setChannelsOpen(!channelsOpen)}>
                <h2>Kanal auswählen</h2>
                <ChevronDown size={16} aria-hidden="true"></ChevronDown>
              </button>
            </div>
            <Empty title="Dieser Chat ist nicht verfügbar." description="Wähle einen anderen Chat aus deinen freigegebenen Gesprächen."></Empty>
          </section>{:else}{#key selectedConversation || `production:${selectedProduction}`}<ChatChannel hasMobileChannelToggle={!locked} title={title} productionId={selectedProduction} conversation={conversation} onManage={conversation && canManageRecord(workspace.user, "conversations", conversation)
    ? () => setManage(true)
    : undefined} onCreatePrivate={!locked ? () => setEditor("new") : undefined} onCreateTeam={!locked && memberCan(workspace.user, 'chat.channels.manage') ? () => setEditor("new-team") : undefined}><svelte:fragment slot="sidebarToggle">{@render render_sidebarToggle()}</svelte:fragment><svelte:fragment slot="mobileChannelToggle">{#if !locked}<button type="button" bind:this={channelToggle.current} class="chat-mobile-channel-toggle" aria-expanded={channelsOpen} aria-controls={sidebarId} aria-label={`${title || "Kanal auswählen"} · Kanal wechseln${otherUnread ? ` · ${otherUnread} ungelesene Nachrichten in anderen Kanälen` : ""}`} on:click={() => setChannelsOpen(!channelsOpen)}>
                  <svelte:component this={SelectedIcon} size={18} aria-hidden="true"></svelte:component>
                  <h2>{title || "Kanal auswählen"}</h2>
                  {#if otherUnread > 0}<span class="chat-unread-count" aria-hidden="true">
                      {otherUnread > 99 ? "99+" : otherUnread}
                    </span>{/if}
                  <ChevronDown size={16} aria-hidden="true"></ChevronDown>
                </button>{:else}{undefined}{/if}</svelte:fragment></ChatChannel>{/key}{/if}
      </div>
      {#if manage && conversation}<Modal title={conversation.data.mode === "team" ? "Teamkanal verwalten" : "Privaten Chat verwalten"} onClose={() => setManage(false)}>
          <p class="help-note">
            {conversation.data.mode === "team"
    ? "Die Mitglieder des gewählten Bereichs können den Verlauf und die Dateien sehen. Teamleitungen verwalten diesen Kanal."
    : "Nur die Teilnehmenden können den Verlauf und Dateien sehen. Entfernte Personen verlieren den Zugriff."}
          </p>
          <h3>{title}</h3>
          <p>
            {conversation.data.mode === "team"
    ? "Alle aktiven Teammitglieder"
    : ids(conversation.data, "participantIds")
        .map((id) => workspace.members.find((person) => person.id === id)?.name ||
        "Ehemaliges Teammitglied")
        .join(", ")}
          </p>
          {#if conversation.data.archived === true}<Badge>Archiviert</Badge>{/if}
          <ErrorMessage message={error}></ErrorMessage>
          <footer class="dialog-footer">
            <Button disabled={busy} onClick={() => {
    setManage(false);
    setEditor(conversation);
}}>
              Bearbeiten
            </Button>
            <Button disabled={busy} onClick={() => void update(async () => {
    await save("conversations", { archived: conversation.data.archived !== true }, conversation);
    setManage(false);
})}>
              {conversation.data.archived === true ? "Chat wieder öffnen" : "Archivieren"}
            </Button>
            <Button variant="danger-ghost" disabled={busy} onClick={() => {
    if (confirm("Leeren Chat löschen? Chats mit Nachrichten können archiviert werden."))
        void update(async () => {
            await remove(conversation);
            choose("");
        });
}}>
              Löschen
            </Button>
          </footer>
        </Modal>{/if}
      {#if editor}<ConversationEditor record={typeof editor === "string" ? undefined : editor} initialMode={editor === "new-team" ? "team" : "direct"} onClose={() => setEditor(null)} onSaved={(record) => choose(record.id)}></ConversationEditor>{/if}


{/if}
