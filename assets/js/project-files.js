/** Browser-local JSON project files. App-specific data is validated by the caller. */
export function encodeProject(application, data) {
 if(typeof application!=='string'||!application||!data||typeof data!=='object'||Array.isArray(data))throw new TypeError('Invalid project');
 return JSON.stringify({application,kind:'configuration',schemaVersion:1,data},null,2)+'\n';
}
export function decodeProject(text, application, validate) {
 if(typeof text!=='string'||text.length>2_000_000)throw new RangeError('Invalid project size');
 const project=JSON.parse(text);
 if(!project||project.application!==application||project.kind!=='configuration'||project.schemaVersion!==1||!project.data||typeof project.data!=='object'||Array.isArray(project.data))throw new TypeError('Invalid project metadata');
 if(typeof validate!=='function'||!validate(project.data))throw new TypeError('Invalid project data');
 return project.data;
}
/** Save is initiated by a user gesture. Without the API, the browser downloads a JSON file. */
export async function saveProject(text, filename, previousHandle=null) {
 if(typeof window.showSaveFilePicker==='function'){
  const handle=previousHandle??await window.showSaveFilePicker({suggestedName:filename,types:[{description:'JSON',accept:{'application/json':['.json']}}]});
  const stream=await handle.createWritable();
  try{await stream.write(text);await stream.close();}catch(error){await stream.abort().catch(()=>{});throw error;}
  return handle;
 }
 const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),link=document.createElement('a');
 try{link.href=url;link.download=filename;link.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1500);}
 return null;
}
