import {initialize, siteRoot} from './common.js';
import {t, localized, language, languageLabel, languageAvailability, formatNumber} from './i18n.js';
let catalog = [], categories = [], category = '';
const $ = s => document.querySelector(s);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function categoryName(id) { return localized(categories.find(c => c.id === id)?.name) || id; }
function safePath(path) { if (!path || path.includes('..') || /^(?:[a-z]+:|\/|\\)/i.test(path)) return ''; return new URL(path, siteRoot).href; }
function renderCategories() {
  const options = [{id:'',name:t('allFields'),icon:'◈'},...categories];
  $('#categories').innerHTML = options.map(c => `<button class="category ${category === c.id ? 'selected':''}" data-category="${escape(c.id)}" aria-pressed="${category === c.id}"><span class="category-icon" aria-hidden="true">${escape(c.icon || '◇')}</span><span>${escape(localized(c.name))}</span><span class="category-count">${formatNumber(catalog.filter(s => !c.id || s.category === c.id).length)}</span></button>`).join('');
  $('#categories').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { category = b.dataset.category; render(); }));
}
function card(s) {
  const available = s.status === 'available' && safePath(s.path);
  return `<article class="sim-card ${available ? '':'is-planned'}"><div class="card-art"><img src="${safePath(s.thumbnail)}" alt="" loading="lazy" width="480" height="230"><span class="status ${available ? 'available':''}">${available ? '<span class="live-dot"></span>':''}${t(s.status)}</span></div><div class="card-body"><div class="card-category">${escape(categoryName(s.category))}</div><h3>${escape(localized(s.title))}</h3><p>${escape(localized(s.description))}</p><div class="card-tags"><span>▥ ${t(s.difficulty)}</span><span>${s.languages.length ? s.languages.map(languageLabel).join(' / ') : t('notDefined')}</span></div><div class="card-footer">${available ? `<a class="open-link" href="${safePath(s.path)}">${t('openSimulator')} <span aria-hidden="true">↗</span></a>` : `<span class="planned-label">${t('awaitingFiles')}</span>`}<span class="validation" title="${escape(t('experimentalHelp'))}">${t(s.validation[0] || 'noValidation')}</span></div>${available && !s.languages.includes(language) ? `<p class="language-note">${escape(languageAvailability(s.languages))}</p>` : ''}</div></article>`;
}
function render() {
  renderCategories();
  const query = normalize($('#search').value.trim());
  const filtered = catalog.filter(s => (!category || s.category === category) && (!$('#difficulty').value || s.difficulty === $('#difficulty').value) && (!$('#status').value || s.status === $('#status').value) && normalize([...Object.values(s.title),...Object.values(s.description),...Object.values(s.keywords).flat(),categoryName(s.category)].join(' ')).includes(query));
  filtered.sort($('#sort').value === 'title' ? (a,b) => localized(a.title).localeCompare(localized(b.title),language) : (a,b) => (a.status === b.status ? b.updated.localeCompare(a.updated) : a.status === 'available' ? -1:1));
  $('#simulators').innerHTML = filtered.map(card).join(''); $('#empty').hidden = filtered.length > 0;
  $('#results-count').textContent = t('resultCount',{count:formatNumber(filtered.length),total:formatNumber(catalog.length)});
  $('#available-count').textContent = t('availableCount',{count:formatNumber(catalog.filter(s => s.status === 'available').length)});
  const recent = catalog.filter(s => s.status === 'available').sort((a,b) => b.created.localeCompare(a.created)).slice(0,3);
  $('#recent').innerHTML = recent.map(s => `<a class="recent-item" href="${safePath(s.path)}"><img src="${safePath(s.thumbnail)}" alt="" width="150" height="85"><div><span class="eyebrow">${escape(categoryName(s.category))}</span><h3>${escape(localized(s.title))}</h3><span>${new Intl.DateTimeFormat(language,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(s.created))} · ${t(s.validation[0] || 'noValidation')}</span></div><span aria-hidden="true">↗</span></a>`).join('');
}
async function start() {
  await initialize();
  const responses = await Promise.all(['data/simulators.json','data/categories.json'].map(p => fetch(new URL(p,siteRoot))));
  if (responses.some(r => !r.ok)) throw new Error('Catalog unavailable');
  [catalog,categories] = await Promise.all(responses.map(r => r.json()));
  render(); document.addEventListener('languagechange',render);
  $('#filters').addEventListener('submit',e => e.preventDefault());
  ['search','difficulty','status','sort'].forEach(id => $('#'+id).addEventListener(id === 'search' ? 'input':'change',render));
  $('#clear').addEventListener('click', () => { $('#filters').reset(); category = ''; render(); });
  document.addEventListener('keydown', e => { if (e.key === '/' && !e.ctrlKey && !e.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); } });
}
start().catch(error => { console.error(error); const el = $('#load-error'); el.hidden = false; el.textContent = t('loadError') === 'loadError' ? 'Unable to load. Serve this folder over HTTP / Não foi possível carregar. Sirva esta pasta por HTTP.' : t('loadError'); });
