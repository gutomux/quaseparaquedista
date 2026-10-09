import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CONFIG } from '../js/config.js';
import { detectLocale } from '../js/i18n.js';

// page-lang.js is a plain browser script; run it in a sandbox without a page.
const sandbox = {};
vm.runInNewContext(readFileSync(new URL('../js/page-lang.js', import.meta.url), 'utf8'), sandbox);
const { pageLang } = sandbox;

/** Run apply() against a fake page and browser. */
function visit(languages) {
  const attrs = {};
  const doc = { documentElement: { lang: 'en-US', setAttribute: (k, v) => { attrs[k] = v; } } };
  const result = pageLang.apply(doc, { languages, language: languages[0] });
  return { ...result, notranslate: attrs.translate === 'no' };
}

test('page language: a Portuguese phone gets a Portuguese page that browsers leave alone', () => {
  assert.deepEqual(visit(['pt-BR', 'en-US']), { lang: 'pt-BR', translate: false, notranslate: true });
  assert.deepEqual(visit(['pt-PT']), { lang: 'pt-BR', translate: false, notranslate: true });
  assert.deepEqual(visit(['en-GB']), { lang: 'en-US', translate: false, notranslate: true });
});

test('page language: other languages get English, which the browser may still translate', () => {
  assert.deepEqual(visit(['es-ES']), { lang: 'en-US', translate: true, notranslate: false });
  assert.deepEqual(visit(['es-AR', 'pt-BR']), { lang: 'pt-BR', translate: true, notranslate: false }, 'Portuguese as a second choice');
  assert.deepEqual(visit([]), { lang: 'en-US', translate: true, notranslate: false });
});

test('page language: picks the same language as the main script, for the locales in config.js', () => {
  const tags = Object.values(pageLang.SUPPORTED).map((t) => t.replace('-', '_')).sort();
  assert.deepEqual(tags, [...CONFIG.supportedLocales].sort());
  for (const langs of [['pt-BR'], ['fr', 'pt'], ['de', 'en-AU'], ['ja'], ['en-US', 'pt-BR']]) {
    const locale = detectLocale(langs, CONFIG.supportedLocales, CONFIG.defaultLocale);
    assert.equal(pageLang.SUPPORTED[pageLang.pick(langs)], locale.replace('_', '-'), langs.join(','));
  }
});

test('page language: every page loads it first, before anything is shown', () => {
  for (const page of ['index.html', 'glossary.html', 'freefall.html', 'materiais-instrucao.html', 'apostila-aff.html', 'revisao-emergencias-aff.html', 'aff-videos.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    const script = html.indexOf('js/page-lang.js');
    assert.ok(script > 0 && script < html.indexOf('<link rel="stylesheet"'), `${page} loads page-lang.js before its stylesheets`);
  }
});

test('language choice: a language picked in the menu wins, on every page script', async () => {
  const { chooseLocale, LOCALE_KEY } = await import('../js/locale.js');
  const base = { supported: CONFIG.supportedLocales, fallback: CONFIG.defaultLocale };
  assert.equal(chooseLocale({ ...base, saved: 'en_US', browser: ['pt-BR'] }), 'en_US', 'English chosen on a Portuguese phone');
  assert.equal(chooseLocale({ ...base, saved: 'pt_BR', browser: ['en-US'] }), 'pt_BR');
  assert.equal(chooseLocale({ ...base, saved: null, browser: ['pt-BR'] }), 'pt_BR', 'no choice: the phone decides');
  assert.equal(chooseLocale({ ...base, saved: 'fr_FR', browser: ['pt-BR'] }), 'pt_BR', 'an unknown saved value is ignored');
  assert.equal(LOCALE_KEY, pageLang.SAVED_KEY, 'the early script reads the same saved choice');
});

test('language choice: the early script follows it, and never offers to translate a chosen language', () => {
  const visitSaved = (languages, saved) => {
    const attrs = {};
    const doc = { documentElement: { lang: 'en-US', setAttribute: (k, v) => { attrs[k] = v; } } };
    return { ...pageLang.apply(doc, { languages }, saved), notranslate: attrs.translate === 'no' };
  };
  assert.deepEqual(visitSaved(['pt-BR'], 'en_US'), { lang: 'en-US', translate: false, notranslate: true });
  assert.deepEqual(visitSaved(['es-ES'], 'pt_BR'), { lang: 'pt-BR', translate: false, notranslate: true });
  assert.deepEqual(visitSaved(['es-ES'], null), { lang: 'en-US', translate: true, notranslate: false }, 'no choice: as before');
});

test('language switch: offers every supported language, named in its own language', async () => {
  const { LANGUAGES } = await import('../js/nav.js');
  for (const locale of CONFIG.supportedLocales) {
    assert.ok(LANGUAGES[locale]?.short && LANGUAGES[locale]?.name, locale);
    assert.equal(LANGUAGES[locale].tag, locale.replace('_', '-'));
  }
});
