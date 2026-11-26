import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {integrateBuckPid} from './helpers/buck-pid-reference.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));const hash=b=>createHash('sha256').update(b).digest('hex');
// Exact source transforms bound the SISO initialization guard and Buck plot-only changes.
const SISO_GUARD=["function renderRows() {\n  const box = document.getElementById('pzlist');\n","function renderRows() {\n  if (!P) return;   // EEVL: P é null até o primeiro cálculo da planta; evita TypeError em P.poles\n  const box = document.getElementById('pzlist');\n"];
test('Source hashes are preserved and integrated files match only documented transforms',async()=>{
 const provenance=JSON.parse(await read('docs/provenance.json'));
 for(const file of provenance.files){
  const original=await read(file.source),integrated=await read(file.integrated);assert.equal(hash(original),file.sourceSha256,file.source);
  let expected=original;if(file.id==='siso-design'){assert.equal(original.toString().split(SISO_GUARD[0]).length,2,'SISO guard anchor');expected=Buffer.from(original.toString().replace(SISO_GUARD[0],SISO_GUARD[1]));}if(file.id==='buck-pid')expected=Buffer.from(integrateBuckPid(original.toString()));assert.equal(hash(integrated),file.integratedSha256,file.integrated);
  const inline=text=>[...text.toString('utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);assert.deepEqual(inline(integrated),inline(expected),`Numerical scripts: ${file.id}`);
  if(file.id==='siso-design')assert.equal(integrated.toString().replace('../../../assets/vendor/plotly-2.35.2.min.js','https://cdn.plot.ly/plotly-2.35.2.min.js'),expected.toString());
  else if(file.id==='buck-pid')assert.deepEqual(integrated,expected);
  else assert.deepEqual(integrated,original);
 }
 assert.equal(hash(await read(provenance.logoSource)),provenance.logoSourceSha256);
 assert.equal(hash(await read('assets/vendor/plotly-2.35.2.min.js')),provenance.plotlySha256);
});
