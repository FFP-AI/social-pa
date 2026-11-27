/* Social PA service worker — offline cache + push-ready */
const CACHE = 'socialpa-v4';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './logo.png', './icon-192.png', './icon-512.png', './icon-180.png',
  './openmic.jpg', './quiz.jpg', './liveband.jpg',
  './picnic.jpg', './party.jpg', './hike.jpg', './cafe.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    // Network-first for the page so updates always land when online.
    e.respondWith(
      fetch(req).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Stale-while-revalidate for assets: fast, but refreshes in the background.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

/* Push-ready: the back end (wired with Ryan) sends the notification;
   this handler displays it. */
self.addEventListener('push', e => {
  let d = { title: 'Social PA', body: "You've got something on this week." };
  try { if (e.data) d = Object.assign(d, e.data.json()); }
  catch (_) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: 'icon-192.png', badge: 'icon-192.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cl => {
    for (const c of cl) { if ('focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});
