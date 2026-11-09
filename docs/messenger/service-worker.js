const CACHE_NAME = "qun-messenger-shell-v1";
const SHELL_URLS = ["./", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key.startsWith("qun-messenger-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// Cache only the Messenger shell. Never cache authenticated API responses,
// Realtime traffic, private attachment URLs, or Supabase requests.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put("./", copy));
      }
      return response;
    }).catch(async () => (await caches.match("./")) || Response.error())
  );
});

// This receiver is ready for server-sent Web Push. It does not itself create
// subscriptions or send pushes; those require VAPID keys and a trusted sender.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const isCall = payload.type === "call";
  const title = payload.title || (isCall ? "Входящий звонок · QUN" : "Новое сообщение · QUN");
  const options = {
    body: payload.body || (isCall ? "Вам звонят" : "Откройте QUN, чтобы прочитать сообщение."),
    icon: "../assets/qun-icon.jpg",
    badge: "../assets/qun-favicon.svg",
    tag: payload.tag || (isCall ? "qun-incoming-call" : "qun-message"),
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [250, 100, 250, 100, 400] : [180, 80, 180],
    data: { url: payload.url || "./", type: payload.type || "message" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.focus();
      if ("navigate" in existing && existing.url !== target) await existing.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});