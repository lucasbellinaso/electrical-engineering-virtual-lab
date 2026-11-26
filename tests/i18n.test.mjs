import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const dictionaries=Object.fromEntries(await Promise.all(['pt-BR','en','es'].map(async code=>[code,JSON.parse(await readFile(new URL(`../locales/${code}.json`,import.meta.url),'utf8'))])));
let counter=0;
async function environment(testContext,{saved=null,browser='en-US',blocked=false,override={}}={}){
 const names=['document','navigator','localStorage','fetch','CustomEvent'];
 const descriptors=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 testContext.after(()=>{for(const key of names){if(descriptors[key])Object.defineProperty(globalThis,key,descriptors[key]);else delete globalThis[key];}});
 const values=new Map(saved===null?[]:[['eevl-language',saved]]),requested=[],events=[];
 const element=dataset=>({dataset,value:'',textContent:'',innerHTML:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;}});
 const picker={value:'',children:[],replaceChildren(...children){this.children=children;}};
 const title=element({i18n:'catalog'}),placeholder=element({i18nPlaceholder:'search'}),accessible=element({i18nAria:'language'}),html=element({i18nHtml:'heroTitle'}),numeric=element({});numeric.value='12.5';
 const groups={'[data-i18n]':[title],'[data-i18n-placeholder]':[placeholder],'[data-i18n-aria]':[accessible],'[data-i18n-html]':[html],'input[type="number"]':[numeric],input:[numeric]};
 const document={documentElement:{lang:''},querySelector:s=>s==='#language'?picker:null,querySelectorAll:s=>groups[s]||[],createElement:()=>element({}),dispatchEvent:event=>events.push(event.type)};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{language:browser}});
 globalThis.document=document;globalThis.localStorage={getItem:key=>{if(blocked)throw Error('blocked');return values.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('blocked');values.set(key,value);}};
 globalThis.CustomEvent=class{constructor(type){this.type=type;}};
 globalThis.fetch=async url=>{
  const code=new URL(url).pathname.split('/').at(-1).replace('.json','');requested.push(new URL(url));
  if(typeof override[code]==='function')return override[code]();
  return {ok:true,json:async()=>structuredClone(override[code]??dictionaries[code])};
 };
 const module=await import(`../assets/js/i18n.js?test=${++counter}`);
 return {module,document,picker,title,placeholder,accessible,html,numeric,requested,values,events};
}

test('Saved valid preference wins; invalid preference falls back to browser detection',async t=>{
 const {module:m}=await environment(t);
 for(const [saved,browser,expected]of [['es','pt-BR','es'],['en','es-MX','en'],['pt-BR','en','pt-BR'],[null,'pt-PT','pt-BR'],[null,'es-AR','es'],['invalid','es-ES','es'],['de','pt','pt-BR'],[null,'de-DE','en'],[null,'it-IT','en']])assert.equal(m.resolveLanguage(saved,browser),expected);
});
test('Initial browser Spanish, native selector and all shared DOM translations',async t=>{
 const e=await environment(t,{browser:'es-MX'}),m=e.module;assert.equal(m.language,'es');m.configureLanguagePicker();
 assert.deepEqual(e.picker.children.map(option=>option.value),['pt-BR','en','es']);assert.equal(e.picker.children.at(-1).textContent,'Español');
 await m.setLanguage('es');assert.equal(e.document.documentElement.lang,'es');assert.equal(e.title.textContent,'Simuladores');assert.equal(e.accessible.attributes['aria-label'],'Idioma');assert.equal(e.placeholder.placeholder,dictionaries.es.search);assert.equal(e.html.innerHTML,dictionaries.es.heroTitle);assert.equal(e.picker.value,'es');assert.ok(e.events.includes('languagechange'));
 assert.ok(e.requested.every(url=>url.pathname.includes('/locales/')));
});
test('Preference persists and blocked storage remains usable',async t=>{
 const e=await environment(t,{saved:'pt-BR',browser:'es-ES'});assert.equal(e.module.language,'pt-BR');await e.module.setLanguage('es');assert.equal(e.values.get('eevl-language'),'es');assert.equal(e.module.resolveLanguage(e.values.get('eevl-language'),'pt-BR'),'es');
});
test('Storage errors do not break detection or selection',async t=>{
 const e=await environment(t,{blocked:true,browser:'pt-PT'});assert.equal(e.module.language,'pt-BR');await e.module.setLanguage('es');assert.equal(e.document.documentElement.lang,'es');
});
test('Per-key English fallback handles absent, empty and non-text translations',async t=>{
 const es={...dictionaries.es};delete es.clear;es.noResults='';es.about=null;
 const {module:m}=await environment(t,{override:{es}});await m.setLanguage('es');
 assert.equal(m.t('clear'),dictionaries.en.clear);assert.equal(m.t('noResults'),dictionaries.en.noResults);assert.equal(m.t('about'),dictionaries.en.about);assert.equal(m.t('unknown-key'),'unknown-key');assert.equal(m.localized({en:'Fallback'}),'Fallback');assert.equal(m.t('resultCount',{count:2,total:10}),'2 de 10 simuladores');
});
test('Formatting respects the locale without changing canonical numeric input or mathematics',async t=>{
 const e=await environment(t),m=e.module;
 for(const code of ['en','pt-BR','es']){await m.setLanguage(code);assert.equal(m.formatNumber(12345.5),new Intl.NumberFormat(code).format(12345.5));assert.equal(e.numeric.value,'12.5');assert.equal(Number(e.numeric.value)*2,25);}
 assert.equal(m.languageLabel('es'),'ES');assert.match(m.languageAvailability(['en','pt-BR']),/EN \/ PT-BR/);assert.doesNotMatch(m.languageAvailability(['en','pt-BR']),/solo en portugués/);
});
test('Latest requested language wins over an earlier slow dictionary response',async t=>{
 let release;const delayed=new Promise(resolve=>{release=resolve;});const {module:m}=await environment(t,{override:{es:async()=>{await delayed;return {ok:true,json:async()=>dictionaries.es};}}});
 const first=m.setLanguage('es');await m.setLanguage('pt-BR');release();await first;assert.equal(m.language,'pt-BR');assert.equal(m.t('language'),'Idioma');
});
test('Unavailable dictionary keeps previous language; invalid requested locale chooses English',async t=>{
 const {module:m,values}=await environment(t,{override:{es:async()=>({ok:false})}});await m.setLanguage('pt-BR');await assert.rejects(m.setLanguage('es'));assert.equal(m.language,'pt-BR');assert.equal(values.get('eevl-language'),'pt-BR');await m.setLanguage('fr');assert.equal(m.language,'en');
});
test('All three locale dictionaries have matching keys and placeholders; catalog Spanish is descriptive only',async()=>{
 const keys=Object.keys(dictionaries.en).sort();
 for(const code of ['pt-BR','es']){
  assert.deepEqual(Object.keys(dictionaries[code]).sort(),keys);
  for(const key of keys)assert.deepEqual((dictionaries[code][key].match(/\{\w+\}/g)||[]).sort(),(dictionaries.en[key].match(/\{\w+\}/g)||[]).sort(),`${code}/${key}`);
 }
 const catalog=JSON.parse(await readFile(new URL('../data/simulators.json',import.meta.url),'utf8'));
 for(const s of catalog){assert.ok(s.title.es&&s.description.es&&s.keywords.es);assert.ok(s.languages.length);}
 const source=await readFile(new URL('../assets/js/app.js',import.meta.url),'utf8');assert.ok(source.includes('Object.values(s.title)'));assert.ok(source.includes('languageAvailability(s.languages)'));assert.ok(!source.includes("t('ptOnly')"));
});
