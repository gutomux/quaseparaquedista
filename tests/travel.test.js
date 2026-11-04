import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRich } from '../js/view.js';
import { loadChecks, saveChecks, CHECKS_KEY } from '../js/checklist.js';

const html = readFileSync(new URL('../travelling.html', import.meta.url), 'utf8');
const messages = (locale) => JSON.parse(readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), 'utf8'));
const get = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);
const plainKeys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
const richKeys = [...html.matchAll(/data-i18n-rich="([^"]+)"/g)].map((m) => m[1]);
const attrKeys = [...html.matchAll(/data-i18n-attr="[^:"]+:\s*([^"]+)"/g)].map((m) => m[1].trim());
const links = (text) => parseRich(text).filter((p) => p.type === 'link').map((p) => p.href);

test('formatted text: bold, emphasis and links; anything else stays plain text', () => {
  assert.deepEqual(parseRich('Prefira **na mão**, *não* despachado: [ANAC](https://www.gov.br/anac).'), [
    { type: 'text', text: 'Prefira ' },
    { type: 'strong', text: 'na mão' },
    { type: 'text', text: ', ' },
    { type: 'em', text: 'não' },
    { type: 'text', text: ' despachado: ' },
    { type: 'link', text: 'ANAC', href: 'https://www.gov.br/anac' },
    { type: 'text', text: '.' },
  ]);
  assert.deepEqual(parseRich('Sem formatação.'), [{ type: 'text', text: 'Sem formatação.' }]);
  assert.deepEqual(parseRich('[topo](#pode)'), [{ type: 'link', text: 'topo', href: '#pode' }]);
  // Only https:// and # addresses become links, so a text can never run a script.
  for (const bad of ['[x](javascript:alert(1))', '[x](http://example.com)']) {
    assert.deepEqual(parseRich(bad).map((p) => p.type), ['text'], bad);
  }
});

test('travel guide: every text on the page exists in every locale', () => {
  assert.ok(richKeys.length > 50 && plainKeys.length > 30, 'the page reads its texts from the i18n files');
  for (const locale of ['pt_BR', 'en_US']) {
    const m = messages(locale);
    for (const key of [...plainKeys, ...richKeys, ...attrKeys]) assert.equal(typeof get(m, key), 'string', `${locale}: ${key}`);
    assert.ok(m.nav.menu.travel?.name && m.nav.menu.groups?.guides, `${locale}: menu name and group`);
  }
});

test('travel guide: the English texts keep every link of the Portuguese ones', () => {
  const [pt, en] = [messages('pt_BR'), messages('en_US')];
  for (const key of richKeys) assert.deepEqual(links(get(en, key)), links(get(pt, key)), key);
  // Plain texts are shown as they are, so they must not hold formatting.
  for (const key of plainKeys) assert.ok(!/\*\*|\]\(/.test(get(pt, key) + get(en, key)), `${key} is plain text`);
});

test('travel guide: every "On this page" link leads to its section', () => {
  const targets = [...html.matchAll(/<a href="#([\w-]+)"/g)].map((m) => m[1]);
  assert.equal(targets.length, 8);
  for (const id of targets) assert.match(html, new RegExp(`<section id="${id}"`), `#${id}`);
});

test('travel guide: every box to tick is a real checkbox with its text as label, and each list can be cleared', () => {
  const lists = [...html.matchAll(/<ul class="travel-check" data-checklist="(\w+)">([\s\S]*?)\n {6}<\/ul>/g)];
  assert.deepEqual(lists.map((m) => m[1]), ['docs', 'trip']);
  const ids = [];
  for (const [, name, body] of lists) {
    const boxes = [...body.matchAll(/<label class="travel-tick"><input type="checkbox" id="([\w-]+)"><span data-i18n(?:-rich)?="[^"]+"><\/span><\/label>/g)].map((m) => m[1]);
    assert.equal(boxes.length, (body.match(/<li>/g) || []).length, `${name}: one box per item`);
    ids.push(...boxes);
    assert.match(html, new RegExp(`data-checklist-reset="${name}"`), `${name} has its "untick all" button`);
  }
  assert.equal(ids.length, 14);
  assert.equal(new Set(ids).size, ids.length, 'box ids are unique, so each tick is remembered on its own');
});

test('boxes to tick: remembered on the device, and storage problems never break the page', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual([...loadChecks(storage)], []);
  saveChecks(storage, new Set(['check-trip-2', 'check-docs-1']));
  assert.equal(store.get(CHECKS_KEY), '["check-docs-1","check-trip-2"]');
  assert.deepEqual([...loadChecks(storage)].sort(), ['check-docs-1', 'check-trip-2']);
  // Broken or odd saved data, blocked storage, no storage at all.
  store.set(CHECKS_KEY, '{oops');
  assert.deepEqual([...loadChecks(storage)], []);
  store.set(CHECKS_KEY, '[1, "check-docs-3"]');
  assert.deepEqual([...loadChecks(storage)], ['check-docs-3']);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual([...loadChecks(blocked)], []);
  assert.doesNotThrow(() => saveChecks(blocked, new Set(['x'])));
  assert.deepEqual([...loadChecks(null)], []);
});
