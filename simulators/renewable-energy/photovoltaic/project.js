import {defaults,validate} from './model.js';
import {modulePresets,presetFields} from './presets.js';

/** Validate the complete, portable PV configuration before touching the interface. */
export function validateProject(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).sort().join(',')!=='model,parameters,preset')return false;
 if(!['desoto','iec'].includes(data.model)||typeof data.preset!=='string'||!['custom','example',...Object.keys(modulePresets)].includes(data.preset))return false;
 const p=data.parameters;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join(',')!==Object.keys(defaults).sort().join(','))return false;
 try{validate(p);}catch{return false;}
 if(p.voc>250||p.isc>100||p.vmp>250||p.imp>100||p.voc<0.1||p.isc<0.01||p.vmp<0.01||p.imp<0.01||p.beta>-.001||p.rd<.000001)return false;
 const preset=data.preset==='example'?defaults:modulePresets[data.preset];
 return !preset||presetFields.every(key=>p[key]===preset[key]);
}
