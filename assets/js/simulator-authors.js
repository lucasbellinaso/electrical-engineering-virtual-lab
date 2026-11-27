import {siteRoot} from './common.js';
import {t} from './i18n.js';

const target = document.querySelector('[data-simulator-id]');
if (target) {
  let authors = [];
  const render = () => {
    if (!authors.length) return;
    target.textContent = `${t('simulatorAuthors')}: ${authors.join(' · ')}`;
    target.hidden = false;
  };
  document.addEventListener('languagechange', render);
  fetch(new URL('data/simulators.json', siteRoot))
    .then(response => {
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.json();
    })
    .then(catalog => {
      authors = catalog.find(item => item.id === target.dataset.simulatorId)?.authors || [];
      render();
    })
    .catch(error => console.error('Unable to load simulator authors', error));
}
