/* Never cache authenticated HTML, API responses, uploads, or personal records. */
const CACHE = "showtime-shell-v8";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(
        ["/icon.svg", "/offline.html"].map((url) => new Request(url, { cache: "reload" })),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("showtime-shell-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      // Start the page request while a stopped worker is waking up.
      await self.registration.navigationPreload?.enable().catch(() => undefined);
      await self.clients.claim();
    })(),
  );
});
async function navigationResponse(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
  } catch {
    // A failed preload does not establish that the device is still offline.
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(event.request, { cache: "no-store" });
    } catch {
      // Recover a transient connection failure before replacing the application.
    }
  }
  const cache = await caches.open(CACHE);
  const offline = await cache.match("/offline.html");
  if (!offline) return Response.error();
  const headers = new Headers(offline.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(offline.body, { status: 200, headers });
}
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(navigationResponse(event));
    return;
  }
  if (url.pathname.startsWith("/_app/immutable/")) {
    // Public build assets only. A transient failure must not strand the app at a blank page.
    event.respondWith(fetch(event.request).catch(() => fetch(event.request, { cache: "reload" })));
    return;
  }
  if (url.pathname === "/icon.svg" || url.pathname === "/offline.html")
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match(event.request)) || fetch(event.request)),
    );
});

// Device consent metadata only; no authenticated pages, message bodies or personal records.
function deviceState(write) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("showtime-device", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("state", write ? "readwrite" : "readonly");
      const store = transaction.objectStore("state");
      const operation = write ? store.put(write, "push") : store.get("push");
      let value;
      operation.onsuccess = () => {
        value = operation.result;
      };
      transaction.oncomplete = () => {
        database.close();
        resolve(write || value || {});
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}
async function setBadge(count) {
  try {
    if (count && self.navigator.setAppBadge) await self.navigator.setAppBadge(count);
    else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch {
    /* Badging support varies by operating system. */
  }
}
function safeTarget(value) {
  try {
    const url = new URL(value || "/", self.location.origin);
    return url.origin === self.location.origin && url.pathname === "/"
      ? url.href
      : new URL("/", self.location.origin).href;
  } catch {
    return new URL("/", self.location.origin).href;
  }
}
self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOWTIME_BADGE") return;
  event.waitUntil(
    (async () => {
      const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
      const count = Math.max(0, Math.floor(Number(event.data.count) || 0));
      await deviceState({ ownerId, count, timestamp: Number(event.data.timestamp) || Date.now() });
      await setBadge(count);
      if (!ownerId) {
        const notifications = await self.registration.getNotifications();
        notifications.forEach((notification) => notification.close());
      }
      event.ports[0]?.postMessage({ ok: true });
    })(),
  );
});
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data?.json();
      } catch {
        return;
      }
      if (!payload || typeof payload.ownerId !== "string") return;
      const state = await deviceState();
      // A queued notification must not leak to a logged-out or different account on a shared phone.
      if (state.ownerId !== payload.ownerId) return;
      const count = Math.max(0, Math.floor(Number(payload.unreadCount) || 0));
      if ((Number(payload.timestamp) || 0) >= (state.timestamp || 0)) {
        await deviceState({ ownerId: state.ownerId, count, timestamp: payload.timestamp });
        await setBadge(count);
      }
      await self.registration.showNotification(String(payload.title || "Showtime").slice(0, 120), {
        body: String(payload.body || "Du hast eine neue Mitteilung.").slice(0, 240),
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: String(payload.tag || "showtime"),
        data: { url: safeTarget(payload.url), ownerId: payload.ownerId },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const state = await deviceState();
      const url = safeTarget(
        state.ownerId === event.notification.data?.ownerId ? event.notification.data?.url : "/",
      );
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ("navigate" in client) await client.navigate(url);
        await client.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
