import { pushState, replaceState } from "$app/navigation";
import { page } from "$app/state";

// SvelteKit owns the browser's history metadata. Application state belongs in page.state.
export { pushState, replaceState };
export const pageHistoryState = (): Record<string, unknown> => ({ ...page.state });
