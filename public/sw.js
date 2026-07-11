importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE = 'afftrack-v2';
const ASSETS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/').then((r) => r || Response.error())));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
