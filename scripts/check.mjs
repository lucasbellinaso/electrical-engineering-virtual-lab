import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const languages=['pt-BR','en','es'];
const root=fileURLToPath(new URL('../',import.meta.url));
const failures=[];const check=(value,message)=>{if(!value)failures.push(message);};
const load=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
async function walk(dir){let files=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','artifacts','__pycache__'].includes(entry.name))continue;const p=resolve(dir,entry.name);files.push(...(entry.isDirectory()?await walk(p):[p]));}return files;}
const files=await walk(root),exists=async path=>{try{return (await stat(path)).isFile();}catch{return false;}};
let jsCount=0,jsonCount=0,links=0;
for(const file of files){
 const path=relative(root,file),ext=extname(file);
 if(ext==='.json'){try{JSON.parse(await readFile(file,'utf8'));jsonCount++;}catch{failures.push(`Invalid JSON: ${path}`);}}
 if(ext==='.md'){
  const markdown=await readFile(file,'utf8');
  for(const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
   const link=match[1];if(/^(?:https?:|mailto:|#)/.test(link))continue;
   const clean=decodeURIComponent(link.split(/[?#]/)[0]);if(!clean)continue;
   check(await exists(resolve(dirname(file),clean)),`Missing Markdown link: ${path}: ${link}`);links++;
  }
 }
 if(['.js','.mjs'].includes(ext)&&!path.includes('vendor')){const out=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});check(out.status===0,`JavaScript syntax: ${path}: ${out.stderr}`);jsCount++;}
 if(ext==='.html'){
  const html=await readFile(file,'utf8');let index=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(/\bsrc\s*=/.test(match[1])||!match[2].trim())continue;
   const out=spawnSync(process.execPath,['--check','--input-type='+(/type=["']module/.test(match[1])?'module':'commonjs')],{input:match[2],encoding:'utf8'});
   check(out.status===0,`Inline JS ${path} #${++index}: ${out.stderr}`);jsCount++;
  }
  for(const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)){
   const value=match[1];if(/^(?:https?:|data:|blob:|mailto:|#)/.test(value))continue;
   const clean=decodeURIComponent(value.split(/[?#]/)[0]);if(!clean)continue;
   check(!clean.startsWith('/'),`Absolute path: ${path}: ${value}`);
   const target=resolve(dirname(file),clean);check(target.startsWith(root),`Outside project: ${path}: ${value}`);
   check(await exists(target),`Missing link: ${path}: ${value}`);links++;
  }
 }
}
const [catalog,categories]=await Promise.all(['data/simulators.json','data/categories.json'].map(load));
const dictionaries=Object.fromEntries(await Promise.all(languages.map(async code=>[code,await load(`locales/${code}.json`)])));
const en=dictionaries.en;
for(const code of languages){
 const messages=dictionaries[code];
 check(JSON.stringify(Object.keys(en).sort())===JSON.stringify(Object.keys(messages).sort()),`Translation keys differ: ${code}`);
 for(const key of Object.keys(en)){
  check(typeof messages[key]==='string'&&messages[key].length,`Empty translation ${code}/${key}`);
  check(JSON.stringify((en[key].match(/\{\w+\}/g)||[]).sort())===JSON.stringify((String(messages[key]).match(/\{\w+\}/g)||[]).sort()),`Translation placeholders ${code}/${key}`);
 }
}
for(const file of files.filter(f=>/\.(html|js)$/.test(f)&&!f.includes('vendor'))){
 const text=await readFile(file,'utf8');
 for(const m of text.matchAll(/data-i18n(?:-html|-placeholder|-aria)?="([\w-]+)"|\bt\('([\w-]+)'/g)){const key=m[1]||m[2];check(key in en,`Missing translation ${key}: ${relative(root,file)}`);}
}
const ids=new Set(),categoryIds=new Set();
for(const c of categories){check(!categoryIds.has(c.id),`Duplicate category ${c.id}`);categoryIds.add(c.id);check(languages.every(code=>c.name[code]),`Category translations ${c.id}`);}
for(const s of catalog){
 for(const key of ['id','title','description','category','keywords','path','thumbnail','authors','contributors','version','created','updated','difficulty','languages','status','validation','validationEvidence','references'])check(key in s,`Missing metadata ${s.id}.${key}`);
 check(!ids.has(s.id),`Duplicate simulator ${s.id}`);ids.add(s.id);check(categoryIds.has(s.category),`Unknown category ${s.id}`);
 for(const lang of languages)check(s.title[lang]&&s.description[lang]&&Array.isArray(s.keywords[lang]),`Missing catalog translation ${s.id}/${lang}`);
 check(['beginner','intermediate','advanced'].includes(s.difficulty),`Invalid difficulty ${s.id}`);
 check(['available','planned'].includes(s.status),`Invalid status ${s.id}`);
 check(s.languages.every(l=>languages.includes(l)),`Invalid languages ${s.id}`);
 if(s.status==='available'){check(s.path&&s.version&&s.languages.length,`Available metadata ${s.id}`);check(await exists(resolve(root,s.path||'__missing')),`Missing simulator ${s.id}`);}else check(s.path===null&&!s.validation.length,`Planned simulator must not be runnable/validated: ${s.id}`);
 check(await exists(resolve(root,s.thumbnail)),`Missing thumbnail ${s.id}`);
 for(const field of ['path','thumbnail'])if(s[field])check(!/^(?:[a-z]+:|\/|\\)/i.test(s[field])&&!s[field].split('/').includes('..'),`Unsafe catalog path ${s.id}`);
 for(const level of s.validation){check(['experimental','analytically-verified','numerically-validated','experimentally-validated'].includes(level),`Invalid validation ${s.id}`);if(level!=='experimental')check(s.validationEvidence.some(e=>e.level===level&&e.path),`Missing validation evidence ${s.id}/${level}`);}
 for(const evidence of s.validationEvidence)check(await exists(resolve(root,evidence.path)),`Missing evidence file ${s.id}`);
 for(const key of ['created','updated'])check(/^\d{4}-\d{2}-\d{2}$/.test(s[key])&&Number.isFinite(Date.parse(s[key])),`Invalid date ${s.id}`);
}
const manifest=await load('manifest.json');check(manifest.start_url.startsWith('./')&&manifest.scope==='./','Manifest subdirectory scope');
for(const icon of manifest.icons){const data=await readFile(resolve(root,icon.src));check(icon.sizes===`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,`PNG icon size ${icon.src}`);}
const sw=await readFile(resolve(root,'service-worker.js'),'utf8');for(const m of sw.matchAll(/'((?:assets|data|locales)\/[^']+\.[^']+|index\.html|about\.html|contribute\.html|manifest\.json)'/g))check(await exists(resolve(root,m[1])),`Missing precache file ${m[1]}`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Checks passed: ${jsCount} JS scripts, ${jsonCount} JSON files, ${links} local links, ${catalog.length} catalog entries, ${Object.keys(en).length} translation keys per language.`);
