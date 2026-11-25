import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));const hash=b=>createHash('sha256').update(b).digest('hex');
test('All supplied files match recorded SHA-256; every numerical script is unchanged',async()=>{
 const provenance=JSON.parse(await read('docs/provenance.json'));
 for(const file of provenance.files){
  const original=await read(file.source),integrated=await read(file.integrated);assert.equal(hash(original),file.sourceSha256,file.source);assert.equal(hash(integrated),file.integratedSha256,file.integrated);
  const inline=text=>[...text.toString('utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);assert.deepEqual(inline(integrated),inline(original),`Numerical scripts: ${file.id}`);
  if(file.id==='siso-design')assert.equal(integrated.toString().replace('../../../assets/vendor/plotly-2.35.2.min.js','https://cdn.plot.ly/plotly-2.35.2.min.js'),original.toString());
  else if(file.id==='buck-pid')assert.equal(integrated.toString(),original.toString().replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^>]+>\r?\n?/g,''));
  else assert.deepEqual(integrated,original);
 }
 assert.equal(hash(await read(provenance.logoSource)),provenance.logoSourceSha256);
 assert.equal(hash(await read('assets/vendor/plotly-2.35.2.min.js')),provenance.plotlySha256);
});
