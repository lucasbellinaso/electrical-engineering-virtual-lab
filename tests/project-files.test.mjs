import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeProject,decodeProject,saveProject} from '../assets/js/project-files.js';

test('JSON project metadata and application data round-trip without modification',()=>{
 const data={function:'rosenbrock',x0:-1.2,y0:1,tol:1e-6,maxIter:100,maxEval:1000};
 const text=encodeProject('minimum-search',data);
 assert.deepEqual(decodeProject(text,'minimum-search',v=>v.function==='rosenbrock'),data);
 assert.equal(JSON.parse(text).schemaVersion,1);
});
test('save uses the selected handle and aborts on write failure',async()=>{
 let written='',closed=false,aborted=false,pickerCalls=0;
 const handle={async createWritable(){return {async write(value){written=value;},async close(){closed=true;},async abort(){aborted=true;}};}};
 globalThis.window={async showSaveFilePicker(){pickerCalls++;return handle;}};
 try{
  assert.equal(await saveProject('first','x.json'),handle);assert.equal(written,'first');assert.equal(closed,true);
  await saveProject('second','x.json',handle);assert.equal(pickerCalls,1);assert.equal(written,'second');
  handle.createWritable=async()=>({async write(){throw Error('disk');},async abort(){aborted=true;}});
  await assert.rejects(saveProject('third','x.json',handle),/disk/);assert.equal(aborted,true);
 }finally{delete globalThis.window;}
});
test('rejects malformed, incompatible, excessive and invalid project data',()=>{
 const valid=encodeProject('minimum-search',{x:1});
 for(const text of ['{', 'null', valid.replace('minimum-search','other'),valid.replace('"schemaVersion": 1','"schemaVersion": 2'),' '.repeat(2_000_001)])assert.throws(()=>decodeProject(text,'minimum-search',()=>true));
 assert.throws(()=>decodeProject(valid,'minimum-search',()=>false));
 assert.throws(()=>encodeProject('',{}));
});
