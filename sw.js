const CACHE = 'core-breach-v0.1.1';
const PRECACHE = [
  './',
  './index.html',
  './src/animations.js',
  './src/audio.js',
  './src/combat.js',
  './src/config.js',
  './src/highlights.js',
  './src/hud.js',
  './src/input.js',
  './src/main.js',
  './src/map.js',
  './src/materials.js',
  './src/rng.js',
  './src/scene.js',
  './src/state.js',
  './src/styles.css',
  './fonts/fonts.css',
  './fonts/Orbitron-VariableFont_wght.ttf',
  './fonts/ShareTechMono-Regular.ttf',
  './fonts/phosphor.css',
  './fonts/Phosphor-Light.woff2',
  './libs/three.min.js',
  './libs/utils.css',
  './icon.jpeg',
  './favicon.ico',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
