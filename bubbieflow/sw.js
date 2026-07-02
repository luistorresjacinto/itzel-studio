const CACHE = "bubbieflow-v1";
const SHELL = ["./", "./index.html", "./icon-180.png", "./icon-512.png", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  ]));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const req = e.request;
  const url = new URL(req.url);
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") > -1;

  // Hugging Face model files: transformers.js keeps its own Cache API store, leave them alone
  if (url.hostname.endsWith("huggingface.co") || url.hostname.indexOf("hf.co") > -1) return;

  if (isHTML) {
    // app shell: network first, cache fallback
    e.respondWith(
      fetch(req).then(resp => {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
  } else {
    // everything else (incl. vendored transformers.js lib + wasm): cache first,
    // and let real network failures surface as network errors (no HTML fallback for JS/wasm)
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(resp => {
        if (resp.ok || resp.type === "opaque") {
          const cp = resp.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return resp;
      }))
    );
  }
});
