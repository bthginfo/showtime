import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { setBrowserScope } from "@/shared/browser-scope";
import { preferenceKey } from "@/shared/client-storage";

const origin = "https://showtime-ingolstadt.vercel.app";

function worker() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const fetch = vi.fn();
  const match = vi.fn(
    async () => new Response("Showtime offline", { headers: { "Cache-Control": "max-age=100" } }),
  );
  const addAll = vi.fn(async (_assets: Request[]) => undefined);
  const open = vi.fn(async () => ({ match, addAll }));
  const remove = vi.fn(async () => true);
  const claim = vi.fn(async () => undefined);
  const enable = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const caches = {
    open,
    keys: async () => ["showtime-shell-v6", "showtime-shell-v7", "other-app-cache"],
    delete: remove,
  };
  class WorkerRequest extends Request {
    constructor(url: string, options?: RequestInit) {
      super(new URL(url, origin), options);
    }
  }
  runInNewContext(readFileSync("static/sw.js", "utf8"), {
    self: {
      location: { origin },
      addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) =>
        listeners.set(name, listener),
      skipWaiting,
      clients: { claim },
      registration: { navigationPreload: { enable } },
    },
    caches,
    fetch,
    URL,
    Request: WorkerRequest,
    Response,
    Headers,
  });
  async function lifecycle(type: string) {
    let work: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({
      waitUntil: (value: Promise<unknown>) => {
        work = value;
      },
    });
    await work;
  }
  function request(
    path: string,
    options: {
      method?: string;
      mode?: string;
      preloadResponse?: Promise<Response | undefined>;
    } = {},
  ) {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: {
        url: new URL(path, origin).href,
        method: options.method || "GET",
        mode: options.mode || "navigate",
      },
      preloadResponse: options.preloadResponse,
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return response;
  }
  return { fetch, open, match, addAll, remove, claim, enable, skipWaiting, lifecycle, request };
}

describe("deployed service worker navigation", () => {
  it("returns the current online page without reading or writing the offline cache", async () => {
    const app = worker();
    const online = new Response("current login page");
    app.fetch.mockResolvedValue(online);
    expect(await app.request("/login")).toBe(online);
    expect(app.fetch.mock.calls[0][1]).toEqual({ cache: "no-store" });
    expect(app.open).not.toHaveBeenCalled();
  });
  it("recovers one transient navigation failure before showing the offline page", async () => {
    const app = worker();
    app.fetch
      .mockRejectedValueOnce(new TypeError("network lost"))
      .mockResolvedValueOnce(new Response("application"));
    expect(await (await app.request("/"))!.text()).toBe("application");
    expect(app.fetch).toHaveBeenCalledTimes(2);
    expect(app.match).not.toHaveBeenCalled();
  });
  it("uses a successful navigation preload and recovers a rejected preload", async () => {
    const app = worker();
    const online = new Response("preloaded app");
    expect(await app.request("/", { preloadResponse: Promise.resolve(online) })).toBe(online);
    expect(app.fetch).not.toHaveBeenCalled();
    app.fetch.mockResolvedValue(new Response("fresh request"));
    expect(
      await (await app.request("/", {
        preloadResponse: Promise.reject(new TypeError("preload failed")),
      }))!.text(),
    ).toBe("fresh request");
  });
  it("uses only its current cache after persistent failure and prevents HTTP caching of the fallback", async () => {
    const app = worker();
    app.fetch.mockRejectedValue(new TypeError("offline"));
    const offline = await app.request("/");
    expect(await offline!.text()).toBe("Showtime offline");
    expect(offline!.headers.get("Cache-Control")).toBe("no-store");
    expect(app.fetch).toHaveBeenCalledTimes(2);
    expect(app.open).toHaveBeenCalledWith("showtime-shell-v7");
  });
  it("does not substitute offline HTML for server failures, APIs, writes or other origins", async () => {
    const app = worker();
    const failure = new Response("unavailable", { status: 503 });
    app.fetch.mockResolvedValue(failure);
    expect(await app.request("/")).toBe(failure);
    expect(app.request("/api/bootstrap")).toBeUndefined();
    expect(app.request("/api/connection", { mode: "cors" })).toBeUndefined();
    expect(app.request("/login", { method: "POST" })).toBeUndefined();
    expect(app.request("https://other-theater.invalid/")).toBeUndefined();
    expect(app.match).not.toHaveBeenCalled();
  });
  it("installs fresh public fallback assets and cleans only obsolete shell caches", async () => {
    const app = worker();
    await app.lifecycle("install");
    const assets = app.addAll.mock.calls[0][0];
    expect(assets.map((request) => [new URL(request.url).pathname, request.cache])).toEqual([
      ["/icon.svg", "reload"],
      ["/offline.html", "reload"],
    ]);
    expect(app.skipWaiting).toHaveBeenCalledTimes(1);
    await app.lifecycle("activate");
    expect(app.remove.mock.calls).toEqual([["showtime-shell-v6"]]);
    expect(app.enable).toHaveBeenCalledTimes(1);
    expect(app.claim).toHaveBeenCalledTimes(1);
  });
});

function offlinePage(
  options: {
    path?: string;
    title?: string;
    connected?: boolean;
    marker?: string;
    alreadyRetried?: boolean;
  } = {},
) {
  const handlers = new Map<string, () => Promise<void> | void>();
  const elements = new Map<string, { textContent: string; disabled: boolean }>();
  const data = new Map<string, string>([
    [
      "digitalmask-offline-inbox",
      JSON.stringify([{ id: "unassigned", data: { title: "Synthetic offline draft" } }]),
    ],
  ]);
  const session = new Map<string, string>(
    options.alreadyRetried ? [["showtime-offline-return", "1"]] : [],
  );
  const form = {
    elements: {
      title: { value: options.title || "" },
      minutes: { value: "" },
      date: { value: "" },
    },
    addEventListener: (name: string, listener: () => void) =>
      handlers.set("form:" + name, listener),
  };
  const document = {
    hidden: false,
    documentElement: { setAttribute: vi.fn() },
    getElementById: (id: string) => {
      if (id === "booking") return form;
      if (!elements.has(id)) elements.set(id, { textContent: "", disabled: false });
      return {
        ...elements.get(id),
        addEventListener: (name: string, listener: () => void) =>
          handlers.set(id + ":" + name, listener),
        get textContent() {
          return elements.get(id)!.textContent;
        },
        set textContent(value: string) {
          elements.get(id)!.textContent = value;
        },
        get disabled() {
          return elements.get(id)!.disabled;
        },
        set disabled(value: boolean) {
          elements.get(id)!.disabled = value;
        },
      };
    },
    addEventListener: (name: string, listener: () => void) => handlers.set(name, listener),
  };
  const replace = vi.fn();
  const confirm = vi.fn(() => false);
  const fetch = vi.fn(async (_url: string, _options?: RequestInit) => {
    if (options.connected === false) throw new TypeError("offline");
    return new Response(options.marker || "showtime-online-v1");
  });
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const source = readFileSync("static/offline.html", "utf8").match(
    /<script>([\s\S]*?)<\/script>/,
  )![1];
  runInNewContext(source, {
    document,
    window: {
      addEventListener: (name: string, listener: () => void) => handlers.set(name, listener),
    },
    location: { pathname: options.path || "/", search: "?module=time", hash: "#main", replace },
    localStorage: storage(data),
    sessionStorage: storage(session),
    matchMedia: () => ({ matches: false }),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    AbortController,
    fetch,
    confirm,
    Intl,
    Date,
  });
  const settled = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { handlers, elements, data, form, replace, confirm, fetch, settled };
}

describe("offline fallback recovery", () => {
  it("automatically returns to the original route when the connection returns and keeps saved drafts", async () => {
    const page = offlinePage();
    await page.settled();
    expect(page.replace).toHaveBeenCalledWith("/?module=time#main");
    expect(JSON.parse(page.data.get("digitalmask-offline-inbox")!)).toHaveLength(1);
    expect(page.fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "omit" });
  });
  it("preserves unfinished input and refuses an unconfirmed manual departure", async () => {
    const page = offlinePage({ title: "Unfinished activity" });
    await page.settled();
    expect(page.replace).not.toHaveBeenCalled();
    expect(page.elements.get("retry")!.textContent).toBe("Zurück zu Showtime");
    page.handlers.get("retry:click")!();
    expect(page.confirm).toHaveBeenCalledTimes(1);
    expect(page.replace).not.toHaveBeenCalled();
    expect(page.form.elements.title.value).toBe("Unfinished activity");
  });
  it("shows a retry state while offline or behind a captive portal without reload loops", async () => {
    for (const options of [{ connected: false }, { marker: "portal login HTML" }]) {
      const page = offlinePage(options);
      await page.settled();
      expect(page.replace).not.toHaveBeenCalled();
      expect(page.elements.get("retry")!.disabled).toBe(false);
      expect(page.elements.get("connection-status")!.textContent).toContain(
        "weiterhin nicht erreichbar",
      );
    }
    const page = offlinePage({ alreadyRetried: true });
    await page.settled();
    expect(page.replace).not.toHaveBeenCalled();
    expect(page.elements.get("retry")!.textContent).toBe("Zurück zu Showtime");
  });
  it("allows explicit return from the standalone offline page", async () => {
    const page = offlinePage({ path: "/offline.html" });
    await page.settled();
    expect(page.replace).not.toHaveBeenCalled();
    page.handlers.get("retry:click")!();
    expect(page.replace).toHaveBeenCalledWith("/");
  });
  it("can adopt unassigned device drafts while account drafts remain tenant scoped", () => {
    setBrowserScope("theater-a", "person");
    expect(preferenceKey("digitalmask-offline-inbox")).toBe("digitalmask-offline-inbox");
    const first = preferenceKey("digitalmask-time-drafts:person");
    setBrowserScope("theater-b", "person");
    expect(preferenceKey("digitalmask-time-drafts:person")).not.toBe(first);
    expect(preferenceKey("digitalmask-theme")).toBe("showtime-theme");
    setBrowserScope("", "");
  });
});
