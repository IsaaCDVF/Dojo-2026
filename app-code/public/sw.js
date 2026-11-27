// Dojo OS · service worker de la app. Solo sirve para las notificaciones (no guarda nada en caché:
// la app siempre se carga fresca del servidor).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Aviso', {
    body: d.body || '', tag: d.tag, icon: d.icon || '/app/icono-192.png', badge: '/app/icono-192.png',
    data: { url: d.url || '/app/' },
  }));
});

// Al tocar la notificación: abre la app (o la trae al frente) en la pantalla del aviso
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/app/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    const app = ventanas.find((w) => w.url.startsWith(self.location.origin + '/app'));
    if (app) return app.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : w));
    return self.clients.openWindow(url);
  }));
});
