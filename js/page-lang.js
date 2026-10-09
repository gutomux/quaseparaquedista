/**
 * Sets the page language before anything is shown, and stops browser translation
 * when the page is already in the visitor's language.
 *
 * Loaded as a plain (blocking) script at the top of every page. Without it, pages
 * would declare English until the main script loads and switches the text, and a
 * phone browser could "translate" the Portuguese text as if it were English, which
 * garbles words (seen on a Motorola: "Braços para trás" shown as "Braços para g").
 *
 * A language chosen in the site menu (saved by js/locale.js under the same key) wins over
 * the browser's languages, and such a page is never offered for translation.
 *
 * The languages here must match supportedLocales in js/config.js (a test checks it).
 */
(function (root) {
  /** Language → page language tag. One locale per language, so the language alone decides. */
  var SUPPORTED = { en: 'en-US', pt: 'pt-BR' };
  var FALLBACK = 'en';
  /** Same key as LOCALE_KEY in js/locale.js; holds a locale such as "pt_BR". */
  var SAVED_KEY = 'qp.locale';

  function languageOf(tag) {
    return String(tag || '').toLowerCase().split(/[-_]/)[0];
  }

  /** The first browser language the site has, as js/i18n.js detectLocale picks it. */
  function pick(preferred) {
    for (var i = 0; i < preferred.length; i += 1) {
      var language = languageOf(preferred[i]);
      if (SUPPORTED[language]) return language;
    }
    return FALLBACK;
  }

  /**
   * @param {string|null} [saved] Locale chosen in the site menu, if any.
   * @returns {{lang: string, translate: boolean}} translate is false when the page is
   *   already in the visitor's main language, or in the language they chose, so browsers
   *   shouldn't offer to translate it.
   */
  function apply(doc, nav, saved) {
    var preferred = nav.languages && nav.languages.length ? nav.languages : [nav.language];
    var chosen = languageOf(saved);
    var language = SUPPORTED[chosen] ? chosen : pick(preferred);
    var html = doc.documentElement;
    html.lang = SUPPORTED[language];
    var translate = !SUPPORTED[chosen] && languageOf(preferred[0]) !== language;
    if (!translate) html.setAttribute('translate', 'no');
    return { lang: html.lang, translate: translate };
  }

  function readSaved() {
    try {
      return root.localStorage ? root.localStorage.getItem(SAVED_KEY) : null;
    } catch (e) {
      return null; // storage blocked: fall back to the browser's languages
    }
  }

  root.pageLang = { SUPPORTED: SUPPORTED, SAVED_KEY: SAVED_KEY, pick: pick, apply: apply };
  if (typeof document !== 'undefined' && typeof navigator !== 'undefined') apply(document, navigator, readSaved());
})(this);
