import {language, setLanguage, t, storage, configureLanguagePicker} from './i18n.js';
export const siteRoot = new URL('../../', import.meta.url);
export let config = {};
const system = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(value) { document.documentElement.dataset.theme = value === 'auto' ? (system.matches ? 'dark' : 'light') : value; }
export async function initialize() {
  let theme = storage.get('eevl-theme') || 'auto';
  if (!['auto','light','dark'].includes(theme)) theme = 'auto';
  applyTheme(theme); system.addEventListener('change', () => { if (theme === 'auto') applyTheme(theme); });
  const themePicker = document.querySelector('#theme');
  if (themePicker) { themePicker.value = theme; themePicker.addEventListener('change', e => { theme = e.target.value; storage.set('eevl-theme',theme); applyTheme(theme); }); }
  configureLanguagePicker();
  await setLanguage(language);
  document.querySelector('#language')?.addEventListener('change', e => { setLanguage(e.target.value).catch(() => { e.target.value = language; alert(t('loadError')); }); });
  try { const res = await fetch(new URL('data/config.json',siteRoot)); if (res.ok) config = await res.json(); } catch { /* A repository link is optional. */ }
  document.querySelectorAll('[data-repository]').forEach(a => { if (config.repositoryUrl && /^https:\/\/github\.com\//.test(config.repositoryUrl)) { a.href = config.repositoryUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; } else a.hidden = true; });
  registerPWA();
}
async function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(new URL('service-worker.js', siteRoot), {scope: siteRoot.pathname});
    const offer = () => { const bar = document.querySelector('#update'); if (bar) bar.hidden = false; };
    if (registration.waiting && navigator.serviceWorker.controller) offer();
    registration.addEventListener('updatefound', () => { registration.installing?.addEventListener('statechange', e => { if (e.target.state === 'installed' && navigator.serviceWorker.controller) offer(); }); });
    document.querySelector('#update-button')?.addEventListener('click', () => registration.waiting?.postMessage({type:'SKIP_WAITING'}));
    let reloading = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading && navigator.serviceWorker.controller) { reloading = true; location.reload(); } });
  } catch (error) { console.warn('PWA:',error); }
}
