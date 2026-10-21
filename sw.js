// =====================================================
// SERVICE WORKER: hace que la app funcione sin internet
// Cambia VERSION cada vez que modifiques archivos para que se actualice
// =====================================================
const VERSION = "v1";
const CACHE = `mi-calendario-${VERSION}`;

const ARCHIVOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./iconos/icono.svg",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/apple-touch-icon.png",
];

// Al instalarse: guarda los archivos de la app en la caché
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// Al activarse: borra las cachés de versiones antiguas
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(claves =>
      Promise.all(claves.filter(c => c !== CACHE).map(c => caches.delete(c)))
    )
  );
  self.clients.claim();
});

// Cada petición: responde rápido con la caché y la actualiza por detrás
// (así funciona sin conexión y las fuentes de Google también se guardan)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const enCache = await cache.match(e.request);
      const deRed = fetch(e.request)
        .then(resp => {
          if (resp.ok || resp.type === "opaque") cache.put(e.request, resp.clone());
          return resp;
        })
        .catch(() => enCache);
      return enCache || deRed;
    })
  );
});
