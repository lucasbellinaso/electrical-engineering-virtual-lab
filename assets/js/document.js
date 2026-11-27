import {initialize, siteRoot} from './common.js';
import {t, formatNumber} from './i18n.js';
const updateTitle=()=> {const key=document.body.dataset.title;if(key)document.title=t(key)+' — EEVL';};
document.addEventListener('languagechange',updateTitle);
initialize().then(updateTitle).catch(error=>{console.error(error);const p=document.createElement('p');p.className='notice';p.textContent='Unable to load translations / Não foi possível carregar as traduções. Use HTTP.';document.querySelector('main')?.prepend(p);});

const list = document.querySelector('#contributors-list');
if (list) {
  const people = ['Lucas Vizzotto Bellinaso', 'Mauricio Sperandio', 'Carlos Henrique Barriquello'];
  let catalog = [];
  function renderContributors() {
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    for (const key of ['contributorName', 'contributorInstitution', 'contributorApplications']) {
      const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = t(key); header.append(cell);
    }
    const body = table.createTBody();
    for (const name of people) {
      const count = catalog.filter(app => app.status === 'available' && [...app.authors, ...app.contributors].includes(name)).length;
      const row = body.insertRow();
      for (const value of [name, 'UFSM', formatNumber(count)]) row.insertCell().textContent = value;
    }
    list.replaceChildren(table);
  }
  document.addEventListener('languagechange', renderContributors);
  fetch(new URL('data/simulators.json', siteRoot)).then(response => {
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }).then(data => { catalog = data; renderContributors(); }).catch(error => {
    console.error(error); list.textContent = t('loadError');
  });
}

const copyPrompt = document.querySelector('#copy-ai-prompt');
if (copyPrompt) {
  const status = document.querySelector('#copy-ai-status');
  document.addEventListener('languagechange', () => { status.textContent = ''; });
  copyPrompt.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#ai-prompt').textContent);
      status.textContent = t('copyAiSuccess');
    } catch {
      status.textContent = t('copyAiFailure');
    }
  });
}
