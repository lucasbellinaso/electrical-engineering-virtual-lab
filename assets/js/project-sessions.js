/** Local recovery snapshots. Values are versioned project JSON, never sent to a server. */
export function createSessionStore(indexedDB, name='eevl-project-sessions') {
 if(!indexedDB)throw new Error('IndexedDB unavailable');
 let opening;
 function database(){
  if(!opening)opening=new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,1);
   request.onupgradeneeded=()=>request.result.createObjectStore('sessions');
   request.onerror=()=>reject(request.error??Error('IndexedDB open failed'));
   request.onblocked=()=>reject(Error('IndexedDB blocked'));
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  }).catch(error=>{opening=null;throw error;});
  return opening;
 }
 async function operation(mode,action){
  const db=await database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('sessions',mode),request=action(tx.objectStore('sessions'));
   tx.oncomplete=()=>resolve(request.result);
   tx.onabort=()=>reject(tx.error??request.error??Error('IndexedDB transaction aborted'));
   tx.onerror=()=>{};
  });
 }
 return {
  read:key=>operation('readonly',store=>store.get(key)),
  write:(key,text)=>{if(typeof text!=='string'||text.length>2_000_000)throw new RangeError('Invalid snapshot');return operation('readwrite',store=>store.put(text,key));},
  remove:key=>operation('readwrite',store=>store.delete(key))
 };
}
