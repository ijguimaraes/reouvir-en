/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };

/** Mesmo nome usado por src/offline/download.ts, que é quem grava neste cache. */
const AUDIO_CACHE = "reouvir-audio-v1";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// O shell do app abre offline; /api, /admin e /audio nunca caem nele (/api/auth nunca é guardado).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api/, /^\/admin/, /^\/audio/] }),
);

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/audio/")) {
    event.respondWith(serveAudio(event.request));
  }
});

/**
 * Serve o MP3 baixado. O <audio> pede com `Range`; o Safari exige resposta 206,
 * então fatiamos o arquivo inteiro guardado no Cache Storage.
 */
async function serveAudio(request: Request): Promise<Response> {
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(request.url);
  if (!hit) return fetch(request);

  const range = request.headers.get("range");
  const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (!match) return hit;

  const buf = await hit.arrayBuffer();
  const size = buf.byteLength;
  let start: number;
  let end: number;
  if (match[1] === "" && match[2] !== "") {
    start = Math.max(size - parseInt(match[2]!, 10), 0); // "bytes=-N": os últimos N bytes
    end = size - 1;
  } else {
    start = match[1] ? parseInt(match[1], 10) : 0;
    end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}
