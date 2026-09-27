import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectLocale, toLocaleCode, createTranslator } from '../js/i18n.js';

const SUPPORTED = ['en_US', 'pt_BR'];
const load = (locale) => JSON.parse(readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), 'utf8'));

test('toLocaleCode normalizes browser tags', () => {
  assert.equal(toLocaleCode('pt-br'), 'pt_BR');
  assert.equal(toLocaleCode('en'), 'en');
});

test('detectLocale picks exact, then language, then fallback', () => {
  assert.equal(detectLocale(['pt-BR', 'en-US'], SUPPORTED, 'en_US'), 'pt_BR');
  assert.equal(detectLocale(['pt-PT'], SUPPORTED, 'en_US'), 'pt_BR');
  assert.equal(detectLocale(['pt'], SUPPORTED, 'en_US'), 'pt_BR');
  assert.equal(detectLocale(['en-GB'], SUPPORTED, 'en_US'), 'en_US');
  assert.equal(detectLocale(['fr-FR', 'de'], SUPPORTED, 'en_US'), 'en_US');
  assert.equal(detectLocale([], SUPPORTED, 'en_US'), 'en_US');
});

test('translator interpolates and pluralizes', () => {
  const t = createTranslator(load('pt_BR'), 'pt_BR');
  assert.equal(t('search.count', { count: 1 }), '1 sugestão');
  assert.equal(t('search.count', { count: 5 }), '5 sugestões');
  assert.match(t('search.noMatch', { query: 'xyz' }), /xyz/);
  assert.equal(t('does.not.exist'), 'does.not.exist');
  assert.ok(Array.isArray(t.raw('examples.items')));
});

/** Collect every dot path in a messages file. */
function paths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? paths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]);
}

test('every locale file has the same keys', () => {
  const [base, ...others] = SUPPORTED.map((l) => paths(load(l)).sort());
  for (const other of others) assert.deepEqual(other, base);
});
