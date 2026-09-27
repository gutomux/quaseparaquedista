/**
 * Internationalization helpers: locale detection, loading interface text
 * and translating keys. No DOM access here, so it can be tested in Node.
 */

/** "pt-br" or "pt_BR" -> "pt_BR". */
export function toLocaleCode(tag) {
  const [language, region] = String(tag).replace('-', '_').split('_');
  return region ? `${language.toLowerCase()}_${region.toUpperCase()}` : language.toLowerCase();
}

/**
 * Pick the best supported locale for a list of browser languages.
 * Tries an exact match first (pt-BR -> pt_BR), then the language only
 * (pt-PT or pt -> pt_BR), and falls back to the default.
 * @param {readonly string[]} preferred e.g. navigator.languages
 * @param {string[]} supported e.g. ['en_US', 'pt_BR']
 * @param {string} fallback
 */
export function detectLocale(preferred, supported, fallback) {
  const codes = (preferred || []).map(toLocaleCode);
  for (const code of codes) {
    if (supported.includes(code)) return code;
  }
  for (const code of codes) {
    const language = code.split('_')[0];
    const match = supported.find((s) => s.split('_')[0] === language);
    if (match) return match;
  }
  return fallback;
}

/** Read a nested value by dot path: get(obj, 'search.label'). */
function getPath(obj, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), obj);
}

/**
 * Build a translator for one locale's messages.
 *
 * t('search.label')                      -> plain text
 * t('search.noMatch', { query: 'xyz' })  -> replaces {query}
 * t('search.count', { count: 3 })        -> picks "one" or "other" with Intl.PluralRules
 *
 * A missing key returns the key itself, so gaps are visible but never crash.
 * @param {object} messages Parsed i18n/<locale>.json
 * @param {string} locale e.g. 'pt_BR'
 */
export function createTranslator(messages, locale) {
  const plural = new Intl.PluralRules(locale.replace('_', '-'));
  const interpolate = (text, params) =>
    text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));

  function t(key, params = {}) {
    let value = getPath(messages, key);
    if (value && typeof value === 'object' && !Array.isArray(value) && 'count' in params) {
      value = value[plural.select(params.count)] ?? value.other;
    }
    if (typeof value !== 'string') return key;
    return interpolate(value, params);
  }

  /** Raw access for non-text values such as lists. */
  t.raw = (key) => getPath(messages, key);
  t.locale = locale;
  return t;
}

/**
 * Fetch the interface text for a locale.
 * @param {string} basePath e.g. './i18n'
 * @param {string} locale
 * @param {typeof fetch} [fetchFn] Injectable for testing.
 */
export async function loadMessages(basePath, locale, fetchFn = fetch) {
  const url = `${basePath}/${locale}.json`;
  const response = await fetchFn(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return response.json();
}
