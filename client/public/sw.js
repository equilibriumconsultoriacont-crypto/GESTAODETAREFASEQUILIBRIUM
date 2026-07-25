/* Service worker do Atendimento WhatsApp — recebe push e mostra a notificação
   (funciona com o app fechado) e atualiza o badge no ícone do app. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "Nova mensagem";
  const body = data.body || "Você recebeu uma mensagem no WhatsApp.";
  const url = data.url || "/whatsapp";
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body,
      icon: "/favicon-192.png",
      badge: "/favicon-192.png",
      tag: "wa-msg",
      renotify: true,
      data: { url },
    });
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(data.badge || 1); } catch (e) {}
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/whatsapp";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes("/whatsapp") && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
