<script lang="ts">
  import { tradeDisplay, tradeCurrentDisplay } from "@/shared/trade-display";
  import { theaterLabel } from "@/shared/theater-time";
  import { onMount } from "svelte";
  import { Modal, Button, ErrorMessage, Badge } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { api, post } from "@/shared/client-api";
  import type { TradeItem, Planning } from "./types";
  import { hasPermission } from "@/platform/access";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  import { moduleById } from "./registry";
  export let item: TradeItem;
  export let planning: Planning;
  export let onClose: () => void;
  export let onChanged: () => Promise<void>;
  const store = useWorkspace();
  let current = item,
    busy = false,
    error = "",
    reason = "",
    action = "successor",
    targets: string[] = [],
    brief = "",
    dueDate = "",
    detail: {
      history: { version: number; data: Record<string, unknown>; createdAt: string }[];
      files: { id: string; data: Record<string, unknown> }[];
      nextBefore: number | null;
    } | null = null;
  let left = 0,
    right = 0,
    upload: File | null = null,
    uploadId = "",
    nextPart = 0,
    partBytes = 2_000_000,
    progress = 0;
  $: contract = moduleById(current.moduleId)?.features.find((f) => f.id === current.type);
  $: subject = { id: $store.workspace.user.id, grants: $store.workspace.user.grants || [] };
  $: allowed =
    !!contract &&
    hasPermission(subject, contract.permission, {
      departmentId: current.departmentId,
      productionId: current.productionId || "",
    });
  $: a = detail?.history.find((h) => h.version === left);
  $: b = detail?.history.find((h) => h.version === right);
  const text = (value: unknown): string =>
    value === undefined
      ? "–"
      : Array.isArray(value)
        ? value.map(text).join(", ")
        : value && typeof value === "object"
          ? JSON.stringify(value)
          : tradeChoiceLabel(String(value));
  async function load(before?: number) {
    try {
      const next = await api<{
        item: TradeItem;
        history: NonNullable<typeof detail>["history"];
        files: NonNullable<typeof detail>["files"];
        nextBefore: number | null;
      }>(
        "/api/theater/operations?id=" +
          encodeURIComponent(current.id) +
          (before ? "&before=" + before : ""),
      );
      current = next.item;
      detail = {
        ...next,
        history: before ? [...(detail?.history || []), ...next.history] : next.history,
      };
      if (!left) {
        left = next.history[1]?.version || next.history[0]?.version || 0;
        right = next.history[0]?.version || 0;
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }
  onMount(() => void load());
  async function perform() {
    busy = true;
    error = "";
    try {
      await post("/api/theater/operations", {
        action: "lifecycle",
        data: { id: current.id, expectedVersion: current.version, action, reason },
      });
      await onChanged();
      if (action === "successor") onClose();
      else await load();
      reason = "";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function send() {
    busy = true;
    error = "";
    try {
      await post("/api/theater/operations", {
        action: "followups",
        data: {
          operationId: crypto.randomUUID(),
          id: current.id,
          expectedVersion: current.version,
          targets,
          brief,
          ...(dueDate ? { dueDate } : {}),
        },
      });
      targets = [];
      brief = "";
      await onChanged();
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function uploadFile() {
    if (!upload) return;
    busy = true;
    error = "";
    try {
      if (!uploadId) {
        const started = await post<{ id: string; partBytes: number }>("/api/media", {
          action: "init",
          data: { itemId: current.id, name: upload.name, mime: upload.type, size: upload.size },
        });
        uploadId = started.id;
        partBytes = started.partBytes;
      }
      for (; nextPart < Math.ceil(upload.size / partBytes); nextPart++) {
        const response = await fetch(
          "/api/media?id=" + encodeURIComponent(uploadId) + "&part=" + nextPart,
          {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: upload.slice(nextPart * partBytes, (nextPart + 1) * partBytes),
          },
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload unterbrochen.");
        }
        progress = Math.round((((nextPart + 1) * partBytes) / upload.size) * 100);
      }
      await post("/api/media", { action: "finish", id: uploadId });
      upload = null;
      uploadId = "";
      nextPart = 0;
      progress = 0;
      await onChanged();
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
</script>

<Modal title={current.title} wide {onClose}
  ><div class="trade-detail">
    <p class="small muted">
      {contract?.label} · <Badge>{tradeChoiceLabel(current.status)}</Badge>
    </p>
    <ErrorMessage message={error} />
    <section class="trade-current" aria-label="Aktuelle Angaben">
      {#if current.productionId}<p class="small muted">
          Produktion: {String(
            $store.workspace.records.productions.find(
              (production) => production.id === current.productionId,
            )?.data.title || "Nicht geladen",
          )}
        </p>{/if}
      <dl class="detail-grid">
        {#each (contract?.fields || []).filter((field) => current.data[field.key] !== undefined && current.data[field.key] !== "") as field (field.key)}<div
          >
            <dt>
              {field.key === "amountCents" ? field.label.replace("(Cent)", "(€)") : field.label}
            </dt>
            <dd>
              {tradeCurrentDisplay(
                current.data[field.key],
                field,
                $store.workspace,
                planning,
                current.approvalVerified,
              )}
            </dd>
          </div>{/each}
      </dl>
      <p class="small muted">
        Zuständig für diesen Arbeitsstand: {$store.workspace.members.find(
          (member) => member.id === current.ownerId,
        )?.name || "Nicht geladen"}{current.dueAt ? " · fällig " + dateLabel(current.dueAt) : ""}
      </p>
    </section>
    <details class="trade-extra">
      <summary>Änderungsverlauf & Vergleich</summary>
      <div class="trade-extra-body">
        <p class="small muted">Aktuelle Fassung: {current.version}</p>
        {#if detail?.history.length}<div class="form-grid">
            <label
              >Vorher<select bind:value={left}
                >{#each detail.history as h (h.version)}<option value={h.version}
                    >Fassung {h.version} · {dateLabel(h.createdAt, true)}</option
                  >{/each}</select
              ></label
            ><label
              >Nachher<select bind:value={right}
                >{#each detail.history as h (h.version)}<option value={h.version}
                    >Fassung {h.version} · {dateLabel(h.createdAt, true)}</option
                  >{/each}</select
              ></label
            >
          </div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Feld</th><th>Vorher</th><th>Nachher</th></tr></thead><tbody
                >{#each [{ key: "title", label: "Titel" }, { key: "status", label: "Status" }, ...(contract?.fields || [])] as field (field.key)}{@const old =
                    field.key === "title" || field.key === "status"
                      ? a?.data[field.key]
                      : (a?.data.data as Record<string, unknown>)?.[field.key]}{@const next =
                    field.key === "title" || field.key === "status"
                      ? b?.data[field.key]
                      : (b?.data.data as Record<string, unknown>)?.[field.key]}<tr
                    class:changed={text(old) !== text(next)}
                    ><th>{field.label}</th><td
                      >{tradeDisplay(old, field, $store.workspace, planning)}</td
                    ><td>{tradeDisplay(next, field, $store.workspace, planning)}</td></tr
                  >{/each}</tbody
              >
            </table>
          </div>
          {#if detail.nextBefore}<Button
              disabled={busy}
              onClick={() => void load(detail?.nextBefore || undefined)}
              >Ältere Fassungen laden</Button
            >{/if}{:else}<p class="muted">
            Für diesen Eintrag ist noch keine weitere Fassung gespeichert.
          </p>{/if}
      </div>
    </details>
    <details class="trade-extra">
      <summary
        >Dateien & Anlagen{detail?.files.length ? " (" + detail.files.length + ")" : ""}</summary
      >
      <div class="trade-extra-body">
        <p class="small muted">
          Anlagen gehören zu diesem Fachstand. Ein geänderter Dateistand benötigt eine neue
          Freigabe.
        </p>
        {#each detail?.files || [] as file (file.id)}<p>
            <a href={"/api/files/" + file.id} target="_blank" rel="noreferrer"
              >{String(file.data.name)}</a
            >
            · {Math.ceil(Number(file.data.size) / 1000)} KB
          </p>{/each}
        {#if allowed && !["archived", "cancelled"].includes(current.status)}<label
            >Datei wählen (bis 64 MB)<input
              type="file"
              disabled={busy}
              accept=".pdf,.docx,.xlsx,.csv,.txt,.mp4,.webm,.mp3,.wav,.dwg,.dxf,.gdtf,.mvr"
              on:change={(e) => {
                upload = e.currentTarget.files?.[0] || null;
                uploadId = "";
                nextPart = 0;
                progress = 0;
              }}
            /></label
          >{#if upload}<Button disabled={busy} onClick={() => void uploadFile()}
              >{uploadId ? "Upload fortsetzen" : "Anlage hochladen"}</Button
            >{/if}{#if progress}<progress
              value={Math.min(progress, 100)}
              max="100"
              aria-label="Uploadfortschritt"
            ></progress>{/if}{/if}
      </div>
    </details>
    {#if allowed && current.type !== "stock-movement"}<details class="trade-extra">
        <summary>Weitere Aktionen</summary>
        <div class="trade-extra-body">
          <form class="form-grid" on:submit|preventDefault={() => void perform()}>
            <label
              >Aktion<select bind:value={action}
                ><option value="successor">Nachfolgestand anlegen</option
                >{#if ["archived", "cancelled"].includes(current.status)}<option value="restore"
                    >Wiederherstellen</option
                  >{:else}<option value="archive">Archivieren</option><option value="cancel"
                    >Abbrechen</option
                  >{/if}</select
              ></label
            ><label
              >Begründung<input
                bind:value={reason}
                minlength="3"
                maxlength="2000"
                required
              /></label
            ><button class="button" disabled={busy}
              >{action === "archive"
                ? "Archivieren"
                : action === "cancel"
                  ? "Arbeitsstand abbrechen"
                  : action === "restore"
                    ? "Wiederherstellen"
                    : "Nachfolgestand anlegen"}</button
            >
          </form>
          <p class="small muted">
            Archivierte Stände bleiben lesbar. Verbindliche Finanznachweise werden durch
            Nachfolgestände korrigiert.
          </p>
        </div>
      </details>{/if}
    {#if current.productionId && contract && !contract.private && hasPermission( subject, "collaboration.create", { departmentId: current.departmentId, productionId: current.productionId } )}<details
        class="trade-extra"
      >
        <summary>Aufträge an andere Gewerke</summary>
        <div class="trade-extra-body">
          <p>
            Aus diesem Bericht entstehen verknüpfte Aufgaben und Abstimmungen. Antworten, Abnahme
            und Fachfassung bleiben zusammen.
          </p>
          <form on:submit|preventDefault={() => void send()}>
            <fieldset class="form-multi">
              <legend>Empfangende Gewerke</legend
              >{#each planning.departments.filter((d) => d.id !== current.departmentId) as department (department.id)}<label
                  class="check-label"
                  ><input
                    type="checkbox"
                    checked={targets.includes(department.id)}
                    on:change={(e) =>
                      (targets = e.currentTarget.checked
                        ? [...targets, department.id]
                        : targets.filter((id) => id !== department.id))}
                  />{department.name}</label
                >{/each}
            </fieldset>
            <label
              >Änderungsauftrag<textarea bind:value={brief} minlength="3" maxlength="10000" required
              ></textarea></label
            ><label>Rückmeldung bis<input type="date" bind:value={dueDate} /></label><button
              class="button primary"
              disabled={busy || !targets.length}>Folgeaufträge senden</button
            >
          </form>
        </div>
      </details>{/if}
  </div></Modal
>

<style>
  .trade-detail {
    display: grid;
    gap: 28px;
    min-width: 0;
    padding-bottom: 24px;
  }
  .trade-current {
    display: grid;
    gap: 16px;
  }
  .trade-current .detail-grid {
    margin: 0;
  }
  .trade-current .detail-grid > div {
    min-width: 0;
  }
  .trade-current p {
    margin: 0;
  }
  .trade-extra {
    border-top: 1px solid var(--border);
  }
  .trade-extra > summary {
    min-height: 48px;
    padding-block: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .trade-extra-body {
    display: grid;
    gap: 16px;
    padding-top: 8px;
  }
  .trade-extra-body p {
    margin: 0;
  }
  .trade-extra-body > :global(.button) {
    justify-self: start;
    min-height: 44px;
  }
  .trade-extra-body > form {
    display: grid;
    gap: 16px;
  }
  .trade-extra-body > form > label {
    display: grid;
    gap: 8px;
    margin: 0;
  }
  .trade-extra-body > form > .button {
    justify-self: start;
    min-height: 44px;
  }
  .table-scroll {
    overflow: auto;
  }
  .changed {
    background: var(--accent-soft, var(--surface-soft));
  }
  table th,
  table td {
    overflow-wrap: anywhere;
    max-width: 32ch;
    white-space: pre-wrap;
  }
  progress {
    width: 100%;
    accent-color: var(--accent);
  }
</style>
