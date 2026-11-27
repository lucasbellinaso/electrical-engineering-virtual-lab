/* Increment VERSION whenever any cached resource changes. Paths are scope-relative. */
const VERSION='eevl-v1.1.34';
const SHELL=VERSION+'-shell', VISITED=VERSION+'-visited';
const root=new URL('./',self.location.href);
const urls=[
 './','index.html','about.html','contribute.html','manifest.json',
 'assets/css/main.css','assets/js/app.js','assets/js/offline.js','assets/js/common.js','assets/js/i18n.js','assets/js/document.js','assets/js/simulator-authors.js','assets/js/lab.js','assets/js/legacy-i18n.js',
 'assets/js/legacy-runtime.js','assets/js/legacy-locales/siso.js','assets/js/legacy-locales/power.js','assets/js/legacy-locales/opamp-pid.js',
 'data/config.json','data/categories.json','data/simulators.json','data/offline-manifest.json','locales/en.json','locales/pt-BR.json','locales/es.json',
 'assets/branding/logo-icon.svg','assets/branding/favicon.svg','assets/icons/icon-192.png','assets/icons/icon-512.png','assets/images/minimum-search.svg','assets/images/photovoltaic.svg','assets/images/dft-spectrum.svg','assets/images/transmission-line.svg','assets/images/digital-modulation.svg',
 'assets/images/control-lab.svg','assets/images/siso.svg','assets/images/buck.svg','assets/images/buck-step.svg','assets/images/dab.svg','assets/images/opamp.svg','assets/images/nodal-analysis.svg','assets/images/rc-rl.svg','assets/images/rlc.svg','assets/images/nodal-analysis-ac.svg','assets/images/magnetostatics.svg','assets/images/electrostatics.svg'
].map(p=>new URL(p,root).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(urls)));});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING'){self.skipWaiting();return;}
 if(!['OFFLINE_STATUS','OFFLINE_PREPARE'].includes(event.data?.type)||!event.ports[0])return;
 const port=event.ports[0];event.waitUntil((async()=>{
  try{
   const shell=await caches.open(SHELL),cache=await caches.open(VISITED),manifestUrl=new URL('data/offline-manifest.json',root);
   const manifestResponse=(await shell.match(manifestUrl))||(await cache.match(manifestUrl));
   if(!manifestResponse)throw Error('manifest unavailable');
   const manifest=await manifestResponse.json(),id=event.data.id;
   if(typeof id!=='string'||!Object.hasOwn(manifest.simulators,id))throw Error('unknown simulator');
   const paths=manifest.simulators[id].files;
   if(!Array.isArray(paths)||!paths.length)throw Error('empty manifest');
   const resources=paths.map(path=>{
    if(typeof path!=='string'||path.startsWith('/')||path.includes('..')||/^[a-z]+:/i.test(path))throw Error('invalid dependency');
    const url=new URL(path,root);if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))throw Error('invalid dependency');return url.href;
   });
   const marker=new URL('__offline_ready__/'+encodeURIComponent(id),root).href;
   if(event.data.type==='OFFLINE_STATUS'){
    const record=await cache.match(marker),metadata=record?await record.json():null;
    let ready=metadata?.version===VERSION;
    if(ready)for(const resource of resources)if(!await cache.match(resource)){ready=false;break;}
    port.postMessage({type:'status',ready});return;
   }
   const temporary='eevl-offline-tmp-'+crypto.randomUUID(),download=await caches.open(temporary);
   try{
    let done=0;
    for(const resource of resources){const response=await fetch(resource,{cache:'no-cache'});if(!response.ok)throw Error('download failed');await download.put(resource,response);port.postMessage({type:'progress',done:++done,total:resources.length});}
    await cache.delete(marker);
    for(const resource of resources){const response=await download.match(resource);if(!response)throw Error('incomplete download');await cache.put(resource,response);}
    for(const resource of resources)if(!await cache.match(resource))throw Error('incomplete cache');
    await cache.put(marker,new Response(JSON.stringify({version:VERSION}),{headers:{'Content-Type':'application/json'}}));
   }finally{await caches.delete(temporary);}
   port.postMessage({type:'complete'});
  }catch(error){port.postMessage({type:'error',message:String(error?.message||error)});}
 })());
});
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
 const isLab=path.startsWith('simulators/')||path.startsWith('templates/')||path.startsWith('assets/vendor/')||path.startsWith('assets/js/core/')||path==='assets/js/buck-pid-scale.js';
 if(urls.includes(key.href)) {
   // Network first so edits to pages, scripts, data and translations show up without clearing caches;
   // the saved copy is used only when offline.
   event.respondWith(caches.open(SHELL).then(async cache=>{try{const response=await fetch(request,{cache:'no-cache'});if(response.ok)await cache.put(key.href,response.clone());return response;}catch{return (await cache.match(key.href))||(await (await caches.open(VISITED)).match(key.href))||offline();}}));
 } else if(isLab) {
   // Cache only resources actually requested by an opened simulator, never the full catalog.
   event.respondWith((async()=>{const cache=await caches.open(VISITED);try{const response=await fetch(request,{cache:'no-cache'});if(response.ok)await cache.put(key.href,response.clone());return response;}catch{const cached=await cache.match(key.href);return cached||offline();}})());
 } else event.respondWith(fetch(request).catch(async()=>{const cache=await caches.open(VISITED);return (await cache.match(key.href))||offline();}));
});
function offline(){return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EEVL · Offline</title><h1>Offline</h1><p lang="en">This resource has not been saved yet. Connect and open it once.</p><p lang="pt-BR">Este recurso ainda não foi armazenado. Conecte-se e abra-o uma vez.</p><p lang="es">Este recurso todavía no se ha guardado. Conéctate y ábrelo una vez.</p><a href="'+new URL('index.html',root).href+'">EEVL · Catalog / Catálogo</a></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});}
