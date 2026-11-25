import {initialize,siteRoot} from './common.js';
import {t,localized} from './i18n.js';
let simulator,category;
function render(){
 if(!simulator)return;
 document.title=localized(simulator.title)+' — EEVL';
 document.querySelector('#lab-title').textContent=localized(simulator.title);
 document.querySelector('#lab-description').textContent=localized(simulator.description);
 document.querySelector('#lab-category').textContent=localized(category.name)+' / '+t('experimental');
 document.querySelector('#lab-metadata').textContent=`${simulator.authors.join(' · ') || t('authorUnspecified')} · ${simulator.version} · PT-BR`;
 document.querySelector('#lab-references').textContent=simulator.references.map(r=>localized(r.title)).join(' · ');
}
document.addEventListener('languagechange',render);
try{
 await initialize();const responses=await Promise.all(['data/simulators.json','data/categories.json'].map(p=>fetch(new URL(p,siteRoot))));
 if(responses.some(r=>!r.ok))throw Error('Metadata unavailable');
 const [simulators,categories]=await Promise.all(responses.map(r=>r.json()));
 simulator=simulators.find(s=>s.id===document.body.dataset.simulator);if(!simulator)throw Error('Unknown simulator');
 category=categories.find(c=>c.id===simulator.category);render();
}catch(error){console.error(error);document.querySelector('#lab-title').textContent=t('loadError');}
