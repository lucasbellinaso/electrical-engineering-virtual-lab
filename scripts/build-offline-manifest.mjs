/** Build a deterministic, conservative local dependency inventory for each simulator. */
import {readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {dirname, extname, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const pathOf=file=>relative(root,file).split(sep).join('/');
const catalogue=JSON.parse(await readFile(resolve(root,'data/simulators.json'),'utf8'));
const common=['index.html','manifest.json','assets/css/main.css','assets/js/common.js','assets/js/i18n.js','assets/js/app.js','assets/js/offline.js','data/config.json','data/categories.json','data/simulators.json','data/offline-manifest.json','locales/en.json','locales/pt-BR.json','locales/es.json','assets/branding/logo-icon.svg','assets/branding/favicon.svg'];
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())out.push(...await files(p));else if(e.isFile())out.push(p);}return out;}
async function build(entry){
 const seen=new Set(), queue=[];
 function add(path){const full=resolve(root,path);if(full!==root&&!full.startsWith(root+sep))throw Error(`Dependency outside project: ${path}`);if(!seen.has(full)){seen.add(full);queue.push(full);}}
 for(const path of common)add(path);
 if(entry.offlineDependencies!==undefined&&!Array.isArray(entry.offlineDependencies))throw Error(`offlineDependencies must be an array for ${entry.id}`);
 for(const path of entry.offlineDependencies??[]){
  if(typeof path!=='string'||!path||path.includes('..')||/^(?:[a-z]+:|[\\/])/i.test(path))throw Error(`Invalid explicit dependency for ${entry.id}`);
  const target=resolve(root,path),info=await stat(target).catch(()=>null);if(!info)throw Error(`Missing explicit dependency: ${path}`);
  if(info.isDirectory())for(const file of await files(target))add(file);else add(target);
 }
 for(const file of await files(dirname(resolve(root,entry.path))))add(file);
 // Include all simulator-local files: dynamic fetches and lazily loaded resources stay available.
 while(queue.length){
  const file=queue.shift(),info=await stat(file).catch(()=>null);if(!info)throw Error(`Missing offline dependency: ${pathOf(file)}`);if(!info.isFile())continue;
  const ext=extname(file).toLowerCase();if(!['.html','.js','.mjs','.css'].includes(ext))continue;
  // The minified bundle is self-contained; parsing it would find false dependencies.
  if(pathOf(file).startsWith('assets/vendor/')&&ext!=='.css')continue;
  const content=await readFile(file,'utf8'), deps=[];
  if(ext==='.html'){
   for(const m of content.matchAll(/<(?:script|iframe|img|source)\b[^>]*?\bsrc=["']([^"']+)["']/gi))deps.push(m[1]);
   for(const m of content.matchAll(/<link\b[^>]*?\bhref=["']([^"']+)["']/gi))deps.push(m[1]);
  }
  if(ext==='.js'||ext==='.mjs'||ext==='.html'){
   for(const m of content.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*|new\s+URL\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g))deps.push(m[1]);
  }
  const css=ext==='.css'?content:ext==='.html'?[...content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n'):'';
  for(const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))deps.push(m[1]);
  for(const m of css.matchAll(/@import\s+["']([^"']+)["']/gi))deps.push(m[1]);
  for(const ref of deps){
   if(/^(?:https?:|data:|blob:|mailto:|#|\/)/i.test(ref))continue;
   const clean=decodeURIComponent(ref.split(/[?#]/)[0]);if(!clean)continue;
   const target=resolve(dirname(file),clean),targetInfo=await stat(target).catch(()=>null);
   if(!targetInfo){if(ext==='.html'&&/\.md$/i.test(clean))continue;throw Error(`Missing ${ref} from ${pathOf(file)}`);}
   if(targetInfo.isFile())add(target);
  }
 }
 return [...seen].filter(p=>p!==root).map(pathOf).sort();
}
const simulators={};for(const entry of catalogue.filter(e=>e.status==='available'))simulators[entry.id]={path:entry.path,files:await build(entry)};
const output=JSON.stringify({version:1,simulators},null,2)+'\n',target=resolve(root,'data/offline-manifest.json');
if(process.argv.includes('--check')){const old=await readFile(target,'utf8').catch(()=>null);if(old!==output){console.error('Offline manifest is outdated. Run npm run offline:manifest.');process.exitCode=1;}}
else{await writeFile(target,output,'utf8');console.log(`Offline manifest: ${Object.keys(simulators).length} simulators.`);}
