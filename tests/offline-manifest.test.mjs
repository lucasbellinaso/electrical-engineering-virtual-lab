import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
test('offline manifest is generated from the current catalogue and all dependencies exist',async()=>{
 const manifest=await read('../data/offline-manifest.json'),catalogue=await read('../data/simulators.json');
 const available=catalogue.filter(item=>item.status==='available');
 assert.deepEqual(Object.keys(manifest.simulators).sort(),available.map(item=>item.id).sort());
 for(const entry of available){const record=manifest.simulators[entry.id];assert.equal(record.path,entry.path);assert.ok(record.files.includes(entry.path));assert.ok(record.files.includes('data/offline-manifest.json'));assert.ok(record.files.includes('assets/js/offline.js'));assert.equal(new Set(record.files).size,record.files.length);for(const path of record.files){assert.ok(!path.startsWith('/')&&!path.split('/').includes('..'));await access(new URL('../'+path,import.meta.url));}}
 assert.doesNotThrow(()=>execFileSync(process.execPath,['scripts/build-offline-manifest.mjs','--check'],{cwd:root,stdio:'pipe'}));
});
test('lazy workers, local mathematical typesetting fonts and plotting bundle are included',async()=>{
 const {simulators}=await read('../data/offline-manifest.json');
 assert.ok(simulators.magnetostatics.files.includes('simulators/electromagnetics/magnetostatics/worker.js'));
 assert.ok(simulators['rc-rl-first-order'].files.includes('simulators/electrical-circuits/shared/worker.js'));
 assert.ok(simulators['photovoltaic-curves'].files.some(p=>p.startsWith('assets/vendor/katex/fonts/')&&p.endsWith('.woff2')));
 assert.ok(simulators['minimum-search'].files.includes('assets/vendor/plotly-2.35.2.min.js'));
 assert.ok(!simulators['photovoltaic-curves'].files.includes('assets/vendor/plotly-2.35.2.min.js'));
});
