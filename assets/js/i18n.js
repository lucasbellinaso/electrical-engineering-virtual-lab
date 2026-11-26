const root = new URL('../../', import.meta.url);
export const SUPPORTED_LANGUAGES = Object.freeze(['pt-BR', 'en', 'es']);
export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Optional storage. */ } }
};
export function resolveLanguage(saved, browserLanguage = 'en') {
  if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
  const primary = String(browserLanguage).toLowerCase().split(/[-_]/)[0];
  return primary === 'pt' ? 'pt-BR' : primary === 'es' ? 'es' : 'en';
}
export let language = resolveLanguage(storage.get('eevl-language'), navigator.language);
let messages = {}, english = {}, englishPromise, requestVersion = 0;
export const languageLabel = code => ({'pt-BR': 'PT-BR', en: 'EN', es: 'ES'}[code] ?? code);
export function formatNumber(value, options = {}) { return new Intl.NumberFormat(language, options).format(value); }
export function t(key, values = {}) {
  const text = [messages[key], english[key]].find(value => typeof value === 'string' && value.length) ?? key;
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), text);
}
export function localized(value) {
  return typeof value === 'object' && value !== null ? value[language] ?? value.en ?? '' : value;
}
export function languageAvailability(languages) {
  return t('languageAvailability', {languages: languages.map(languageLabel).join(' / ')});
}
export function configureLanguagePicker(picker = document.querySelector('#language')) {
  if (!picker) return;
  picker.replaceChildren(...SUPPORTED_LANGUAGES.map(code => {
    const option = document.createElement('option');
    option.value = code; option.lang = code;
    option.textContent = code === 'es' ? 'Español' : languageLabel(code);
    return option;
  }));
  picker.value = language;
}
export function translate(container = document) {
  container.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  // HTML comes exclusively from bundled dictionaries; numeric input values are never translated.
  container.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  container.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  container.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
async function loadMessages(code) {
  const response = await fetch(new URL(`locales/${code}.json`, root));
  if (!response.ok) throw new Error(`Translation unavailable: ${code}`);
  return response.json();
}
export async function setLanguage(next) {
  const selected = SUPPORTED_LANGUAGES.includes(next) ? next : 'en';
  const version = ++requestVersion;
  englishPromise ??= loadMessages('en').catch(error => { englishPromise = undefined; throw error; });
  const [fallback, translated] = await Promise.all([englishPromise, selected === 'en' ? englishPromise : loadMessages(selected)]);
  // A slow earlier request cannot replace a more recent selection.
  if (version !== requestVersion) return;
  english = fallback; messages = translated; language = selected;
  storage.set('eevl-language', selected); document.documentElement.lang = language; translate();
  const picker = document.querySelector('#language'); if (picker) picker.value = language;
  document.dispatchEvent(new CustomEvent('languagechange'));
}
