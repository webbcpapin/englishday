/* Only explicitly enumerated public assets are cached. API, tokens, responses,
 * recordings, identity and employee data never enter Cache Storage. */
const VERSION='cec-public-v2-20261126-1';
const FILES=['./','index.html','manifest.webmanifest','styles/app.css','styles/legacy.css','js/config.js','js/app.mjs','js/core.mjs','js/api.mjs','js/storage.mjs','js/speech.mjs','data/curriculum.mjs','data/grammar.mjs','data/questions.js','data/sources.js','assets/english-day/english_day_favicon_32.png','assets/english-day/english_day_favicon_180.png','assets/english-day/english_day_favicon_192.png','assets/english-day/english_day_favicon_512.png'];
const urls=FILES.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(urls))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cec-public-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||e.request.headers.has('Authorization'))return;
 const u=new URL(e.request.url);u.hash='';if(u.origin!==self.location.origin||u.search||!urls.includes(u.href))return;
 e.respondWith(caches.match(u.href).then(cached=>cached||fetch(e.request)));
});
