// Service Worker per Preventivi 3D - PWA & Web Push Notifications
const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
  // Attiva immediatamente la nuova versione del Service Worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Prendi il controllo di tutti i client aperti
  event.waitUntil(self.clients.claim());
});

// Gestione dell'evento PUSH (notifica in arrivo dal server)
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Nuova Richiesta Preventivo!',
    body: 'È arrivata una nuova richiesta di preventivo da revisionare.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: '/preventivi',
    tag: 'quote-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        ...notificationData,
        ...payload,
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/icons/icon-192.png',
    badge: notificationData.badge || '/icons/icon-192.png',
    tag: notificationData.tag || `quote-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: notificationData.url || '/preventivi',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open_quote',
        title: 'Apri Preventivo',
      },
      {
        action: 'dismiss',
        title: 'Chiudi',
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Gestione del click sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/preventivi';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se c'è già una finestra aperta, portala in primo piano e naviga
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Altrimenti apri una nuova finestra PWA
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
