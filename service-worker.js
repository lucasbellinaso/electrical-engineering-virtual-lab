/* Increment VERSION whenever any cached resource changes. Paths are scope-relative. */
const VERSION='eevl-v1.1.0';
const SHELL=VERSION+'-shell', VISITED=VERSION+'-visited';
const root=new URL('./',self.location.href);
const urls=[
 './','index.html','about.html','contribute.html','manifest.json',
 'assets/css/main.css','assets/js/app.js','assets/js/common.js','assets/js/i18n.js','assets/js/document.js','assets/js/lab.js',
 'data/config.json','data/categories.json','data/simulators.json','locales/en.json','locales/pt-BR.json','locales/es.json',
 'assets/branding/logo-icon.svg','assets/branding/favicon.svg','assets/icons/icon-192.png','assets/icons/icon-512.png',
 'assets/images/control-lab.svg','assets/images/siso.svg','assets/images/buck.svg','assets/images/buck-step.svg','assets/images/dab.svg','assets/images/opamp.svg','assets/images/nodal-analysis.svg','assets/images/rc-rl.svg','assets/images/rlc.svg','assets/images/nodal-analysis-ac.svg'
].map(p=>new URL(p,root).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(urls)));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 // Preserve already visited labs across an upgrade, refreshing them online on next use.
 const current=await caches.open(VISITED);
 for(const key of await caches.keys()) {
   if(key.startsWith('eevl-') && key.endsWith('-visited') && key!==VISITED) {
     const old=await caches.open(key);for(const request of await old.keys()){const response=await old.match(request);if(response)await current.put(request,response);}
   }
 }
 await Promise.all((await caches.keys()).filter(k=>k.startsWith('eevl-')&&![SHELL,VISITED].includes(k)).map(k=>caches.delete(k)));
 await self.clients.claim();
})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 const path=url.pathname.slice(root.pathname.length), key=new URL(url); key.search=''; key.hash='';
 const isLab=path.startsWith('simulators/')||path.startsWith('templates/')||path.startsWith('assets/vendor/');
 if(urls.includes(key.href)) {
   // Network first so edits to pages, scripts, data and translations show up without clearing caches;
   // the saved copy is used only when offline.
   event.respondWith(caches.open(SHELL).then(async cache=>{try{const response=await fetch(request,{cache:'no-cache'});if(response.ok)await cache.put(key.href,response.clone());return response;}catch{return (await cache.match(key.href))||offline();}}));
 } else if(isLab) {
   // Cache only resources actually requested by an opened simulator, never the full catalog.
   event.respondWith((async()=>{const cache=await caches.open(VISITED);try{const response=await fetch(request);if(response.ok)await cache.put(key.href,response.clone());return response;}catch{const cached=await cache.match(key.href);return cached||offline();}})());
 } else if(request.mode==='navigate') event.respondWith(fetch(request).catch(()=>offline()));
});
function offline(){return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EEVL · Offline</title><h1>Offline</h1><p lang="en">This resource has not been saved yet. Connect and open it once.</p><p lang="pt-BR">Este recurso ainda não foi armazenado. Conecte-se e abra-o uma vez.</p><p lang="es">Este recurso todavía no se ha guardado. Conéctate y ábrelo una vez.</p><a href="'+new URL('index.html',root).href+'">EEVL · Catalog / Catálogo</a></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});}
