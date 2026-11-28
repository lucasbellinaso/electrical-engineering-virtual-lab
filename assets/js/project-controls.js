import {encodeProject,decodeProject,saveProject} from './project-files.js';
import {createSessionStore} from './project-sessions.js';

/** Reusable controls. The application owns validation, state capture and restoration. */
export function createProjectControls({container,application,filename,read,restore,validate,snapshot,reset,translate}){
 const root=document.createElement('section');root.className='project-controls';
 root.innerHTML='<div class="actions"><button type="button" class="button" data-project="new" data-m="projectNew"></button><button type="button" class="button" data-project="open" data-m="projectOpen"></button><button type="button" class="button" data-project="save" data-m="projectSave"></button><button type="button" class="button" data-project="saveAs" data-m="projectSaveAs"></button></div><input type="file" accept=".json,application/json" hidden><p role="status" data-project="status"></p><div data-project="recovery" hidden><p data-m="projectRecovery"></p><div class="actions"><button type="button" class="button" data-project="restore" data-m="projectRestore"></button><button type="button" class="button" data-project="dismiss" data-m="projectDismiss"></button></div></div><p role="status" data-project="storage"></p>';
 container.append(root);
 const el=id=>root.querySelector(`[data-project="${id}"]`),input=root.querySelector('input');
 let saved=snapshot(),handle=null,store=null,pending=true,recovery=null,failed=false,timer=null,queue=Promise.resolve();
 const dirty=()=>snapshot()!==saved;
 const show=key=>{el('status').dataset.key=key;el('status').textContent=key?translate(key):'';};
 const enqueue=action=>{queue=queue.then(action).catch(()=>{failed=true;el('storage').textContent=translate('projectStorageError');});return queue;};
 const schedule=()=>{clearTimeout(timer);if(pending||!store||failed)return;timer=setTimeout(()=>{
  if(!dirty()){enqueue(()=>store.remove(application));return;}
  try{const data=read();if(!validate(data))return;const text=encodeProject(application,data);enqueue(()=>store.write(application,text));}catch{/* Preserve the last valid copy while input is incomplete. */}
 },400);};
 const changed=()=>{show(dirty()?'projectUnsaved':'');schedule();};
 const confirmDiscard=()=>!dirty()||window.confirm(translate('projectDiscard'));
 const apply=(data,fileHandle=null)=>{restore(data);handle=fileHandle;saved=snapshot();show('projectOpened');schedule();};
 const load=async(file,fileHandle=null)=>{if(!file)return;try{if(file.size>2_000_000)throw Error('size');const data=decodeProject(await file.text(),application,validate);apply(data,fileHandle);}catch{show('projectError');}};
 el('new').addEventListener('click',()=>{if(!confirmDiscard())return;reset();handle=null;saved=snapshot();show('');schedule();});
 el('open').addEventListener('click',async()=>{if(!confirmDiscard())return;
  if(typeof window.showOpenFilePicker==='function')try{const [h]=await window.showOpenFilePicker({types:[{description:'JSON',accept:{'application/json':['.json']}}],multiple:false});await load(await h.getFile(),h);}catch(e){if(e.name!=='AbortError')show('projectError');}
  else{input.value='';input.click();}
 });
 input.addEventListener('change',()=>load(input.files?.[0]));
 async function save(as){try{const data=read();if(!validate(data))throw Error('invalid');const before=snapshot(),text=encodeProject(application,data);handle=await saveProject(text,filename,as?null:handle);saved=before;show(dirty()?'projectUnsaved':handle?'projectSaved':'projectDownloaded');schedule();}catch(e){if(e.name!=='AbortError')show('projectError');}}
 el('save').addEventListener('click',()=>save(false));el('saveAs').addEventListener('click',()=>save(true));
 el('restore').addEventListener('click',()=>{if(!confirmDiscard())return;restore(recovery);handle=null;saved=null;el('recovery').hidden=true;pending=false;show('projectRecovered');schedule();});
 el('dismiss').addEventListener('click',()=>{el('recovery').hidden=true;pending=false;recovery=null;enqueue(()=>store.remove(application)).then(schedule);});
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 async function initialize(){try{
  store=createSessionStore(window.indexedDB,'eevl-project-sessions:'+new URL('../../',import.meta.url).pathname);
  const text=await store.read(application);
  if(text!==undefined){try{recovery=decodeProject(text,application,validate);}catch{const p=el('recovery').querySelector('p');p.dataset.m='projectRecoveryInvalid';p.textContent=translate('projectRecoveryInvalid');el('restore').disabled=true;}el('recovery').hidden=false;return;}
  pending=false;schedule();
 }catch{pending=false;failed=true;el('storage').textContent=translate('projectStorageError');}}
 const retranslate=()=>{const key=el('status').dataset.key;if(key)show(key);if(failed)el('storage').textContent=translate('projectStorageError');};
 initialize();return {changed,retranslate,root};
}
