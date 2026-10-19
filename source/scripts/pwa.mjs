// Đóng gói thành web app cài được lên màn hình chính (iPhone/Android): dist/pwa/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const body = readFileSync('dist/motdoi.html', 'utf8');
const v = Date.now().toString(36);
mkdirSync('dist/pwa', { recursive: true });
const head = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Một Đời</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Một Đời">
<meta name="theme-color" content="#eef2f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e131c" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<style>html,body{margin:0;height:100%;overscroll-behavior:none;-webkit-text-size-adjust:100%}body{padding-top:env(safe-area-inset-top)}#app{height:calc(100% - env(safe-area-inset-top))}</style>
</head>
<body>
`;
const tail = `
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
</body>
</html>`;
writeFileSync('dist/pwa/index.html', head + body + tail);
writeFileSync('dist/pwa/manifest.webmanifest', JSON.stringify({
  name: 'Một Đời', short_name: 'Một Đời', lang: 'vi', start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#eef2f8', theme_color: '#22c55e',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 1));
writeFileSync('dist/pwa/sw.js', `// Lưu game để chơi offline
const C = 'motdoi-${v}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (r.url.includes('/packs/')) { e.respondWith(fetch(r).catch(() => caches.match(r))); return; }
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put('index.html', cp)); return res; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok && (r.url.startsWith(self.location.origin) || r.url.includes('fonts.g'))) { const cp = res.clone(); caches.open(C).then((c) => c.put(r, cp)); } return res; }).catch(() => hit)));
});
`);
console.log('dist/pwa ready');
