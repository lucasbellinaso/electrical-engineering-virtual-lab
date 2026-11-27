import {initialize, siteRoot} from './common.js';
import {t, localized, formatNumber} from './i18n.js';
const updateTitle=()=> {const key=document.body.dataset.title;if(key)document.title=t(key)+' — EEVL';};
document.addEventListener('languagechange',updateTitle);
initialize().then(updateTitle).catch(error=>{console.error(error);const p=document.createElement('p');p.className='notice';p.textContent='Unable to load translations / Não foi possível carregar as traduções. Use HTTP.';document.querySelector('main')?.prepend(p);});

const list = document.querySelector('#contributors-list');
if (list) {
  const people = [
    ['Lucas Vizzotto Bellinaso', 'contributorLucas'],
    ['Mauricio Sperandio', 'contributorMauricio'],
    ['Carlos Henrique Barriquello', 'contributorCarlos']
  ];
  let catalog = [];
  function renderContributors() {
    list.replaceChildren();
    for (const [name, role] of people) {
      const apps = catalog.filter(app => app.status === 'available' && [...app.authors, ...app.contributors].includes(name));
      const section = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = name + ' ? UFSM';
      const description = document.createElement('p'); description.textContent = t(role);
      const count = document.createElement('p'); count.textContent = t('contributorCount', {count: formatNumber(apps.length)});
      const items = document.createElement('ul');
      for (const app of apps) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = new URL(app.path, siteRoot).href; link.textContent = localized(app.title);
        item.append(link); items.append(item);
      }
      section.append(heading, description, count, items); list.append(section);
    }
  }
  document.addEventListener('languagechange', renderContributors);
  fetch(new URL('data/simulators.json', siteRoot)).then(response => {
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }).then(data => { catalog = data; renderContributors(); }).catch(error => {
    console.error(error); list.textContent = t('loadError');
  });
}
