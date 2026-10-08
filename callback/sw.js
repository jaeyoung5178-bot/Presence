/* Field Callback OS — Service Worker
   v2: 네트워크 우선(코어 파일) — 업데이트가 즉시 반영되고, 오프라인일 때만 캐시 사용.
   (기존 캐시 우선 방식은 수정해도 아이폰 PWA에 옛 버전이 계속 뜨던 원인) */
const CACHE = "fcos-v21"; /* v21: 필드 카운터와 종이 콜백싯 문서 캐시 분리 */
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./personal-install.js",
  "./manifest.json",
  "./icon.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

/* 새 버전이 대기 중이면 즉시 활성화 (페이지에서 postMessage("skipWaiting")) */
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  /* Firebase 동기화 요청은 절대 캐시하지 않음 */
  if (url.hostname.includes("firebasedatabase.app")) return;

  /* 문서는 경로별 공용 셸로 저장한다. 개인 링크의 u/n/k는 캐시 키에 남기지 않고,
     /callback/과 /callback/index.html은 같은 셸로 정규화한다. */
  const cacheKey = e.request.mode === "navigate"
    ? (url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname)
    : e.request;
  /* 네트워크 우선, 실패 시 같은 경로의 캐시만 사용한다. */
  e.respondWith(
    fetch(e.request)
      .then(async (res) => {
        if (res.ok) {
          try { await (await caches.open(CACHE)).put(cacheKey, res.clone()); }
          catch (_) { /* 캐시 공간 부족이 온라인 문서 열기를 막지 않게 한다. */ }
        }
        return res;
      })
      .catch(() => caches.match(cacheKey))
  );
});
