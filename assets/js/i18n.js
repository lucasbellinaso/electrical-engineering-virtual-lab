const root = new URL('../../', import.meta.url);
export const storage = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing still works. */ } } };
export let language = storage.get('eevl-language') || (navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en');
if (!['en','pt-BR'].includes(language)) language = 'en';
let messages = {};
export function t(key, values = {}) { return Object.entries(values).reduce((s,[k,v]) => s.replaceAll(`{${k}}`, v), messages[key] ?? key); }
export function localized(value) { return typeof value === 'object' && value !== null ? value[language] ?? value.en ?? '' : value; }
export function translate(container = document) {
  container.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  // Only trusted, bundled translation strings use HTML.
  container.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  container.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  container.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
export async function setLanguage(next) {
  const selected = ['en','pt-BR'].includes(next) ? next : 'en';
  const response = await fetch(new URL(`locales/${selected}.json`, root));
  if (!response.ok) throw new Error('Translation unavailable');
  messages = await response.json(); language = selected; storage.set('eevl-language', selected);
  document.documentElement.lang = language; translate();
  const picker = document.querySelector('#language'); if (picker) picker.value = language;
  document.dispatchEvent(new CustomEvent('languagechange'));
}
