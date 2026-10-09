import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GlossaryController } from '../js/controller.js';
import { createIndex } from '../js/search.js';
import { createTranslator } from '../js/i18n.js';
import { CONFIG } from '../js/config.js';

const { entries } = JSON.parse(readFileSync(new URL('../data/glossary.json', import.meta.url), 'utf8'));
const messages = JSON.parse(readFileSync(new URL('../i18n/pt_BR.json', import.meta.url), 'utf8'));

/** A view that records what the controller asks it to do; every method is a no-op. */
function fakeView() {
  const calls = [];
  return {
    calls,
    view: new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); } }),
  };
}

function setup(address = null) {
  const pushes = [];
  const router = { current: () => address, push: (id) => { pushes.push(id); address = id; } };
  const { view, calls } = fakeView();
  const controller = new GlossaryController({
    entries, index: createIndex(entries, CONFIG.supportedLocales), view,
    t: createTranslator(messages, 'pt_BR'), locale: 'pt_BR', config: { ...CONFIG, feedbackFormUrl: '' }, router,
  });
  const shown = () => calls.filter(([name]) => name === 'renderEntry').map(([, entry]) => entry.id);
  return { controller, pushes, calls, shown };
}

test('glossary link: opening an entry puts it in the page address', () => {
  const { controller, pushes, shown } = setup();
  controller.start();
  controller.select('term-canopy');
  assert.deepEqual(pushes, ['term-canopy']);
  assert.deepEqual(shown(), ['term-canopy']);
});

test('glossary link: clearing the search takes the entry out of the address', () => {
  const { controller, pushes } = setup();
  controller.start();
  controller.select('term-canopy');
  controller.clear();
  assert.deepEqual(pushes, ['term-canopy', null]);
});

test('glossary link: a shared link opens its entry, without adding a history step', () => {
  const { controller, pushes, shown } = setup('acronym-aff');
  controller.start();
  assert.deepEqual(shown(), ['acronym-aff']);
  assert.deepEqual(pushes, [], 'Back still leaves the page instead of reopening the same entry');
});

test('glossary link: Back to an earlier entry, or to no entry, without new history steps', () => {
  const { controller, pushes, shown, calls } = setup();
  controller.start();
  controller.select('term-canopy');
  controller.select('acronym-aff');
  controller.openFromRoute('term-canopy'); // Back
  controller.openFromRoute(null); // Back again, to the empty search
  assert.deepEqual(pushes, ['term-canopy', 'acronym-aff']);
  assert.deepEqual(shown(), ['term-canopy', 'acronym-aff', 'term-canopy']);
  assert.ok(calls.some(([name]) => name === 'clearResult'), 'the empty search clears the card');
});

test('glossary link: an unknown or outdated address shows the empty search', () => {
  const { controller, shown, calls } = setup('term-that-was-removed');
  controller.start();
  assert.deepEqual(shown(), []);
  assert.ok(calls.some(([name]) => name === 'clearResult'));
});
