// BK/B/N Sunday school app - service worker
// ስሪት ሲቀይሩ ቁጥሩን ይጨምሩ (v1 -> v2) ተጠቃሚዎች አዲሱን ፋይል እንዲያገኙ።
const CACHE = 'bkbn-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Apps Script (backup/messages) እና ሌሎች የውጭ ጥያቄዎች በጭራሽ አይቀመጡም
  if (url.origin !== self.location.origin) return;

  // መጀመሪያ ኢንተርኔት፣ ከሌለ የተቀመጠውን አሳይ
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
