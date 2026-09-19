// Service Worker for shift-calendar notifications

const CACHE = 'shift-calendar-v1';
const ASSET_PREFIX = '/shift-calendar/assets/';
const APP_SHELL = '/shift-calendar/index.html';
const APP_ROOT = '/shift-calendar/';
const MAX_ASSET_ENTRIES = 40;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function trimAssetCache(cache) {
  const keys = await cache.keys();
  const assetKeys = keys.filter((req) => new URL(req.url).pathname.startsWith(ASSET_PREFIX));
  const excess = assetKeys.length - MAX_ASSET_ENTRIES;
  for (let i = 0; i < excess; i++) {
    await cache.delete(assetKeys[i]);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    await trimAssetCache(cache);
  }
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(APP_SHELL)) || (await cache.match(APP_ROOT));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(ASSET_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate' || url.pathname === APP_ROOT || url.pathname === APP_SHELL) {
    event.respondWith(networkFirst(request));
  }
});

// Show notification from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/shift-calendar/icon-192.png',
      badge: '/shift-calendar/icon-192.png',
    });
  }
});

// Notification click -> open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow('/shift-calendar/');
    })
  );
});
