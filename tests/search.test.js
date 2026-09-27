import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalize, compact, createIndex, search, highlightSegments, findRelated,
} from '../js/search.js';
import { validateGlossary, validateEntry, localizeEntry } from '../js/data.js';

const LOCALES = ['en_US', 'pt_BR'];
const data = JSON.parse(readFileSync(new URL('../data/glossary.json', import.meta.url), 'utf8'));
const { entries } = data;
const index = createIndex(entries, LOCALES);

/** Search and return the terms in one locale. */
const terms = (q, locale = 'en_US') =>
  search(index, q, { preferLocale: locale }).map((r) => r.entry.translations[locale].term);
const byEnTerm = (term) => entries.find((e) => e.translations.en_US.term === term);

test('glossary.json is valid in every locale', () => {
  assert.doesNotThrow(() => validateGlossary(data, LOCALES));
});

test('validateEntry reports missing translations and fields', () => {
  const entry = { id: 'x', type: 'acronym', translations: { en_US: { term: 'X', definition: 'd', aliases: ['X'] } } };
  const problems = validateEntry(entry, LOCALES).join('\n');
  assert.match(problems, /\[en_US\]: acronyms need an "expansion"/);
  assert.match(problems, /\[pt_BR\]: translation is missing/);
});

test('localizeEntry falls back to the default locale', () => {
  const entry = { id: 'x', type: 'term', translations: { en_US: { term: 'Arch', definition: 'd', aliases: ['Arch'] } } };
  assert.equal(localizeEntry(entry, 'pt_BR', 'en_US').locale, 'en_US');
});

test('normalize and compact strip case, accents and symbols', () => {
  assert.equal(normalize('Fédération'), 'federation');
  assert.equal(compact('S&TA'), 'sta');
});

test('suggestions start after one letter', () => {
  assert.ok(terms('p').length > 0);
});

test('exact acronym match comes first', () => {
  assert.equal(terms('plf')[0], 'PLF');
  assert.equal(terms('aad')[0], 'AAD');
});

test('symbols in acronyms are optional', () => {
  assert.equal(terms('sta')[0], 'S&TA');
  assert.equal(terms('ci')[0], 'C/I');
});

test('English words find entries for a Portuguese reader', () => {
  assert.equal(terms('canopy', 'pt_BR')[0], 'Velame');
  const [first] = search(index, 'suspension lines', { preferLocale: 'pt_BR' });
  assert.equal(first.locale, 'en_US');
});

test('Portuguese words find entries for an English reader', () => {
  assert.equal(terms('velame')[0], 'Canopy');
  assert.equal(terms('pane')[0], 'Malfunction');
  assert.ok(terms('barrigueira').includes('Chest strap'));
});

test('accents are optional in Portuguese queries', () => {
  assert.equal(terms('queda livre')[0], 'Freefall');
  assert.equal(terms('estol')[0], 'Stall');
  assert.equal(terms('circulo de atencao')[0], 'Circle of awareness');
});

test('the preferred locale wins a tie', () => {
  const [first] = search(index, 'freefly', { preferLocale: 'pt_BR' });
  assert.equal(first.locale, 'pt_BR');
});

test('empty and unknown queries return nothing', () => {
  assert.deepEqual(terms(''), []);
  assert.deepEqual(terms('zzzz'), []);
});

test('respects the suggestion limit', () => {
  assert.ok(search(index, 'a', { limit: 3 }).length <= 3);
});

test('highlightSegments marks the matched part, ignoring accents', () => {
  assert.deepEqual(highlightSegments('Hook turn', 'tu'), [
    { text: 'Hook ', match: false },
    { text: 'tu', match: true },
    { text: 'rn', match: false },
  ]);
  assert.deepEqual(highlightSegments('Estol', 'x'), [{ text: 'Estol', match: false }]);
});

test('findRelated links a term and its acronym', () => {
  const related = findRelated(entries, byEnTerm('Circle of awareness'));
  assert.ok(related.some((e) => e.translations.en_US.term === 'COA'));
});
