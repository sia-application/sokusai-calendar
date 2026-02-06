const CACHE_NAME = 'sokusai-calendar-v9';
const ASSETS = [
    './',
    './index.html',
    './style.css?v=2',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './sokusai.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
