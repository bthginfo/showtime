<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate } = useTheaterTime();
  import { onMount, tick } from "svelte";
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    FileText,
    MessageSquare,
    Plus,
    RefreshCw,
    Send,
    Upload,
  } from "@lucide/svelte";
  import { Button, Empty, ErrorMessage, Badge, Section } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { api, post } from "@/shared/client-api";
  import { prepareUpload } from "@/shared/client-files";
  import { DocumentEditor } from "@/modules/documents/components/document-editor";
  import { documentAccept } from "@/modules/documents/components/record-documents";
  import {
    collaborationKinds,
    collaborationStates,
    type CollaborationDetail,
    type CollaborationEntry,
    type CollaborationKind,
  } from "@/shared/collaboration";
  import { tradeGuides } from "@/shared/trade-guides";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  import type { Planning, TradeItem } from "./types";
  import type { DomainRecord } from "@/shared/contracts";
  export let planning: Planning;
  export let productionId = "";
  export let requestId = "";
  export let source: TradeItem | null = null;
  export let onChanged: () => Promise<void> = async () => {};
  const store = useWorkspace();
  let entries: CollaborationEntry[] = [],
    detail: CollaborationDetail | null = null,
    nextOffset: number | null = null;
  let loading = true,
    busy = false,
    error = "",
    search = "",
    filter = "open",
    creating = false;
  let id = "",
    title = "",
    kind: CollaborationKind = "feedback",
    recipient = "",
    production = productionId,
    brief = "",
    acceptance = "",
    dueDate = "";
  let message = "",
    action = "comment",
    revisedBrief = "",
    refreshSource = false,
    opened: DomainRecord | null = null;
  let formHeading: HTMLHeadingElement, detailHeading: HTMLHeadingElement;
  $: workspace = $store.workspace;
  $: module = planning.modules.find(
    (module) => module.config.departmentId === workspace.department.id,
  );
  $: guide = tradeGuides[module?.moduleId || "makeup"];
  $: filtered = entries.filter(
    (entry) =>
      `${entry.title} ${String(entry.data.brief)}`
        .toLocaleLowerCase("de")
        .includes(search.trim().toLocaleLowerCase("de")) &&
      (filter === "all" ||
        (filter === "open" && ["review", "changes_requested"].includes(entry.status)) ||
        (filter === "incoming" && entry.data.recipientDepartmentId === workspace.department.id) ||
        (filter === "outgoing" && entry.departmentId === workspace.department.id)),
  );
  const departmentName = (id: string) =>
    planning.departments.find((department) => department.id === id)?.name || "Gewerk";
  async function load(append = false) {
    loading = true;
    error = "";
    try {
      const params = new URLSearchParams();
      if (productionId) params.set("productionId", productionId);
      if (append && nextOffset !== null) params.set("offset", String(nextOffset));
      const result = await api<{ entries: CollaborationEntry[]; nextOffset: number | null }>(
        "/api/theater/collaborations?" + params,
      );
      entries = append ? [...entries, ...result.entries] : result.entries;
      nextOffset = result.nextOffset;
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Abstimmungen konnten nicht geladen werden.";
    } finally {
      loading = false;
    }
  }
  async function select(selectedId: string) {
    busy = true;
    error = "";
    creating = false;
    try {
      detail = await api<CollaborationDetail>(
        "/api/theater/collaborations?id=" + encodeURIComponent(selectedId),
      );
      action = "comment";
      refreshSource = false;
      revisedBrief = String(detail.entry.data.brief || "");
      await tick();
      detailHeading?.focus();
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Anfrage konnte nicht geöffnet werden.";
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    void load().then(() => {
      if (requestId) return select(requestId);
      if (source) return start();
    });
  });
  async function start() {
    creating = true;
    detail = null;
    id = crypto.randomUUID();
    title = source ? `Rückmeldung: ${source.title}` : "";
    brief = "";
    acceptance = "";
    kind =
      source?.data.approval !== undefined || source?.type === "handover" ? "approval" : "feedback";
    recipient = "";
    production = source?.productionId || productionId;
    dueDate = "";
    await tick();
    formHeading?.focus();
  }
  function example() {
    title = guide?.example || "Arbeitsstand gemeinsam prüfen";
    brief = `${guide?.example || "Bitte prüft diesen Arbeitsstand"}. Bitte gebt eine Rückmeldung zu Umsetzbarkeit, offenen Fragen und dem nächsten gemeinsamen Termin.`;
    acceptance = guide?.check || "Offene Punkte und nächster Arbeitsschritt sind abgestimmt.";
    recipient =
      planning.modules.find((module) => module.moduleId === guide?.target)?.config.departmentId ||
      "";
  }
  async function create() {
    busy = true;
    error = "";
    try {
      const entry = await post<CollaborationEntry>("/api/theater/collaborations", {
        action: "create",
        data: {
          id,
          title,
          kind,
          recipientDepartmentId: recipient,
          productionId: production,
          brief,
          acceptance,
          ...(dueDate ? { dueDate } : {}),
          ...(source ? { sourceItemId: source.id } : {}),
        },
      });
      creating = false;
      filter = "all";
      source = null;
      await onChanged();
      await load();
      await select(entry.id);
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Anfrage konnte nicht gesendet werden. Deine Angaben bleiben erhalten.";
    } finally {
      busy = false;
    }
  }
  async function reply() {
    if (!detail) return;
    busy = true;
    error = "";
    try {
      const selectedId = detail.entry.id;
      await post("/api/theater/collaborations", {
        action: "reply",
        data: {
          id: selectedId,
          expectedVersion: detail.entry.version,
          action,
          message,
          ...(action === "revise" ? { brief: revisedBrief, refreshSource } : {}),
        },
      });
      message = "";
      await onChanged();
      await load();
      await select(selectedId);
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Rückmeldung konnte nicht gespeichert werden. Dein Text bleibt erhalten.";
    } finally {
      busy = false;
    }
  }
  async function moreReplies() {
    if (!detail?.nextVersion) return;
    busy = true;
    error = "";
    try {
      const next = await api<CollaborationDetail>(
        `/api/theater/collaborations?id=${encodeURIComponent(detail.entry.id)}&afterVersion=${detail.nextVersion}`,
      );
      detail = { ...next, replies: [...detail.replies, ...next.replies] };
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Weitere Rückmeldungen konnten nicht geladen werden.";
    } finally {
      busy = false;
    }
  }
  async function upload(files: FileList | null, input: HTMLInputElement) {
    if (!files?.length || !detail) return;
    busy = true;
    error = "";
    const selectedId = detail.entry.id;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", await prepareUpload(file));
        form.set("recordKind", "handovers");
        form.set("recordId", selectedId);
        await api("/api/files", { method: "POST", body: form });
      }
      await onChanged();
      await load();
      await select(selectedId);
      input.value = "";
    } catch (exception) {
      error =
        exception instanceof Error
          ? exception.message
          : "Die Anlage konnte nicht hochgeladen werden.";
    } finally {
      busy = false;
    }
  }
  const replyLabels: Record<string, string> = {
    created: "Anfrage gesendet",
    comment: "Rückmeldung",
    "request-changes": "Überarbeitung erbeten",
    approve: "Freigabe",
    acknowledge: "Übernommen",
    revise: "Neuer Arbeitsstand",
    cancel: "Zurückgezogen",
    attachment: "Anlagen aktualisiert",
  };
</script>

<section
  class="collaboration-workspace"
  class:has-detail={detail !== null || creating}
  aria-label="Zusammenarbeit zwischen Gewerken"
>
  <div class="section-heading collaboration-heading">
    <div>
      <h2>Zusammenarbeit zwischen Gewerken</h2>
      <p class="muted">Aufträge, Rückmeldungen und Freigaben bleiben an einem Ort.</p>
    </div>
    <div class="button-row">
      <Button disabled={busy || loading} onClick={() => void load()}
        ><RefreshCw size={16} />Aktualisieren</Button
      >{#if !creating && workspace.user.permissions?.includes("collaboration.create")}<Button
          variant="primary"
          disabled={busy}
          onClick={() => void start()}><Plus size={16} />Neue Anfrage</Button
        >{/if}
    </div>
  </div>
  <ErrorMessage message={error} />
  <div class="collaboration-columns">
    <section class="panel collaboration-list" aria-label="Anfragen">
      <label class="collaboration-search"
        >Anfragen durchsuchen<input
          type="search"
          bind:value={search}
          placeholder="Titel oder Arbeitsauftrag"
        /></label
      >
      <label
        >Ansicht<select bind:value={filter}
          ><option value="open">Offene Anfragen</option><option value="incoming"
            >An mein Gewerk</option
          ><option value="outgoing">Von meinem Gewerk</option><option value="all"
            >Alle zugänglichen Anfragen</option
          ></select
        ></label
      >
      {#if loading}<p class="muted" role="status">
          Anfragen werden geladen …
        </p>{:else if !filtered.length}<Empty
          title={search
            ? "Keine passende Anfrage"
            : filter === "open"
              ? "Keine offenen Anfragen"
              : "Keine Anfragen in dieser Ansicht"}
          description={search
            ? "Versuche einen anderen Suchbegriff oder eine andere Ansicht."
            : "Sende einen Arbeitsstand an ein anderes Gewerk oder wähle eine andere Ansicht."}
        />{/if}
      <div class="collaboration-rows">
        {#each filtered as entry (entry.id)}<button
            class="collaboration-row"
            class:active={entry.id === detail?.entry.id}
            aria-current={entry.id === detail?.entry.id ? "true" : undefined}
            disabled={busy}
            on:click={() => {
              message = "";
              void select(entry.id);
            }}
            ><span class="collaboration-row-title">{entry.title}</span><span class="small muted"
              >{departmentName(entry.departmentId)} → {departmentName(
                String(entry.data.recipientDepartmentId),
              )}</span
            ><span class="collaboration-row-status"
              ><Badge
                tone={entry.status === "approved" || entry.status === "acknowledged"
                  ? "green"
                  : undefined}>{collaborationStates[entry.status]}</Badge
              >{#if entry.data.dueDate}<span
                  class:overdue={String(entry.data.dueDate) < localDate() &&
                    ["review", "changes_requested"].includes(entry.status)}
                  class="small">bis {dateLabel(String(entry.data.dueDate))}</span
                >{/if}</span
            ></button
          >{/each}
      </div>
      {#if nextOffset !== null}<Button disabled={busy || loading} onClick={() => void load(true)}
          >Weitere Anfragen laden</Button
        >{/if}
    </section>
    <section
      class="panel collaboration-detail"
      aria-label={creating ? "Neue Anfrage" : "Anfragedetails"}
    >
      {#if creating}<div class="section-heading">
          <h3 bind:this={formHeading} tabindex="-1">Neue Anfrage</h3>
          <Button
            onClick={() => {
              creating = false;
              source = null;
            }}>Abbrechen</Button
          >
        </div>
        <p class="muted">
          {workspace.department.name} → ein anderes Gewerk. Die Empfänger sehen deinen Auftrag und seine
          Anlagen.
        </p>
        <button class="text-button" type="button" on:click={example}
          >Passendes Beispiel für {guide?.label || workspace.department.name} übernehmen</button
        >
        <form class="form-grid" on:submit|preventDefault={() => void create()}>
          <label class="full">Titel<input bind:value={title} maxlength="200" required /></label>
          <label
            >Produktion<select bind:value={production} required
              ><option value="">Produktion wählen</option
              >{#each workspace.records.productions as entry (entry.id)}<option value={entry.id}
                  >{String(entry.data.title)}</option
                >{/each}</select
            ></label
          >
          <label
            >Empfangendes Gewerk<select bind:value={recipient} required
              ><option value="">Gewerk wählen</option
              >{#each planning.departments.filter((department) => department.id !== workspace.department.id) as department (department.id)}<option
                  value={department.id}>{department.name}</option
                >{/each}</select
            ></label
          >
          <label
            >Was brauchst du?<select bind:value={kind}
              >{#each Object.entries(collaborationKinds) as [value, label]}<option {value}
                  >{label}</option
                >{/each}</select
            ></label
          >
          <label>Rückmeldung bis (optional)<input type="date" bind:value={dueDate} /></label>
          <label class="full"
            >Arbeitsauftrag oder Frage<textarea
              bind:value={brief}
              required
              maxlength="10000"
              rows="5"
              placeholder="Welche Szene oder welcher Entwurf? Was soll das empfangende Gewerk prüfen oder übernehmen?"
            ></textarea></label
          >
          <label class="full"
            >Wann ist die Anfrage erledigt? (optional)<textarea
              bind:value={acceptance}
              maxlength="3000"
              rows="3"
              placeholder="Zum Beispiel: Frisur, Perücke und Headset-Sitz sind gemeinsam abgestimmt."
            ></textarea></label
          >
          <p class="small muted full">
            Bilder, PDF und Office-Dateien kannst du nach dem Senden als Anlagen ergänzen.
            Geschützte Maß-, Personal- und Budgetdaten bleiben separat.
          </p>
          <button class="button primary" disabled={busy}
            ><Send size={16} />{busy ? "Wird gesendet …" : "Anfrage senden"}</button
          >
        </form>
      {:else if detail}<div class="section-heading">
          <h3 bind:this={detailHeading} tabindex="-1">{detail.entry.title}</h3>
          <Button disabled={busy} onClick={() => void select(detail!.entry.id)}
            ><RefreshCw size={16} />Stand laden</Button
          >
        </div>
        <button class="text-button collaboration-back" on:click={() => (detail = null)}
          ><ArrowLeft size={16} />Alle Anfragen</button
        >
        <p class="muted">
          {departmentName(detail.entry.departmentId)}
          <ArrowRight size={14} />
          {departmentName(String(detail.entry.data.recipientDepartmentId))}
        </p>
        <div class="collaboration-summary">
          <Badge
            tone={["approved", "acknowledged"].includes(detail.entry.status) ? "green" : undefined}
            >{collaborationStates[detail.entry.status]}</Badge
          ><span class="small muted"
            >Arbeitsstand {Number(detail.entry.data.revision || 1)} · {collaborationKinds[
              detail.entry.data.kind as CollaborationKind
            ]}{detail.entry.data.dueDate
              ? ` · bis ${dateLabel(String(detail.entry.data.dueDate))}`
              : ""}</span
          >
        </div>
        <h4>Arbeitsauftrag</h4>
        {#if detail.entry.data.sourceSnapshot}{@const snapshot = detail.entry.data
            .sourceSnapshot as {
            title: string;
            version: number;
            fields: { key: string; label: string; type: string; value: unknown }[];
          }}
          <Section title={`Fachstand: ${snapshot.title}`} meta={`Fassung ${snapshot.version}`}>
            <dl class="detail-grid">
              {#each snapshot.fields as field (field.key)}{#if field.value !== null && field.value !== ""}
                  <div>
                    <dt>
                      {field.key === "amountCents"
                        ? field.label.replace("(Cent)", "(€)")
                        : field.label}
                    </dt>
                    <dd>
                      {field.type === "checkbox"
                        ? field.value
                          ? "Ja"
                          : "Nein"
                        : field.key === "amountCents"
                          ? new Intl.NumberFormat("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            }).format(Number(field.value) / 100)
                          : field.type === "select"
                            ? tradeChoiceLabel(String(field.value))
                            : Array.isArray(field.value)
                              ? field.value
                                  .map(
                                    (id) =>
                                      workspace.members.find((member) => member.id === id)?.name ||
                                      id,
                                  )
                                  .join(", ")
                              : String(field.value)}
                    </dd>
                  </div>
                {/if}{/each}
            </dl>
          </Section>
        {/if}
        <p class="preserve-lines">{String(detail.entry.data.brief)}</p>
        {#if detail.entry.data.acceptance}<h4>Erledigt, wenn …</h4>
          <p class="preserve-lines">{String(detail.entry.data.acceptance)}</p>{/if}
        <div class="section-heading collaboration-attachments-heading">
          <h4>Anlagen</h4>
          {#if detail.entry.canAttach}<label class="button secondary collaboration-upload"
              ><Upload size={16} />Anlage hinzufügen<input
                aria-label="Anlage hinzufügen"
                type="file"
                accept={documentAccept}
                multiple
                disabled={busy}
                on:change={(event) => void upload(event.currentTarget.files, event.currentTarget)}
              /></label
            >{/if}
        </div>
        <p class="small muted">
          Anlagen sind gespeicherte Arbeitsstände. Jede neue Anlage ändert den Prüfstand; nach
          Abschluss bleiben sie unverändert.
        </p>
        {#if !detail.files.length}<p class="muted small">Noch keine Anlagen.</p>{/if}
        <div class="collaboration-files">
          {#each detail.files as file (file.id)}<article>
              {#if file.data.image}<a
                  href={`/api/files/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  ><img
                    src={`/api/files/${file.id}`}
                    alt={String(file.data.name)}
                    loading="lazy"
                  /></a
                >{/if}
              <div>
                <FileText size={16} /><span>{String(file.data.name)}</span><a
                  href={`/api/files/${file.id}`}
                  download={String(file.data.name)}>Herunterladen</a
                >{#if /\.(docx|xlsx|csv|pdf)$/i.test(String(file.data.name))}<Button
                    onClick={() => (opened = file)}>Ansehen</Button
                  >{/if}
              </div>
            </article>{/each}
        </div>
        <h4>Rückmeldungen und Verlauf</h4>
        <ol class="collaboration-replies">
          {#each detail.replies as reply (reply.version)}<li>
              <div>
                <strong>{replyLabels[reply.action] || "Rückmeldung"}</strong><span
                  class="small muted"
                  >{reply.author} · {dateLabel(reply.createdAt, true)} · Arbeitsstand {reply.revision}</span
                >
              </div>
              <p class="preserve-lines">{reply.message}</p>
            </li>{/each}
        </ol>
        {#if detail.nextVersion}<Button disabled={busy} onClick={() => void moreReplies()}
            >Weitere Rückmeldungen laden</Button
          >{/if}
        {#if detail.entry.canComment}<form
            class="collaboration-response"
            on:submit|preventDefault={() => void reply()}
          >
            <label
              >Deine Rückmeldung<select bind:value={action}
                ><option value="comment">Kommentieren</option>{#if detail.entry.canRespond}<option
                    value="request-changes">Überarbeitung erbitten</option
                  >{#if detail.entry.data.kind !== "approval"}<option value="acknowledge"
                      >Übernehmen und abschließen</option
                    >{/if}{/if}{#if detail.entry.canApprove && detail.entry.data.kind === "approval"}<option
                    value="approve">Arbeitsstand freigeben</option
                  >{/if}{#if detail.entry.canRevise}<option value="revise"
                    >Überarbeiteten Stand senden</option
                  ><option value="cancel">Anfrage zurückziehen</option>{/if}</select
              ></label
            >{#if action === "revise"}<label
                >Überarbeiteter Arbeitsauftrag<textarea
                  bind:value={revisedBrief}
                  maxlength="10000"
                  required
                  rows="4"></textarea></label
              >{#if detail.entry.data.sourceItemId}<label class="check-label"
                  ><input type="checkbox" bind:checked={refreshSource} />Aktuellen Fachstand erneut
                  zur Prüfung übergeben</label
                >{/if}{/if}<label
              >Text<textarea
                bind:value={message}
                maxlength="10000"
                required
                rows="3"
                placeholder="Was ist geklärt? Was soll geändert werden? Welcher Schritt folgt?"
              ></textarea></label
            >{#if action === "approve"}<p class="small muted">
                Du bestätigst den aktuellen Auftrag und seine Anlagen für dein Gewerk. Das ist eine
                fachliche Freigabe; vorgeschriebene Sicherheitsabnahmen bleiben separat.
              </p>{/if}<button class="button primary" disabled={busy}
              >{#if action === "approve"}<Check size={16} />{:else}<MessageSquare
                  size={16}
                />{/if}{busy
                ? "Wird gespeichert …"
                : action === "approve"
                  ? "Diesen Stand freigeben"
                  : "Rückmeldung speichern"}</button
            >
          </form>{:else}<p class="success-message" role="status">
            Diese Abstimmung ist abgeschlossen. Für einen neuen Arbeitsstand legt ihr eine neue
            Anfrage an.
          </p>{/if}
      {:else}<Empty
          title="Wähle eine Anfrage"
          description="Hier siehst du den Arbeitsauftrag, seine Anlagen und die Rückmeldungen der beteiligten Gewerke."
        />{/if}
    </section>
  </div>
</section>
{#if opened}<DocumentEditor file={opened} onClose={() => (opened = null)} />{/if}
