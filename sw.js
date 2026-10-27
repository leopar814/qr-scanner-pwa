// sw.js
// Cachea solo el "shell" de la app (HTML/CSS/JS/iconos) para que abra rápido
// y funcione sin conexión momentánea. Las llamadas de validación al Apps
// Script SIEMPRE van a la red — nunca se sirven desde caché, porque un
// resultado de validación desactualizado sería peligroso en el acceso.

const CACHE_NAME = "congreso-acceso-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/config.js",
  "./js/app.js",
  "./icons/icon.svg",
  "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar llamadas POST (validación) ni al dominio de Apps Script.
  if (event.request.method !== "GET" || url.hostname.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
