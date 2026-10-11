<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { LinkedText } from "@/components/linked-text";
  import {
    FilePlus2,
    Download,
    Hash,
    MessageCircle,
    MoreHorizontal,
    Paperclip,
    Pencil,
    Plus,
    Send,
    Trash2,
    Users,
    X,
  } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { api, initials, post, value } from "@/shared/client-api";
  import { prepareUpload } from "@/shared/client-files";
  import { useWorkspace } from "@/components/workspace-context";
  import { LiveStatus } from "@/components/live-status";
  import { Badge, Button, Empty, ErrorMessage, ExportButton, Modal } from "@/components/ui";
  import { ExportDialog } from "@/components/export-dialog";
  import { useChatRead } from "@/modules/notifications/use-chat-read";
  import { DocumentAttachment } from "@/modules/documents/components/document-attachment";
  import { NewDocumentDialog } from "@/modules/documents/components/new-document-dialog";
  import { documentAccept } from "@/modules/documents/components/record-documents";
  import { ChatActionMenu } from "./chat-action-menu";
  import { navigateWorkspace } from "@/shared/client-navigation";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { DocumentEditor } from "./chat-channel";
  export let hasMobileChannelToggle = true;
  const effects = createEffects();
  let olderCursor: string | null = null;
  let historyLoading = false;
  let channelKey = "";
  // Only conversation identity triggers history loading, never the paging cursor.
  $: selectChannel(conversationId, productionId);
  function selectChannel(conversation: string, production: string) {
    const next = conversation + ":" + production;
    if (channelKey === next) return;
    channelKey = next;
    olderCursor = null;
    void loadHistory();
  }
  async function loadHistory(older = false) {
    historyLoading = true;
    const key = channelKey;
    try {
      const result = await $workspaceStore.loadChat({
        ...(conversationId ? { conversationId } : { productionId }),
        ...(older && olderCursor ? { cursor: olderCursor } : {}),
      });
      if (key === channelKey) olderCursor = result.nextCursor;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      historyLoading = false;
    }
  }
  type ViewProps = {
    productionId?: string;
    conversation?: DomainRecord;
    title: string;
    onManage?: () => void;
    sidebarToggle?: ReactNode;
    mobileChannelToggle?: ReactNode;
    onCreatePrivate?: () => void;
    onCreateTeam?: () => void;
  };
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
  export let conversation: ViewProps["conversation"] = undefined as any;
  export let title: ViewProps["title"] = undefined as any;
  export let onManage: ViewProps["onManage"] = undefined as any;

  export let onCreatePrivate: ViewProps["onCreatePrivate"] = undefined as any;
  export let onCreateTeam: ViewProps["onCreateTeam"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, refresh, save, remove, busy } = $workspaceStore;
  $: ({ workspace, refresh, save, remove, busy } = $workspaceStore);
  let conversationId = conversation?.id || "";
  let archived = conversation?.data.archived === true;
  let text: string = "";
  const setText = (next: typeof text | ((current: typeof text) => typeof text)) => {
    text =
      typeof next === "function" ? (next as (current: typeof text) => typeof text)(text) : next;
  };
  let files: File[] = initialState<File[]>([]);
  const setFiles = (next: File[] | ((current: File[]) => File[])) => {
    files = typeof next === "function" ? (next as (current: File[]) => File[])(files) : next;
  };
  let sending: boolean = false;
  const setSending = (next: typeof sending | ((current: typeof sending) => typeof sending)) => {
    sending =
      typeof next === "function"
        ? (next as (current: typeof sending) => typeof sending)(sending)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let editing: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setEditing = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    editing =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(editing)
        : next;
  };
  let editingText: string = "";
  const setEditingText = (
    next: typeof editingText | ((current: typeof editingText) => typeof editingText),
  ) => {
    editingText =
      typeof next === "function"
        ? (next as (current: typeof editingText) => typeof editingText)(editingText)
        : next;
  };
  let exporting: boolean = false;
  const setExporting = (
    next: typeof exporting | ((current: typeof exporting) => typeof exporting),
  ) => {
    exporting =
      typeof next === "function"
        ? (next as (current: typeof exporting) => typeof exporting)(exporting)
        : next;
  };
  let creatingDocument: boolean = false;
  const setCreatingDocument = (
    next: typeof creatingDocument | ((current: typeof creatingDocument) => typeof creatingDocument),
  ) => {
    creatingDocument =
      typeof next === "function"
        ? (next as (current: typeof creatingDocument) => typeof creatingDocument)(creatingDocument)
        : next;
  };
  let openedDocument: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setOpenedDocument = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    openedDocument =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(openedDocument)
        : next;
  };
  let messageList = { current: null as HTMLDivElement | null };
  let messageHistory = { current: null as HTMLDivElement | null };
  let bottom = { current: null as HTMLDivElement | null };
  let nearBottom = { current: true as any | null };
  let lastMessage = { current: "" as any | null };
  let messageInput = { current: null as HTMLTextAreaElement | null };
  let fileInput = { current: null as HTMLInputElement | null };
  $: effects.run(
    0,
    () => {
      const resize = () => {
        const input = messageInput.current;
        if (!input) return;
        if (!window.matchMedia("(max-width: 1100px)").matches) {
          input.style.removeProperty("height");
          return;
        }
        const panelHeight =
          input.closest(".chat-layout")?.getBoundingClientRect().height || window.innerHeight;
        const cap = Math.max(44, Math.min(120, panelHeight * 0.28));
        input.style.height = "auto";
        input.style.height = `${Math.min(cap, input.scrollHeight)}px`;
      };
      resize();
      window.addEventListener("resize", resize);
      window.visualViewport?.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        window.visualViewport?.removeEventListener("resize", resize);
      };
    },
    [text],
  );
  useChatRead(() => ({
    conversationId: conversationId,
    productionId: productionId,
    endRef: bottom,
  }));
  let messages = (() =>
    workspace.records.messages
      .filter((message) =>
        conversationId
          ? message.data.conversationId === conversationId
          : !value(message.data, "conversationId") &&
            value(message.data, "productionId") === productionId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)))();
  $: effects.run(
    1,
    () => {
      const latest = messages.at(-1);
      if (!latest || latest.id === lastMessage.current) return;
      if (!lastMessage.current || latest.data.userId === workspace.user.id || nearBottom.current) {
        const list = messageList.current;
        if (list) list.scrollTop = list.scrollHeight;
      }
      lastMessage.current = latest.id;
    },
    [messages, workspace.user.id],
  );
  $: effects.run(
    2,
    () => {
      const list = messageList.current;
      const history = messageHistory.current;
      if (!list || !history) return;
      let frame = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          // Fonts, pictures and the keyboard can resize an already-open history.
          // Keep the latest message visible without disturbing someone reading above.
          if (nearBottom.current) list.scrollTop = list.scrollHeight;
        });
      });
      observer.observe(list);
      observer.observe(history);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
    },
    [],
  );
  let send = async (event: FormEvent) => {
    event.preventDefault();
    if ((!text.trim() && !files.length) || sending || archived) return;
    const outgoingFiles = [...files];
    setSending(true);
    setError("");
    try {
      const result = await post<
        | DomainRecord
        | {
            record: DomainRecord;
          }
      >("/api/records/messages", {
        data: {
          text: text.trim() || "Dateianhang",
          ...(conversationId ? { conversationId } : { productionId }),
          attachmentIds: [],
        },
      });
      const record = "record" in result ? result.record : result;
      for (const file of outgoingFiles) {
        const form = new FormData();
        form.append("file", await prepareUpload(file));
        form.append("recordKind", "messages");
        form.append("recordId", record.id);
        await api("/api/files", { method: "POST", body: form });
      }
      setText("");
      setFiles([]);
      await refresh();
    } catch (exception) {
      setError(
        exception instanceof Error ? exception.message : "Nachricht konnte nicht gesendet werden",
      );
    } finally {
      setSending(false);
    }
  };
  let update = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Aktion fehlgeschlagen");
    }
  };

  $: conversationId = conversation?.id || "";
  $: archived = conversation?.data.archived === true;
  $: messages = (() =>
    workspace.records.messages
      .filter((message) =>
        conversationId
          ? message.data.conversationId === conversationId
          : !value(message.data, "conversationId") &&
            value(message.data, "productionId") === productionId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)))();
</script>

<section class="chat-main">
  <header class="chat-heading chat-mobile-heading">
    {#if hasMobileChannelToggle && $$slots.mobileChannelToggle}<slot
        name="mobileChannelToggle"
      />{:else}<h2>{title}</h2>{/if}
    <LiveStatus compact></LiveStatus>
    <ChatActionMenu label="Chataktionen"
      ><svelte:fragment slot="icon"
        ><MoreHorizontal size={21} aria-hidden="true"></MoreHorizontal></svelte:fragment
      >
      {#if archived}<Badge>Archiviert</Badge>{/if}
      <LiveStatus recovery></LiveStatus>
      {#if onCreatePrivate}<button type="button" on:click={onCreatePrivate}>
          <Plus size={17}></Plus>
          Privater Chat
        </button>{/if}
      {#if onCreateTeam}<button type="button" on:click={onCreateTeam}>
          <Hash size={17}></Hash>
          Teamkanal anlegen
        </button>{/if}
      {#if onManage}<button type="button" on:click={onManage}>
          <Users size={17}></Users>
          Verwalten
        </button>{/if}
      <button type="button" on:click={() => setExporting(true)}>
        <Download size={17}></Download>
        Chat exportieren
      </button>
      <a
        href="/?module=help&guide=app-install"
        on:click={(event) => {
          event.preventDefault();
          navigateWorkspace("/?module=help&guide=app-install");
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
      >
        Hilfe & App installieren
      </a>
    </ChatActionMenu>
  </header>
  <header class="chat-heading chat-desktop-heading">
    <slot name="sidebarToggle" />
    {#if conversation}{#if conversation.data.mode === "team"}<Hash size={20}
        ></Hash>{:else}{#if conversation.data.mode === "direct"}<MessageCircle size={20}
          ></MessageCircle>{:else}<Users size={20}></Users>{/if}{/if}{:else}<Hash size={20}
      ></Hash>{/if}
    <div>
      <h2>{title}</h2>
      <span class="small muted">
        {conversation
          ? conversation.data.mode === "team"
            ? conversation.data.scope === "theater"
              ? "Theaterkanal · Alle Gewerke"
              : "Teamkanal · " + workspace.department.name
            : `${conversation.data.mode === "direct" ? "Direktchat" : "Gruppenchat"} · ${Array.isArray(conversation.data.participantIds) ? conversation.data.participantIds.length : 0} Teilnehmende · privat`
          : productionId
            ? "Produktionskanal · Gemeinsame Absprachen & Dateien"
            : "Teamkanal · Gemeinsame Absprachen & Dateien"}
      </span>
    </div>
    <div class="chat-heading-actions">
      {#if archived}<Badge>Archiviert</Badge>{/if}
      <LiveStatus recovery></LiveStatus>
      {#if onManage}<Button onClick={onManage}>Verwalten</Button>{/if}
      <ExportButton onClick={() => setExporting(true)}></ExportButton>
    </div>
  </header>
  <div
    class="chat-messages"
    bind:this={messageList.current}
    on:scroll={(event) => {
      const list = event.currentTarget;
      nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    }}
  >
    <div bind:this={messageHistory.current} class="chat-message-history">
      {#if olderCursor}<Button disabled={historyLoading} onClick={() => void loadHistory(true)}
          >Ältere Nachrichten laden</Button
        >{/if}
      {#if messages.length}{#each messages as message (message.id)}{@const member =
            workspace.members.find((person) => person.id === message.data.userId)}{@const own =
            message.data.userId === workspace.user.id}{@const attached =
            workspace.records.files.filter(
              (file) => file.data.recordKind === "messages" && file.data.recordId === message.id,
            )}{@const attachmentIds = Array.isArray(message.data.attachmentIds)
            ? (message.data.attachmentIds as string[])
            : []}
          <article class={`chat-message ${own ? "own" : ""}`}>
            <span class="avatar">{initials(member?.name || "Team")}</span>
            <div class="message-content">
              <header>
                <strong>{member?.name || "Teammitglied"}</strong>
                <time class="small muted" dateTime={message.createdAt}>
                  {dateLabel(message.createdAt, true)}
                </time>
                {#if message.version > 1}<span class="small muted">bearbeitet</span>{/if}
              </header>
              <p>
                <LinkedText text={value(message.data, "text")}></LinkedText>
              </p>
              {#each attached as file (file.id)}{#key file.id}<DocumentAttachment {file} compact
                  ></DocumentAttachment>{/key}{/each}
              {#each attachmentIds.filter((id) => !attached.some((file) => file.id === id)) as id, index (id)}<a
                  href={`/api/files/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  class="message-attachment"
                >
                  <Paperclip size={14}></Paperclip>
                  Anhang {index + 1}
                </a>{/each}
              {#if own && !archived}<div class="message-actions">
                  <button
                    class="icon-button"
                    aria-label={`Nachricht von ${dateLabel(message.createdAt, true)} bearbeiten`}
                    disabled={sending || busy}
                    on:click={() => {
                      setEditing(message);
                      setEditingText(value(message.data, "text"));
                    }}
                  >
                    <Pencil size={14}></Pencil>
                  </button>
                  <button
                    class="icon-button"
                    aria-label={`Nachricht von ${dateLabel(message.createdAt, true)} löschen`}
                    disabled={sending || busy}
                    on:click={() => {
                      if (confirm("Eigene Nachricht löschen?")) void update(() => remove(message));
                    }}
                  >
                    <Trash2 size={14}></Trash2>
                  </button>
                </div>{/if}
            </div>
          </article>{/each}{:else}<Empty
          title="Ein neuer Raum für eure Absprachen."
          description={conversation && conversation.data.mode !== "team"
            ? "Schreibe nur den Teilnehmenden dieses Chats. Nachrichten und Dateien bleiben hier."
            : "Teile Informationen, stelle Fragen oder hänge eine Datei an."}
        ></Empty>{/if}
      <div bind:this={bottom.current}></div>
    </div>
  </div>
  {#if archived}<div class="chat-archived-note">
      Dieser Chat ist archiviert. Der Verlauf bleibt lesbar; neue Nachrichten sind gesperrt.
    </div>{:else}<form class="chat-composer" on:submit={send}>
      <div class="chat-composer-notices">
        {#if files.length > 0}<div class="pending-files">
            {#each files as file, index (`${file.name}:${index}`)}<span>
                <Paperclip size={13}></Paperclip>
                {file.name}
                <button
                  type="button"
                  aria-label={`Anhang ${file.name} entfernen`}
                  on:click={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  <X size={13}></X>
                </button>
              </span>{/each}
          </div>{/if}
        <ErrorMessage message={error}></ErrorMessage>
      </div>
      <label class="visually-hidden" for="message">
        Nachricht an {title}
      </label>
      <div class="chat-input-row">
        <ChatActionMenu
          label="Anhänge und Dokumente"
          className="chat-attachment-menu"
          disabled={sending}
          ><svelte:fragment slot="icon"><Plus size={21} aria-hidden="true"></Plus></svelte:fragment>
          <button type="button" on:click={() => fileInput.current?.click()} disabled={sending}>
            <Paperclip size={18}></Paperclip>
            Datei anhängen
          </button>
          <button type="button" on:click={() => setCreatingDocument(true)} disabled={sending}>
            <FilePlus2 size={18}></FilePlus2>
            Gemeinsames Dokument anlegen
          </button>
        </ChatActionMenu>
        <textarea
          id="message"
          bind:this={messageInput.current}
          rows={1}
          required={!files.length}
          value={text}
          disabled={sending}
          placeholder="Nachricht schreiben …"
          on:input={(event) => setText(event.currentTarget.value)}></textarea>
        <button
          type="submit"
          class="chat-compact-button chat-mobile-send"
          aria-label={sending ? "Sendet …" : "Senden"}
          title="Nachricht senden"
          disabled={sending || (!text.trim() && !files.length)}
        >
          <Send size={19} aria-hidden="true"></Send>
        </button>
      </div>
      <div class="composer-actions">
        <label class="button ghost">
          <Paperclip size={17}></Paperclip>
          Datei
          <input
            bind:this={fileInput.current}
            class="visually-hidden"
            type="file"
            accept={documentAccept}
            multiple
            disabled={sending}
            on:input={(event) =>
              setFiles([...files, ...Array.from(event.currentTarget.files || [])])}
          />
        </label>
        <Button
          title="Gemeinsames Dokument anlegen"
          disabled={sending}
          onClick={() => setCreatingDocument(true)}
        >
          <FilePlus2 size={16}></FilePlus2>{" "}
          <span>
            <span class="chat-document-prefix">Gemeinsames </span>Dokument
          </span>
        </Button>
        <span class="small muted">
          {conversation && conversation.data.mode !== "team"
            ? "Nur die Teilnehmenden haben Zugriff."
            : "Nur das Team hat Zugriff."}
        </span>
        <Button
          type="submit"
          variant="primary"
          disabled={sending || (!text.trim() && !files.length)}
        >
          <Send size={16}></Send>
          {sending ? "Sendet …" : "Senden"}
        </Button>
      </div>
    </form>{/if}
  {#if editing}{@const activeMessage = editing}<Modal
      title="Eigene Nachricht bearbeiten"
      onClose={() => setEditing(null)}
    >
      <form
        on:submit={(event) => {
          event.preventDefault();
          void update(async () => {
            await save("messages", { text: editingText.trim() }, activeMessage);
            setEditing(null);
          });
        }}
      >
        <label for="edited-message">Nachricht</label>
        <textarea
          id="edited-message"
          rows={5}
          required
          maxLength={10000}
          value={editingText}
          on:input={(event) => setEditingText(event.currentTarget.value)}></textarea>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={() => setEditing(null)}>Abbrechen</Button>
          <Button type="submit" variant="primary" disabled={busy || !editingText.trim()}>
            Speichern
          </Button>
        </footer>
      </form>
    </Modal>{/if}
  {#if creatingDocument}<NewDocumentDialog
      onClose={() => setCreatingDocument(false)}
      onCreate={async (name, format) => {
        const result = await post<
          | DomainRecord
          | {
              record: DomainRecord;
            }
        >("/api/records/messages", {
          data: {
            text: name,
            ...(conversationId ? { conversationId } : { productionId }),
            attachmentIds: [],
          },
        });
        const message = "record" in result ? result.record : result;
        let file: DomainRecord;
        try {
          file = await post<DomainRecord>("/api/documents", {
            recordKind: "messages",
            recordId: message.id,
            name,
            format,
          });
        } catch (exception) {
          await remove(message).catch(() => {});
          throw exception;
        }
        await refresh();
        setCreatingDocument(false);
        setOpenedDocument(file);
      }}
    ></NewDocumentDialog>{/if}
  {#if openedDocument}<DocumentEditor file={openedDocument} onClose={() => setOpenedDocument(null)}
    ></DocumentEditor>{/if}
  {#if exporting}<ExportDialog
      kind="messages"
      filters={conversationId
        ? { conversationId }
        : productionId
          ? { productionId }
          : { generalOnly: "true" }}
      onClose={() => setExporting(false)}
    ></ExportDialog>{/if}
</section>
