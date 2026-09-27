/**
 * Loads, validates and localizes the glossary data. No DOM access here.
 *
 * Each entry stores one block of text per locale:
 *   { id, type, translations: { en_US: {term, expansion?, definition, aliases}, pt_BR: {...} } }
 */

const ENTRY_TYPES = new Set(['acronym', 'term']);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Check one entry and return a list of problems (empty when valid).
 * @param {object} entry
 * @param {string[]} locales Locales every entry must provide.
 * @returns {string[]}
 */
export function validateEntry(entry, locales) {
  if (!entry || typeof entry !== 'object') return ['Entry is not an object.'];
  const label = isText(entry.id) ? `"${entry.id}"` : 'an entry without an id';
  const problems = [];

  if (!isText(entry.id)) problems.push(`${label}: "id" is missing.`);
  if (!ENTRY_TYPES.has(entry.type)) problems.push(`${label}: "type" must be "acronym" or "term".`);
  if (!entry.translations || typeof entry.translations !== 'object') {
    problems.push(`${label}: "translations" is missing.`);
    return problems;
  }

  for (const locale of locales) {
    const text = entry.translations[locale];
    const where = `${label} [${locale}]`;
    if (!text) {
      problems.push(`${where}: translation is missing.`);
      continue;
    }
    if (!isText(text.term)) problems.push(`${where}: "term" is missing.`);
    if (!isText(text.definition)) problems.push(`${where}: "definition" is missing.`);
    if (entry.type === 'acronym' && !isText(text.expansion)) {
      problems.push(`${where}: acronyms need an "expansion".`);
    }
    if (!Array.isArray(text.aliases) || text.aliases.length === 0 || !text.aliases.every(isText)) {
      problems.push(`${where}: "aliases" must be a non-empty list of text.`);
    }
  }
  return problems;
}

/**
 * Validate the whole glossary document.
 * @param {object} data Parsed glossary.json
 * @param {string[]} locales Locales every entry must provide.
 * @throws {Error} Listing every problem found, so data mistakes are easy to fix.
 */
export function validateGlossary(data, locales) {
  if (!data || !Array.isArray(data.entries)) {
    throw new Error('glossary.json must contain an "entries" list.');
  }
  const problems = data.entries.flatMap((e) => validateEntry(e, locales));
  const ids = data.entries.map((e) => e && e.id);
  ids.filter((id, i) => id && ids.indexOf(id) !== i)
    .forEach((id) => problems.push(`Duplicate id "${id}".`));
  if (problems.length) {
    throw new Error(`glossary.json has ${problems.length} problem(s):\n${problems.join('\n')}`);
  }
  return data;
}

/**
 * Flatten an entry into one locale, falling back to another locale
 * if that translation is missing.
 * @returns {{id: string, type: string, locale: string, term: string,
 *            expansion?: string, definition: string, aliases: string[]}}
 */
export function localizeEntry(entry, locale, fallbackLocale) {
  const usedLocale = entry.translations[locale] ? locale : fallbackLocale;
  return { id: entry.id, type: entry.type, locale: usedLocale, ...entry.translations[usedLocale] };
}

/**
 * Fetch and validate the glossary.
 * @param {string} url
 * @param {string[]} locales
 * @param {typeof fetch} [fetchFn] Injectable for testing.
 */
export async function loadGlossary(url, locales, fetchFn = fetch) {
  const response = await fetchFn(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  }
  return validateGlossary(await response.json(), locales);
}
