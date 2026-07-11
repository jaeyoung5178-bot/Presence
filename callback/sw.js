/* Field Callback OS — Service Worker
   v2: 네트워크 우선(코어 파일) — 업데이트가 즉시 반영되고, 오프라인일 때만 캐시 사용.
   (기존 캐시 우선 방식은 수정해도 아이폰 PWA에 옛 버전이 계속 뜨던 원인) */
const CACHE = "fcos-v4"; /* v4: 전체 누적 기준일(2026-07-09) 필터 + 기준일 표시 */
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

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

  /* 네트워크 우선, 실패 시 캐시 (오프라인 대비) */
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
