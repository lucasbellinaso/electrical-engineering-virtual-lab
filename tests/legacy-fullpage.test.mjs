import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const catalog=JSON.parse(await read('data/simulators.json'));
const legacy=catalog.filter(item=>item.version?.startsWith('original-'));

test('Legacy full-page button opens the translated wrapper mode, not the raw original',async()=>{
 assert.equal(legacy.length,6);
 for(const item of legacy){
  const html=await read(item.path);
  assert.match(html,/<a class="button primary" href="\?full=1" data-i18n="fullscreen">/,item.id);
  assert.doesNotMatch(html,/<a [^>]*href="\.\/app\.html"/,item.id);
  assert.match(html,/<iframe class="legacy-frame" src="\.\/app\.html(?:\?[^"<>]*)?"/,item.id);
  assert.ok(html.includes('assets/js/legacy-i18n.js'),item.id);
 }
});

test('Full-page mode is driven by the full query parameter and stretches the frame',async()=>{
 const lab=await read('assets/js/lab.js');
 assert.match(lab,/URLSearchParams\(location\.search\)\.has\('full'\)/);
 assert.match(lab,/classList\.add\('is-full'\)/);
 const css=await read('assets/css/main.css');
 assert.match(css,/body\.is-full \.sim-wrapper>:not\(\.legacy-frame\)\{display:none\}/);
 assert.match(css,/body\.is-full \.legacy-frame\{[^}]*height:auto/);
});

test('No text claims that full-page view opens the Portuguese original',async()=>{
 for(const file of ['locales/en.json','locales/es.json','locales/pt-BR.json','assets/js/legacy-i18n.js']){
  const text=await read(file);
  assert.doesNotMatch(text,/opens the Portuguese original|abre el original en portugu|abre o original em portugu|Open Portuguese original|Abrir original e/,file);
 }
});
