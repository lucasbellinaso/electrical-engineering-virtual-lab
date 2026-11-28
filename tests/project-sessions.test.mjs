import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionStore} from '../assets/js/project-sessions.js';

function fakeIndexedDB(){
 const values=new Map();let fail=false;
 const db={createObjectStore(){},transaction(){
  const tx={error:null,objectStore(){return {
   get(key){return request(()=>values.get(key));},put(value,key){return request(()=>values.set(key,value));},delete(key){return request(()=>values.delete(key));}
  };}};
  function request(action){const req={};queueMicrotask(()=>{if(fail){tx.error=Error('quota');tx.onabort();}else{req.result=action();tx.oncomplete();}});return req;}
  return tx;
 }};
 return {fail(value){fail=value;},open(){const req={result:db};queueMicrotask(()=>{req.onupgradeneeded();req.onsuccess();});return req;}};
}
test('local session store saves, reads and removes snapshots',async()=>{
 const api=fakeIndexedDB(),store=createSessionStore(api);
 assert.equal(await store.read('a'),undefined);
 await store.write('a','{"application":"a"}');assert.equal(await store.read('a'),'{"application":"a"}');
 await store.write('b','other');await store.remove('a');assert.equal(await store.read('a'),undefined);assert.equal(await store.read('b'),'other');
});
test('local session store rejects unavailable storage, invalid snapshots and transaction failure',async()=>{
 assert.throws(()=>createSessionStore(null));const api=fakeIndexedDB(),store=createSessionStore(api);
 assert.throws(()=>store.write('a',{}));assert.throws(()=>store.write('a',' '.repeat(2_000_001)));
 api.fail(true);await assert.rejects(store.write('a','valid'),/quota/);
});
