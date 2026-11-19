// ===================== NOTIFICATIONS: THE PHONE'S SIDE =====================
// Shaun, 19 Nov: players "receive notifications". This small script lives on
// the phone once a player turns notifications on (features/players/
// notificationsScreen.js). It shows what the club's server sends
// (api/notify.js) and opens the app when one is tapped. It caches nothing:
// the app itself always loads fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Padel';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: data.icon || undefined,
    badge: data.icon || undefined,
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => 'focus' in c);
    if (open) { await open.focus(); if ('navigate' in open) { try { await open.navigate(url); } catch (e) { /* stays where it is */ } } return; }
    await self.clients.openWindow(url);
  })());
});
