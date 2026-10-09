/**
 * Which language to show: the visitor's own choice from the menu (PT | EN), remembered on
 * this device, or else the browser's language. Every page script asks here, so they agree.
 * js/page-lang.js applies the same rule before the page is shown (keep the key in sync).
 */
import { detectLocale } from './i18n.js';

/** Where the choice is kept, in localStorage. */
export const LOCALE_KEY = 'qp.locale';

/**
 * Pure choice, for testing: a valid saved choice wins, otherwise the browser's languages decide.
 * @param {object} options
 * @param {string|null} options.saved From localStorage.
 * @param {readonly string[]} options.browser navigator.languages.
 * @param {string[]} options.supported
 * @param {string} options.fallback
 */
export function chooseLocale({ saved, browser, supported, fallback }) {
  return supported.includes(saved) ? saved : detectLocale(browser, supported, fallback);
}

/** Storage can be missing or blocked (private mode, site data off), so never let it break a page. */
function readSaved() {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

/** The locale to show on this page. */
export function currentLocale(config) {
  return chooseLocale({
    saved: readSaved(),
    browser: navigator.languages || [navigator.language],
    supported: config.supportedLocales,
    fallback: config.defaultLocale,
  });
}

/** Remember a choice and reload the page in that language (keeping the address, e.g. #entry). */
export function switchLocale(locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    return; // Can't remember it, so a reload would show the same language.
  }
  location.reload();
}
