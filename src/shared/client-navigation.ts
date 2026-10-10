import {scopedBrowserKey} from './browser-scope';
import type { DomainRecord } from "./contracts";
import { value } from "./client-api";
import { pageHistoryState, pushState, replaceState } from "./kit-history";

interface NavigationContext {
  returnTo?: string;
  returnLabel?: string;
  scroll?: { x: number; y: number };
}
const contextKey = "digitalmaskNavigation";
let navigationUser = "";
export function setNavigationUser(userId: string) {
  navigationUser = userId;
}
export const locationPath = () => location.pathname + location.search + location.hash;
const scrollKey = () =>
  `digitalmask-view:${navigationUser}:scroll:${locationPath().replace(/([?&])record=[^&]*&?/, "$1")}`;
function context(): NavigationContext {
  return (pageHistoryState()[contextKey] as NavigationContext | undefined) || {};
}
export function captureNavigationScroll() {
  const scroll = { x: window.scrollX, y: window.scrollY };
  replaceState("", { ...pageHistoryState(), [contextKey]: { ...context(), scroll } });
  if (navigationUser) {
    try {
      sessionStorage.setItem(scopedBrowserKey(scrollKey()), JSON.stringify(scroll));
    } catch {}
  }
}
export function navigationReturn() {
  const previous = context();
  return previous.returnTo
    ? { href: previous.returnTo, label: previous.returnLabel || "Zurück" }
    : null;
}
export function navigateWorkspace(
  href: string,
  options: { returnLabel?: string; retainOrigin?: boolean } = {},
) {
  captureNavigationScroll();
  const from = locationPath();
  if (from === href) return;
  const metadata: NavigationContext =
    options.retainOrigin === false ? {} : { returnTo: from, returnLabel: options.returnLabel };
  pushState(href, { ...pageHistoryState(), [contextKey]: metadata });
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function returnToContext(fallback: string) {
  if (navigationReturn()) history.back();
  else navigateWorkspace(fallback, { retainOrigin: false });
}
/** Update a query without replacing SvelteKit's internal history bookkeeping. */
export function replaceWorkspaceLocation(href: string, notify = true) {
  replaceState(href, pageHistoryState());
  if (notify) window.dispatchEvent(new PopStateEvent("popstate"));
}
export function closeRecordDetail() {
  if (navigationReturn()) {
    history.back();
    return;
  }
  const next = new URL(location.href);
  ["record", "relatedSeason", "relatedYear"].forEach((key) => next.searchParams.delete(key));
  replaceWorkspaceLocation(next.pathname + next.search);
}

/** Restore the actual history entry, including Back from a linked detail dialog. */
export function restoreNavigationScroll() {
  let saved = context().scroll;
  if (!saved && navigationUser) {
    try {
      saved = JSON.parse(sessionStorage.getItem(scopedBrowserKey(scrollKey())) || "null") || undefined;
    } catch {}
  }
  const frame = requestAnimationFrame(() =>
    window.scrollTo({ left: saved?.x || 0, top: saved?.y || 0, behavior: "instant" }),
  );
  return () => cancelAnimationFrame(frame);
}

const productionTabs: Record<string, string> = {
  tasks: "tasks",
  sprints: "tasks",
  characters: "casting",
  casting: "casting",
  maskPlans: "mask-plan",
  looks: "looks",
  events: "calendar",
  time: "time",
  messages: "chat",
};
const modules: Record<string, string> = {
  handovers: "handovers",
  people: "people",
  feedback: "help",
  attendance: "time",
  conversations: "chat",
  productions: "productions",
  actors: "actors",
  tasks: "tasks",
  materials: "inventory",
  looks: "documentation",
  templates: "documentation",
  events: "calendar",
  time: "time",
  messages: "chat",
};
export function recordHref(record: DomainRecord) {
  if (record.kind === "reservations") {
    const materialId = value(record.data, "materialId");
    return `/?${new URLSearchParams({ module: "inventory", ...(materialId ? { record: materialId } : {}) })}`;
  }
  if (record.kind === "shiftSwaps") {
    return `/?${new URLSearchParams({ module: "calendar", swapId: record.id })}`;
  }
  const conversationId =
    record.kind === "conversations" ? record.id : value(record.data, "conversationId");
  if (conversationId) {
    return `/?${new URLSearchParams({ module: "chat", conversationId })}`;
  }
  const productionId =
    record.kind === "handovers"
      ? ""
      : record.kind === "productions"
        ? record.id
        : value(record.data, "productionId");
  const query = new URLSearchParams(
    productionId
      ? {
          module: "productions",
          productionId,
          tab: productionTabs[record.kind] || "overview",
          ...(record.kind === "productions" ? {} : { record: record.id }),
        }
      : { module: modules[record.kind] || "today", record: record.id },
  );
  return `/?${query}`;
}

/** Links retain the real source route, including its production tab and filters. */
export function navigateRecord(
  record: DomainRecord,
  options: { from?: DomainRecord; beforeNavigate?: () => void } = {},
) {
  const current = new URL(location.href);
  if (
    options.from &&
    current.searchParams.get("record") !== options.from.id &&
    options.from.kind !== "productions"
  ) {
    captureNavigationScroll();
    current.searchParams.set("record", options.from.id);
    pushState(current.pathname + current.search,
      { ...pageHistoryState(), [contextKey]: { ...context(), returnTo: locationPath() } });
  }
  options.beforeNavigate?.();
  navigateWorkspace(recordHref(record));
}
