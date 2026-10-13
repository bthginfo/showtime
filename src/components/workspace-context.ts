import { getContext, setContext } from "svelte";
import { writable, type Writable } from "svelte/store";
import { goto } from "$app/navigation";
import { api, ApiFailure, post } from "@/shared/client-api";
import { connectLiveSync, type SyncStatus } from "@/shared/live-sync";
import { setBrowserScope } from "@/shared/browser-scope";
import { mergeCalendarProductions } from "@/shared/calendar-references";
import type {
  CalendarProductionReference,
  DomainRecord,
  RecordData,
  RecordKind,
  Workspace,
} from "@/shared/contracts";

export interface Context {
  workspace: Workspace;
  busy: boolean;
  notice: string;
  online: boolean;
  syncStatus: SyncStatus;
  refresh: () => Promise<void>;
  loadMore: (kind: RecordKind) => Promise<void>;
  loadWindow: (kind: RecordKind, from: string, to: string) => Promise<void>;
  loadChat: (query: Record<string, string>) => Promise<{ nextCursor: string | null }>;
  save: (kind: RecordKind, data: RecordData, record?: DomainRecord) => Promise<DomainRecord>;
  remove: (record: DomainRecord) => Promise<void>;
  action: (action: string, id?: string, data?: RecordData) => Promise<unknown>;
  notify: (message: string) => void;
  mergeMessages: (messages: DomainRecord[]) => void;
  removeFile: (file: DomainRecord) => Promise<void>;
  runWorkflow: <T = unknown>(url: string, data: RecordData) => Promise<T>;
}
export interface WorkspaceState extends Omit<Context, "workspace"> {
  workspace: Workspace | null;
  error: string;
  pending: boolean;
  scopeRequired: boolean;
}
const key = Symbol("showtime-workspace");
export function useWorkspace() {
  return getContext<Writable<Context>>(key);
}

export function createWorkspace() {
  let state: WorkspaceState;
  let loading: Promise<void> | null = null;
  let reloadAgain = false;
  let generation = 0;
  let disconnect: (() => void) | undefined;
  let disposed = false;
  let mutationPending = false;
  const pages = new Map<string, { kind: RecordKind; chat?: boolean }>();
  const pageLoads = new Map<string, Promise<unknown>>();
  const store = writable<WorkspaceState>();
  const update = (values: Partial<WorkspaceState>) => {
    state = { ...state, ...values };
    store.set(state);
  };
  const notify = (notice: string) => update({ notice });
  const refresh = async () => {
    if (loading) {
      reloadAgain = true;
      return loading;
    }
    const revision = generation;
    loading = (async () => {
      do {
        reloadAgain = false;
        try {
          const workspace = await api<Workspace>("/api/workspace");
          if (disposed || revision !== generation) return;
          for (const [url, page] of pages) {
            try {
              const result = await api<{
                records?: DomainRecord[];
                messages?: DomainRecord[];
                files?: DomainRecord[];
                calendarProductions?: CalendarProductionReference[];
                nextCursor: string | null;
              }>(url);
              if (result.calendarProductions)
                workspace.calendarProductions = mergeCalendarProductions(
                  workspace.calendarProductions,
                  result.calendarProductions,
                );
              const rows = result.records || result.messages || [];
              workspace.records[page.kind] = mergeRows(workspace.records[page.kind], rows);
              if (result.files)
                workspace.records.files = mergeRows(workspace.records.files, result.files);
              if (!page.chat && !url.includes("from=") && workspace.pages)
                workspace.pages[page.kind] = result.nextCursor;
            } catch (error) {
              if (error instanceof ApiFailure && [400, 403, 404].includes(error.status)) {
                pages.delete(url);
                continue;
              }
              throw error;
            }
          }
          setBrowserScope(workspace.organization.id, workspace.user.id);
          const changed =
            state.workspace?.organization.id !== workspace.organization.id ||
            state.workspace?.department.id !== workspace.department.id;
          update({ workspace, error: "", pending: false, scopeRequired: false });
          if (changed || !disconnect) bindLive();
        } catch (e) {
          if (disposed || revision !== generation) return;
          if (e instanceof ApiFailure && e.status === 401) {
            await goto("/login", { replaceState: true });
            return;
          }
          update({
            scopeRequired: e instanceof ApiFailure && (e.status === 409 || e.status === 403),
            pending: false,
            error: e instanceof Error ? e.message : "Verbindung fehlgeschlagen",
          });
        }
      } while (reloadAgain);
    })().finally(() => {
      loading = null;
    });
    return loading;
  };
  const mutate = async <T>(run: () => Promise<T>) => {
    const revision = generation;
    mutationPending = true;
    update({ busy: true });
    try {
      const result = await run();
      if (revision === generation) await refresh();
      return result;
    } finally {
      mutationPending = false;
      if (revision === generation) update({ busy: false });
    }
  };
  const save = (kind: RecordKind, data: RecordData, record?: DomainRecord) =>
    mutate(() =>
      record
        ? api<DomainRecord>("/api/records/" + kind + "/" + record.id, {
            method: "PATCH",
            body: JSON.stringify({ data, version: record.version }),
          })
        : post<DomainRecord>("/api/records/" + kind, { data }),
    );
  const remove = async (record: DomainRecord) => {
    await mutate(() =>
      api("/api/records/" + record.kind + "/" + record.id + "?version=" + record.version, {
        method: "DELETE",
      }),
    );
  };
  const action = (action: string, id?: string, data?: RecordData) =>
    mutate(() => post("/api/actions", { action, id, data }));
  const removeFile = async (file: DomainRecord) => {
    await mutate(() => api("/api/files/" + file.id, { method: "DELETE" }));
  };
  const runWorkflow = async <T = unknown>(url: string, data: RecordData) =>
    (await mutate(() => post<T>(url, data))) as T;
  function mergeRows(existing: DomainRecord[], fresh: DomainRecord[]) {
    const ids = new Set(fresh.map((r) => r.id));
    return [...existing.filter((r) => !ids.has(r.id)), ...fresh];
  }
  async function loadPage(url: string, kind: RecordKind, chat = false) {
    if (pageLoads.has(url)) return pageLoads.get(url) as Promise<{ nextCursor: string | null }>;
    const revision = generation;
    const request = (async () => {
      const result = await api<{
        records?: DomainRecord[];
        messages?: DomainRecord[];
        files?: DomainRecord[];
        calendarProductions?: CalendarProductionReference[];
        nextCursor: string | null;
      }>(url);
      if (revision !== generation || !state.workspace) return { nextCursor: null };
      pages.set(url, { kind, chat });
      const w = state.workspace;
      update({
        workspace: {
          ...w,
          calendarProductions: mergeCalendarProductions(
            w.calendarProductions,
            result.calendarProductions,
          ),
          records: {
            ...w.records,
            [kind]: mergeRows(w.records[kind], result.records || result.messages || []),
            ...(result.files ? { files: mergeRows(w.records.files, result.files) } : {}),
          },
          pages: {
            ...w.pages,
            ...(!chat && !url.includes("from=") ? { [kind]: result.nextCursor } : {}),
          },
        },
      });
      return { nextCursor: result.nextCursor };
    })().finally(() => pageLoads.delete(url));
    pageLoads.set(url, request);
    return request;
  }
  const loadMore = async (kind: RecordKind) => {
    const cursor = state.workspace?.pages?.[kind];
    if (!cursor) return;
    try {
      await loadPage("/api/records/" + kind + "?cursor=" + encodeURIComponent(cursor), kind);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Weitere Einträge konnten nicht geladen werden.");
    }
  };
  const loadWindow = async (kind: RecordKind, from: string, to: string) => {
    for (const [url, page] of pages)
      if (page.kind === kind && url.includes("from=")) pages.delete(url);
    const revision = generation;
    let cursor: string | null = null;
    let count = 0;
    do {
      const query = new URLSearchParams({ from, to, limit: "300", ...(cursor ? { cursor } : {}) });
      const result = await loadPage("/api/records/" + kind + "?" + query, kind);
      cursor = result.nextCursor;
      if (revision !== generation) return;
      if (++count > 100) throw new Error("Bitte einen kleineren Zeitraum wählen.");
    } while (cursor);
  };
  const loadChat = (query: Record<string, string>) =>
    loadPage("/api/messages?" + new URLSearchParams(query), "messages", true);
  const mergeMessages = (messages: DomainRecord[]) => {
    const w = state.workspace;
    if (!w) return;
    const scoped = messages.filter((m) => m.organizationId === w.organization.id);
    update({
      workspace: {
        ...w,
        records: {
          ...w.records,
          messages: [
            ...w.records.messages.filter((x) => !scoped.some((m) => m.id === x.id)),
            ...scoped,
          ],
        },
      },
    });
  };
  function bindLive() {
    disconnect?.();
    disconnect = undefined;
    if (!state.workspace?.live) {
      update({ syncStatus: state.online ? "unavailable" : "offline" });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed && !mutationPending) void refresh();
        else if (!disposed) changed();
      }, 450);
    };
    const stop = connectLiveSync({
      access: () => state.workspace?.live,
      renew: refresh,
      changed,
      status: (syncStatus) => update({ syncStatus }),
    });
    disconnect = () => {
      clearTimeout(timer);
      stop();
    };
  }
  state = {
    workspace: null,
    busy: false,
    notice: "",
    online: true,
    syncStatus: "connecting",
    error: "",
    pending: false,
    scopeRequired: false,
    refresh,
    save,
    remove,
    action,
    notify,
    mergeMessages,
    removeFile,
    runWorkflow,
    loadMore,
    loadWindow,
    loadChat,
  };
  store.set(state);
  setContext(key, store);
  return {
    ...store,
    refresh,
    connectivity(online: boolean) {
      update({ online });
    },
    dispose() {
      disposed = true;
      generation++;
      disconnect?.();
      setBrowserScope("", "");
    },
    async switchScope(tenantId: string, departmentId: string) {
      generation++;
      pages.clear();
      pageLoads.clear();
      disconnect?.();
      disconnect = undefined;
      setBrowserScope("", "");
      update({ workspace: null, error: "", notice: "" });
      await post("/api/platform/switch", { organizationId: tenantId, departmentId });
      if (loading) await loading;
      await refresh();
    },
  };
}
