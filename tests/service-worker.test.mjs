import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
function harness(){
 const handlers={},stores=new Map();let online=true,claimed=false,skipped=false;
 const root='https://example.test/electrical-engineering-virtual-lab/';
 const normalize=k=>typeof k==='string'?k:k.url;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {async addAll(urls){for(const url of urls)map.set(url,new Response('shell:'+url));},async put(k,v){map.set(normalize(k),v);},async match(k){return map.get(normalize(k))?.clone();},async keys(){return [...map.keys()].map(url=>new Request(url));}};},async keys(){return [...stores.keys()];},async delete(key){return stores.delete(key);}};
 const self={location:{href:root+'service-worker.js'},clients:{async claim(){claimed=true;}},skipWaiting(){skipped=true;},addEventListener(name,fn){handlers[name]=fn;}};
 vm.runInNewContext(source,{self,caches,URL,Response,fetch:async request=>{if(!online)throw Error('offline');return new Response('network:'+normalize(request));}});
 return {root,stores,caches,offline(){online=false;},get claimed(){return claimed;},get skipped(){return skipped;},async lifecycle(name){let pending;handlers[name]({waitUntil(p){pending=p;}});await pending;},message(data){handlers.message({data});},async request(path,mode='navigate'){let response;handlers.fetch({request:{method:'GET',url:new URL(path,root).href,mode},respondWith(p){response=p;}});return await response;}};
}
test('PWA shell supports subdirectories, installs no simulator and claims clients',async()=>{
 const h=harness();await h.lifecycle('install');assert.ok([...h.stores.values()].every(map=>[...map.keys()].every(url=>url.startsWith(h.root)&&!url.includes('/simulators/')&&!url.includes('/vendor/'))));
 await h.lifecycle('activate');assert.equal(h.claimed,true);h.message({type:'SKIP_WAITING'});assert.equal(h.skipped,true);
});
test('Only visited laboratory resources are cached; query URLs work offline',async()=>{
 const h=harness();await h.lifecycle('install');await h.lifecycle('activate');
 await h.request('simulators/control-systems/siso/index.html');await h.request('assets/vendor/plotly-2.35.2.min.js','cors');
 h.offline();assert.equal((await h.request('simulators/control-systems/siso/index.html?voltage=10')).status,200);assert.equal((await h.request('assets/vendor/plotly-2.35.2.min.js','cors')).status,200);
 assert.equal((await h.request('simulators/never-visited/index.html')).status,503);assert.equal((await h.request('index.html')).status,200);
 assert.equal(await h.request('../unrelated/index.html'),undefined);
});
test('Updates preserve visited laboratories, remove only EEVL caches',async()=>{
 const h=harness();const old=await h.caches.open('eevl-v0-visited');await old.put(h.root+'simulators/old.html',new Response('saved lab'));await h.caches.open('eevl-v0-shell');await h.caches.open('unrelated-project');
 await h.lifecycle('install');await h.lifecycle('activate');h.offline();assert.equal(await (await h.request('simulators/old.html')).text(),'saved lab');assert.ok(!h.stores.has('eevl-v0-shell'));assert.ok(h.stores.has('unrelated-project'));
});

test('Shell files are served network-first and fall back to the saved copy offline',async()=>{
 const h=harness();await h.lifecycle('install');await h.lifecycle('activate');
 assert.equal(await (await h.request('data/simulators.json','cors')).text(),'network:'+h.root+'data/simulators.json');
 assert.equal(await (await h.request('index.html')).text(),'network:'+h.root+'index.html');
 h.offline();
 assert.equal(await (await h.request('data/simulators.json','cors')).text(),'network:'+h.root+'data/simulators.json');
 assert.equal((await h.request('index.html')).status,200);
});
