import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const messages = (locale) => JSON.parse(read(`i18n/${locale}.json`));
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

test('welcome page: the three tools are linked right after the welcome text', () => {
  const html = read('index.html');
  const lead = html.indexOf('home-lead');
  const tools = html.indexOf('class="home-tools"');
  assert.ok(lead > 0 && tools > lead && tools < html.indexOf('class="home-intro"'), 'tool cards come right after the welcome text');
  for (const href of ['glossary.html', 'freefall.html', 'materiais-instrucao.html']) {
    assert.match(html, new RegExp(`<a class="home-tool" href="${href}">`), `links to ${href}`);
  }
});

test('welcome page: each visitor card leads somewhere, with a call to action', () => {
  const html = read('index.html');
  assert.match(html, /<a class="home-audience" href="freefall\.html">[\s\S]*?home\.audiences\.firstTimer\.cta/);
  assert.match(html, /<a class="home-audience" href="materiais-instrucao\.html">[\s\S]*?home\.audiences\.student\.cta/);
  assert.match(html, /<a class="home-audience" href="#" id="audience-feedback" target="_blank"[\s\S]*?home\.audiences\.experienced\.cta/);
});

test('material pages show where you are, linking back to the materials list', () => {
  for (const page of ['apostila-aff.html', 'revisao-emergencias-aff.html', 'aff-videos.html']) {
    const html = read(page);
    assert.match(html, /<nav class="crumbs"[\s\S]*?<a href="materiais-instrucao\.html"[\s\S]*?aria-current="page"/, page);
    assert.ok(html.indexOf('class="crumbs"') < html.indexOf('class="page-top"'), `${page}: the trail sits above the title`);
  }
});

test('videos page: a shortcut for every level, pointing at its video', () => {
  const html = read('aff-videos.html');
  const shortcuts = [...html.matchAll(/<a href="#(level-\d)"/g)].map((m) => m[1]);
  const videos = [...html.matchAll(/<h2 id="(level-\d)"/g)].map((m) => m[1]);
  assert.equal(videos.length, 7);
  assert.deepEqual(shortcuts, videos);
});

test('glossary: the no-results message has its place below the search bar', () => {
  const html = read('glossary.html');
  assert.ok(html.indexOf('id="no-match"') > html.indexOf('id="list"'), 'below the suggestions list');
});

test('the new texts exist in every locale', () => {
  const keys = ['freefall.tip.label', 'freefall.tip.text', 'freefall.tip.try', 'freefall.tip.close', 'entry.share', 'entry.copied', 'entry.copyThis', 'nav.menu.language', 'home.toolsHeading', 'home.audiences.firstTimer.cta', 'home.audiences.student.cta', 'home.audiences.experienced.cta',
    'nav.crumbs', 'search.suggestThis', 'materials.videos.jumpTo'];
  for (const locale of ['en_US', 'pt_BR']) {
    for (const key of keys) assert.ok(get(messages(locale), key), `${locale}: ${key}`);
    assert.match(get(messages(locale), 'search.suggestThis'), /\{query\}/, `${locale}: the suggestion names the searched term`);
    assert.match(get(messages(locale), 'freefall.tip.text'), /\{button\}/, `${locale}: the simulator tip names the button to try`);
    assert.match(get(messages(locale), 'entry.copyThis'), /\{url\}/, `${locale}: the copy fallback shows the link`);
  }
});
