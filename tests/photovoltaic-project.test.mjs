import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../simulators/renewable-energy/photovoltaic/model.js';
import {modulePresets,presetFields} from '../simulators/renewable-energy/photovoltaic/presets.js';
import {validateProject} from '../simulators/renewable-energy/photovoltaic/project.js';
import {encodeProject,decodeProject} from '../assets/js/project-files.js';

test('PV configurations round-trip for both models and commercial modules',()=>{
 for(const model of ['desoto','iec'])for(const preset of ['example','custom',...Object.keys(modulePresets)]){
  const parameters={...defaults};if(modulePresets[preset])for(const k of presetFields)parameters[k]=modulePresets[preset][k];
  Object.assign(parameters,{irradiance:650,temperature:50,series:4,parallel:3,rd:2});
  const data={model,preset,parameters};assert.equal(validateProject(data),true);
  assert.deepEqual(decodeProject(encodeProject('photovoltaic-curves',data),'photovoltaic-curves',validateProject),data);
 }
});
test('PV project rejects malformed data, out-of-range fields and mismatched preset',()=>{
 const data={model:'iec',preset:'example',parameters:{...defaults}};
 for(const bad of [null,{...data,model:'other'},{...data,preset:'bad'},{...data,parameters:{...defaults,voc:251}},{...data,parameters:{...defaults,vmp:60}},{...data,parameters:{...defaults,series:0}},{...data,parameters:{...defaults,voc:50}},{...data,parameters:{...defaults,extra:2}}])assert.equal(validateProject(bad),false);
 assert.throws(()=>decodeProject(encodeProject('other',data),'photovoltaic-curves',validateProject));
});
