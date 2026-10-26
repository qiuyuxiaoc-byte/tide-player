/* Tide · 离线缓存：壳文件预缓存，音频/封面运行时缓存 */
const SHELL = 'tide-shell-v1';
const MEDIA = 'tide-media-v1';
const FILES = [
  './index.html', './css/base.css', './css/app.css',
  './js/data.js', './js/audio.js', './js/lyrics.js', './js/particles.js', './js/main.js',
  './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== MEDIA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isMedia = /\.(mp3|jpg|jpeg|png|webp)$/i.test(url.pathname);

  if (isMedia) {
    e.respondWith(caches.open(MEDIA).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req);
    if (hit) {
      fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    } catch (err) {
      return caches.match('./index.html');
    }
  }));
});
