'use strict';

// SINGLE SOURCE OF TRUTH for the app version. Bump this one value on every
// release: the new SW precaches fresh copies (bypassing the HTTP cache via
// cache:'reload'), drops old caches on activate, and the page auto-reloads.
// No per-asset ?v= query strings to keep in sync.
const CACHE = 'wardice-v29';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './sounds/roll.mp3',
];

self.addEventListener('install', e => {
  // fetch with cache:'reload' so a new SW version never precaches stale
  // copies out of the browser HTTP cache
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u =>
        fetch(u, { cache: 'reload' }).then(r => { if (r.ok) return c.put(u, r); })
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
