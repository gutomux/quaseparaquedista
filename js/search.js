/**
 * Search logic for the glossary.
 *
 * Pure functions only: no DOM access, no network, no global state.
 * That keeps this module easy to test (see tests/search.test.js)
 * and reusable if the view ever changes.
 */

/** Relevance scores, highest first. */
const SCORE = Object.freeze({
  EXACT_ALIAS: 100,
  ALIAS_PREFIX: 80,
  ALIAS_COMPACT_PREFIX: 75,
  NAME_PREFIX: 70,
  WORD_PREFIX: 55,
  NAME_CONTAINS: 40,
  DEFINITION_CONTAINS: 15,
  SHORT_ACRONYM_BONUS: 6,
});

const WORD_SPLIT = /[\s,/()-]+/;

/** Lowercase and strip accents so "Fédération" matches "federation". */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Normalize and keep only letters and digits, so "S&TA" matches "sta". */
export function compact(text) {
  return normalize(text).replace(/[^a-z0-9]/g, '');
}

/**
 * Pre-compute normalized fields for every locale once, so each keystroke
 * only compares strings. Searching covers all locales at the same time.
 * @param {Array<object>} entries Raw entries from glossary.json.
 * @param {string[]} locales e.g. ['en_US', 'pt_BR']
 * @returns {Array<object>} Index items: { entry, locales: [{ locale, aliases, names, definition }] }.
 */
export function createIndex(entries, locales) {
  return entries.map((entry) => ({
    entry,
    locales: locales
      .filter((locale) => entry.translations[locale])
      .map((locale) => {
        const text = entry.translations[locale];
        const names = entry.type === 'acronym' ? [...text.aliases, text.expansion] : [...text.aliases];
        return {
          locale,
          aliases: text.aliases.map((a) => ({ norm: normalize(a), compact: compact(a) })),
          names: names.map((n) => {
            const norm = normalize(n);
            return { norm, words: norm.split(WORD_SPLIT).filter(Boolean) };
          }),
          definition: normalize(text.definition),
        };
      }),
  }));
}

/**
 * Score one locale's text against a query. 0 means no match.
 */
function scoreLocale(type, text, query, minDefinitionQueryLength) {
  const q = normalize(query.trim());
  const qc = compact(query);
  if (!q) return 0;

  const bonus = type === 'acronym' && q.length <= 5 ? SCORE.SHORT_ACRONYM_BONUS : 0;
  let best = 0;

  for (const alias of text.aliases) {
    if (qc && alias.compact === qc) best = Math.max(best, SCORE.EXACT_ALIAS + bonus);
    else if (alias.norm.startsWith(q)) best = Math.max(best, SCORE.ALIAS_PREFIX + bonus);
    else if (qc && alias.compact.startsWith(qc)) best = Math.max(best, SCORE.ALIAS_COMPACT_PREFIX + bonus);
  }

  for (const name of text.names) {
    if (name.norm.startsWith(q)) best = Math.max(best, SCORE.NAME_PREFIX);
    else if (name.words.some((w) => w.startsWith(q))) best = Math.max(best, SCORE.WORD_PREFIX);
    else if (q.length >= 2 && name.norm.includes(q)) best = Math.max(best, SCORE.NAME_CONTAINS);
  }

  if (best === 0 && q.length >= minDefinitionQueryLength && text.definition.includes(q)) {
    best = SCORE.DEFINITION_CONTAINS;
  }
  return best;
}

/**
 * Score an index item across all its locales and report which locale matched best.
 * On a tie, the preferred locale wins.
 * @returns {{score: number, locale: string|null}}
 */
export function scoreItem(item, query, { minDefinitionQueryLength = 3, preferLocale } = {}) {
  let best = { score: 0, locale: null };
  for (const text of item.locales) {
    const score = scoreLocale(item.entry.type, text, query, minDefinitionQueryLength);
    const wins = score > best.score || (score > 0 && score === best.score && text.locale === preferLocale);
    if (wins) best = { score, locale: text.locale };
  }
  return best;
}

/**
 * Return the best-matching entries for a query in any locale, most relevant first.
 * Ties are broken by shorter term, then alphabetically (in the preferred locale).
 * @returns {Array<{entry: object, locale: string}>} Raw entry plus the locale that matched.
 */
export function search(index, query, { limit = 8, minDefinitionQueryLength = 3, preferLocale } = {}) {
  if (!query || !query.trim()) return [];
  const label = (item) => (item.entry.translations[preferLocale] || item.entry.translations[item.locales[0].locale]).term;
  return index
    .map((item) => ({ item, ...scoreItem(item, query, { minDefinitionQueryLength, preferLocale }) }))
    .filter((r) => r.score > 0)
    .sort((a, b) =>
      b.score - a.score
      || label(a.item).length - label(b.item).length
      || label(a.item).localeCompare(label(b.item)))
    .slice(0, limit)
    .map((r) => ({ entry: r.item.entry, locale: r.locale }));
}

/**
 * Split text into plain and matched parts so the view can highlight the match
 * without building HTML strings.
 * @returns {Array<{text: string, match: boolean}>}
 */
export function highlightSegments(text, query) {
  const q = normalize((query || '').trim());
  const start = q ? normalize(text).indexOf(q) : -1;
  if (start < 0) return [{ text, match: false }];
  const end = start + q.length;
  return [
    { text: text.slice(0, start), match: false },
    { text: text.slice(start, end), match: true },
    { text: text.slice(end), match: false },
  ].filter((s) => s.text.length > 0);
}

/**
 * Find entries linked to this one: an acronym and its spelled-out term,
 * or a term whose definition mentions the acronym in parentheses, e.g. "(COA)".
 * Links are worked out in one reference locale so they are the same in every language.
 * @param {Array<object>} entries Raw entries.
 * @param {object} entry Raw entry.
 * @param {object} [options]
 * @param {string} [options.locale='en_US'] Reference locale for matching.
 * @param {number} [options.limit=4]
 * @returns {Array<object>} Raw entries.
 */
export function findRelated(entries, entry, { locale = 'en_US', limit = 4 } = {}) {
  const text = (e) => e.translations[locale];
  const mentions = (definition, alias) =>
    definition.includes(`(${alias})`) || definition.includes(`(${alias}s)`);
  const related = new Map();

  for (const other of entries) {
    if (other.id === entry.id || other.type === entry.type || !text(other) || !text(entry)) continue;
    const [acronym, term] = entry.type === 'acronym' ? [text(entry), text(other)] : [text(other), text(entry)];
    const sameName = normalize(acronym.expansion) === normalize(term.aliases[0]);
    const mentioned = acronym.aliases.some((a) => mentions(term.definition, a));
    if (sameName || mentioned) related.set(other.id, other);
  }
  return [...related.values()].slice(0, limit);
}
