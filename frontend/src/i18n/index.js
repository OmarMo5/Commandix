// Tiny, dependency-free i18n. English text is the key: t('Dashboard') returns the Arabic
// entry from ar.js when the language is Arabic, and the text itself otherwise — so an
// untranslated string degrades to English instead of showing a raw key.
//
// The language is fixed for the lifetime of a page load. Switching it reloads the page,
// which keeps every module-level constant (nav items, column labels…) correct without
// any per-component subscription.

import ar, { patterns } from './ar';

const SUPPORTED = ['en', 'ar'];

const readLang = () => {
  try {
    const stored = localStorage.getItem('lang');
    return SUPPORTED.includes(stored) ? stored : 'en';
  } catch {
    return 'en';
  }
};

export const lang = readLang();
export const isRTL = lang === 'ar';
export const dir = isRTL ? 'rtl' : 'ltr';

// Latin digits in Arabic mode keeps numbers consistent with counters and badges elsewhere.
export const locale = isRTL ? 'ar-EG-u-nu-latn' : undefined;

const missing = new Set();

// Arabic has six plural forms. A string that takes `{n}` can add `"<text>|two"`, `"|few"` (3–10 and 103–110…),
// `"|many"` (11–99…) or `"|other"` entries; "one" is written as its own English string ("1 day").
const pluralCategory = (n) => {
  const m = n % 100;
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (m >= 3 && m <= 10) return 'few';
  if (m >= 11) return 'many';
  return 'other';
};

function lookup(text, vars) {
  if (!isRTL) return text;

  if (vars && typeof vars.n === 'number') {
    const variant = `${text}|${pluralCategory(vars.n)}`;
    if (Object.prototype.hasOwnProperty.call(ar, variant)) return ar[variant];
  }
  if (Object.prototype.hasOwnProperty.call(ar, text)) return ar[text];

  for (const [regex, render] of patterns) {
    const match = regex.exec(text);
    if (match) return render(...match.slice(1));
  }

  if (import.meta.env.DEV && /[A-Za-z]{3,}/.test(text)) {
    missing.add(text);
    window.__missingTranslations = [...missing];
  }
  return text;
}

/** Translate `text`; `{name}` placeholders are filled from `vars`. */
export function t(text, vars) {
  if (typeof text !== 'string' || text === '') return text;
  const out = lookup(text, vars);
  return vars ? out.replace(/\{(\w+)\}/g, (whole, key) => (vars[key] ?? whole)) : out;
}

export function setLang(next) {
  try { localStorage.setItem('lang', next); } catch { /* storage blocked: language just won't persist */ }
  window.location.reload();
}

export const toggleLang = () => setLang(isRTL ? 'en' : 'ar');

export const formatDate = (value, options) => new Date(value).toLocaleDateString(locale, options);
export const formatDateTime = (value) => new Date(value).toLocaleString(locale);

/** Sets <html lang dir> and loads the matching Bootstrap build. Resolves once the stylesheet is applied. */
export function applyDocumentLanguage(ltrHref, rtlHref) {
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'bootstrap-css';
    link.href = isRTL ? rtlHref : ltrHref;
    link.onload = link.onerror = () => resolve();
    // First in <head>, so index.css (injected later) keeps overriding Bootstrap.
    document.head.prepend(link);
  });
}
