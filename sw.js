const CACHE="itzelstudio-v1";
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./icon-180.png","./icon-512.png","./manifest.json"])));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  var req=e.request;
  var isHTML = req.mode==="navigate" || (req.headers.get("accept")||"").indexOf("text/html")>-1;
  if(isHTML){
    e.respondWith(fetch(req).then(function(resp){var cp=resp.clone();caches.open(CACHE).then(function(c){c.put(req,cp);});return resp;}).catch(function(){return caches.match(req).then(function(r){return r||caches.match("./index.html");});}));
  } else {
    e.respondWith(caches.match(req).then(function(r){return r||fetch(req).then(function(resp){var cp=resp.clone();caches.open(CACHE).then(function(c){c.put(req,cp);});return resp;});}).catch(function(){return caches.match("./index.html");}));
  }
});