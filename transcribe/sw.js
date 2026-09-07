const CACHE = "bubbyscribe-v1";
const SHARED = "bubbyscribe-shared";
const SHELL = ["./", "./index.html", "./icon-180.png", "./icon-512.png", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== SHARED).map(k => caches.delete(k))))
  ]));
});

// Web Share Target (Android / desktop Chrome): the OS POSTs the shared files here.
// Stash them in a cache, then send the app to "./?shared=1" where it picks them up.
async function handleShare(req) {
  const url = new URL(req.url);
  try {
    const fd = await req.formData();
    const files = fd.getAll("files").filter(f => f && typeof f === "object" && f.size > 0);
    const cache = await caches.open(SHARED);
    let i = 0;
    for (const f of files) {
      const name = f.name || ("shared-" + Date.now() + ".m4a");
      await cache.put(
        new URL("./shared/" + Date.now() + "-" + (i++) + "/" + encodeURIComponent(name), url).href,
        new Response(f, { headers: { "content-type": f.type || "application/octet-stream", "x-file-name": encodeURIComponent(name) } })
      );
    }
  } catch (err) {
    console.warn("share-target failed", err);
  }
  return Response.redirect(new URL("./?shared=1", url).href, 303);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith(handleShare(req));
    return;
  }
  if (req.method !== "GET") return;

  // Hugging Face model files: transformers.js keeps its own Cache API store, leave them alone
  if (url.hostname.endsWith("huggingface.co") || url.hostname.indexOf("hf.co") > -1) return;

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") > -1;
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
    // everything else (incl. the shared transformers.js lib + wasm from ../bubbyflow/vendor): cache first
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
