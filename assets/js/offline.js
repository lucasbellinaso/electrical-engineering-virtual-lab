import {t} from './i18n.js';
const root=new URL('../../',import.meta.url);

/** Add a per-simulator offline preparation control beside the language selector. */
export function setupOfflineButton(){
 const path=decodeURIComponent(location.pathname.slice(root.pathname.length));
 if(!path.startsWith('simulators/')||!path.endsWith('/index.html'))return;
 const picker=document.querySelector('#language');if(!picker)return;
 const button=document.createElement('button');button.type='button';button.disabled=true;button.className='offline-button';button.setAttribute('aria-live','polite');
 button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/></svg>';
 picker.insertAdjacentElement('beforebegin',button);
 let state='offlineDownload',busy=false,registration=null,simulatorId=null;
 const describe=text=>{button.title=text;button.setAttribute('aria-label',text);};
 const label=()=>{button.dataset.state=state;describe(t(state));};
 const setState=next=>{state=next;label();};
 document.addEventListener('languagechange',label);label();
 if(!('serviceWorker' in navigator)||!('caches' in window)){button.disabled=true;setState('offlineUnsupported');return;}
 const request=(type,onProgress)=>new Promise((resolve,reject)=>{
  const worker=registration?.active||navigator.serviceWorker.controller;if(!worker)return reject(Error('worker unavailable'));
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('timeout'));},type==='OFFLINE_STATUS'?10000:180000);
  channel.port1.onmessage=event=>{const msg=event.data;if(msg.type==='progress'){onProgress?.(msg);return;}clearTimeout(timer);channel.port1.close();if(msg.type==='error')reject(Error(msg.message));else resolve(msg);};
  worker.postMessage({type,id:simulatorId},[channel.port2]);
 });
 const start=async()=>{
  try{
   const response=await fetch(new URL('data/offline-manifest.json',root));if(!response.ok)throw Error('manifest');
   const data=await response.json();simulatorId=Object.keys(data.simulators).find(id=>data.simulators[id].path===path);
   if(!simulatorId){button.disabled=true;setState('offlineUnsupported');return;}
   registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('worker timeout')),15000))]);
   const announceUpdate=()=>{if(registration.waiting&&navigator.serviceWorker.controller)setState('offlineNeedsUpdate');};
   registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')announceUpdate();});});
   announceUpdate();if(registration.waiting&&navigator.serviceWorker.controller)return;
   const status=await request('OFFLINE_STATUS');setState(status.ready?'offlineReady':'offlineDownload');
  }catch(error){console.warn('Offline status:',error);setState(registration?.waiting?'offlineNeedsUpdate':'offlineError');}
 };
 button.addEventListener('click',async()=>{
  if(busy)return;if(registration?.waiting){registration.waiting.postMessage({type:'SKIP_WAITING'});button.disabled=true;setState('offlinePreparing');return;}busy=true;button.disabled=true;setState('offlinePreparing');
  try{
   if(!registration||!simulatorId)await start();
   if(!registration||!simulatorId)throw Error('worker unavailable');
   await request('OFFLINE_PREPARE',message=>{describe(t('offlineProgress',{done:message.done,total:message.total}));});
   setState('offlineReady');
  }catch(error){console.warn('Offline preparation:',error);setState('offlineError');}
  finally{busy=false;button.disabled=false;}
 });
 start().finally(()=>{if(!busy&&state!=='offlineUnsupported')button.disabled=false;});
}
