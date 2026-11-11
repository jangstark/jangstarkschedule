// 서비스 워커: 앱 화면은 캐시에서 즉시 열고, 데이터(JSONBin/카카오/지오코딩)는 항상 네트워크 사용
const VERSION = 'v2';
const SHELL = 'shell-' + VERSION;
const RUNTIME = 'runtime-' + VERSION;
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const LIB_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net'];     // Leaflet, xlsx
const TILE_HOST = 'tile.openstreetmap.org';
const TILE_LIMIT = 300;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API 프록시(/api/*): 서비스 워커가 개입·캐시하지 않음 (항상 네트워크, 최신 데이터)
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;

  // 페이지: 네트워크 우선(최신 화면), 실패 시 캐시
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { caches.open(SHELL).then(c => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 같은 출처 정적 파일(아이콘 등): 캐시 우선
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // 라이브러리(Leaflet/xlsx): 캐시 우선
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // 지도 타일: 본 곳은 오프라인에서도 보이도록 캐시 (오래된 것부터 정리)
  if (url.hostname === TILE_HOST) {
    e.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trimCache(RUNTIME, TILE_LIMIT + 20); }
        return res;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // 그 외(JSONBin, 카카오, Nominatim 등): 서비스 워커가 개입하지 않음
});
