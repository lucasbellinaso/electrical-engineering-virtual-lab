import {initialize} from './common.js';
import {t} from './i18n.js';
const updateTitle=()=> {const key=document.body.dataset.title;if(key)document.title=t(key)+' — EEVL';};
document.addEventListener('languagechange',updateTitle);
initialize().then(updateTitle).catch(error=>{console.error(error);const p=document.createElement('p');p.className='notice';p.textContent='Unable to load translations / Não foi possível carregar as traduções. Use HTTP.';document.querySelector('main')?.prepend(p);});
