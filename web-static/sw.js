// Minimal Web Push service worker for TaskTracker. Copied into dist/ by
// scripts/postexport-web.js and registered from lib/push.ts. Handles only
// push delivery and notification clicks - it does not cache/serve the app
// (expo-router's own web worker handles that), so it stays tiny and never
// goes stale in a way that breaks the app shell.

self.addEventListener('push', (event) => {
  let payload = { title: 'TaskTracker', body: 'You have an update.' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
