import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const base='https://example.test/EEVL/';
const address=value=>typeof value==='string'?value:value.href??value.url;
async function harness(){
 const handlers={},stores=new Map(),control={failFetch:null,failCommit:null};
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {
  async match(key){return map.get(address(key))?.clone();},
  async put(key,response){if(name.endsWith('-visited')&&address(key)===control.failCommit)throw Error('quota');map.set(address(key),response.clone());},
  async delete(key){return map.delete(address(key));},async keys(){return [...map.keys()].map(url=>new Request(url));}
 };},async delete(name){return stores.delete(name);},async keys(){return [...stores.keys()];}};
 const self={location:{href:base+'service-worker.js'},addEventListener(type,handler){handlers[type]=handler;},clients:{async claim(){}},skipWaiting(){}};
 const fetch=async url=>address(url)===control.failFetch?new Response('unavailable',{status:503}):new Response('ok');
 const code=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 const version=code.match(/const VERSION='([^']+)'/)?.[1];assert.ok(version);
 runInNewContext(code,{self,caches,fetch,URL,Response,Request,crypto:webcrypto,console});
 const shell=await caches.open(version+'-shell');await shell.put(base+'data/offline-manifest.json',new Response(JSON.stringify({simulators:{demo:{files:['a.js','b.js']}}})));
 async function send(type,id='demo') {const messages=[];let pending;handlers.message({data:{type,id},ports:[{postMessage(data){messages.push(data);}}],waitUntil(p){pending=p;}});await pending;return messages;}
 return {send,caches,control,stores,version};
}
test('preparation confirms only after every dependency is stored; missing cache invalidates status',async()=>{
 const h=await harness();const messages=await h.send('OFFLINE_PREPARE');assert.equal(messages.at(-1).type,'complete');assert.deepEqual(messages.filter(x=>x.type==='progress').map(x=>x.done),[1,2]);
 assert.equal((await h.send('OFFLINE_STATUS')).at(-1).ready,true);
 const cache=await h.caches.open(h.version+'-visited');await cache.delete(base+'a.js');assert.equal((await h.send('OFFLINE_STATUS')).at(-1).ready,false);
});
test('failed download or failed cache commit cannot report a new complete preparation',async()=>{
 const h=await harness();h.control.failFetch=base+'b.js';assert.equal((await h.send('OFFLINE_PREPARE')).at(-1).type,'error');assert.equal((await h.send('OFFLINE_STATUS')).at(-1).ready,false);
 h.control.failFetch=null;assert.equal((await h.send('OFFLINE_PREPARE')).at(-1).type,'complete');h.control.failCommit=base+'b.js';
 assert.equal((await h.send('OFFLINE_PREPARE')).at(-1).type,'error');assert.equal((await h.send('OFFLINE_STATUS')).at(-1).ready,false);
 assert.ok(!(await h.caches.keys()).some(key=>key.startsWith('eevl-offline-tmp-')));
});
test('unknown simulator IDs are rejected',async()=>{const h=await harness();assert.equal((await h.send('OFFLINE_PREPARE','unknown')).at(-1).type,'error');});
