import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/simulators.json',root),'utf8'));
const en=JSON.parse(await readFile(new URL('locales/en.json',root),'utf8'));
const es=JSON.parse(await readFile(new URL('locales/es.json',root),'utf8'));

test('Spanish is declared for the original circuit apps, magnetostatics and electrostatics with localized interfaces',async()=>{
 const spanish=catalog.filter(item=>item.languages.includes('es')).map(item=>item.id).sort();
 assert.deepEqual(spanish,['electrostatics','magnetostatics','nodal-analysis','nodal-analysis-ac','rc-rl-first-order','rlc-second-order']);
 for(const path of ['simulators/electrical-circuits/rl-rc/index.html','simulators/electrical-circuits/rlc-series-parallel/index.html']){
  const html=await readFile(new URL(path,root),'utf8');
  for(const [,key] of html.matchAll(/data-i18n(?:-html|-placeholder|-aria)?="([\w-]+)"/g))assert.ok(es[key],`${path}: ${key}`);
 }
 const ui=await readFile(new URL('simulators/electrical-circuits/shared/ui.js',root),'utf8');
 for(const [,key] of ui.matchAll(/\bt\('([\w-]+)'/g))assert.ok(es[key],key);
 for(const key of Object.keys(en).filter(key=>key.startsWith('circuit_')))assert.ok(es[key],key);
});

test('Spanish circuit text preserves scientific symbols and has no damaged encoding',()=>{
 for(const [key,value] of Object.entries(es).filter(([key])=>key.startsWith('circuit_'))){
  assert.doesNotMatch(value,/[?\uFFFD]|(?:soluciónes|deducciónes|tensiónes)/,key);
 }
 assert.match(es.circuit_voltageNote,/t = 0⁺.*t ≥ 0/);
 assert.match(es.circuit_characteristic,/s₁,₂/);
});

test('Both nodal dictionaries cover every English entry and preserve interpolation contracts',async()=>{
 function compare(en,es,path){
  assert.deepEqual(Object.keys(es).sort(),Object.keys(en).sort(),path);
  for(const key of Object.keys(en)){
   const a=en[key],b=es[key],name=`${path}.${key}`;
   if(a&&typeof a==='object')compare(a,b,name);
   else {
    assert.equal(typeof b,typeof a,name);
    assert.ok(String(b).length,name);
    assert.deepEqual((String(b).match(/\$\{[^}]+\}|\{\w+\}/g)||[]).sort(),(String(a).match(/\$\{[^}]+\}|\{\w+\}/g)||[]).sort(),name);
    assert.doesNotMatch(String(b),/\uFFFD|[A-Za-zÁÉÍÓÚáéíóúñ]\?[A-Za-z]/,name);
   }
  }
 }
 for(const name of ['nodal-analysis','nodal-analysis-ac']){
  const source=await readFile(new URL(`simulators/electrical-circuits/${name}/ui.js`,root),'utf8');
  // Execute only the trusted, literal dictionary; never import DOM-dependent UI.
  const literal=source.match(/const TEXT = (\{[\s\S]*?\n\});/);
  assert.ok(literal,name);
  const dict=runInNewContext(`(${literal[1]})`,Object.create(null),{timeout:1000});
  assert.ok(dict.es,`${name}: Spanish dictionary`);
  compare(dict.en,dict.es,name);
 }
});

test('Original imported apps remain cataloged as Portuguese-only until their UI layer is translated',()=>{
 for(const item of catalog.filter(item=>item.version?.startsWith('original-')))assert.deepEqual(item.languages,['pt-BR'],item.id);
});
