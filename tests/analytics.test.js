import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { track, navPlayEvents, NAV_RESULTS, NAV_PLAY_MILESTONES } from '../js/analytics.js';
import { RANKS } from '../js/navigation/story.js';

const ROOT = new URL('../', import.meta.url);
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const COUNTER = '<script data-goatcounter="https://quaseparaquedista.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>';

test('visitor counter: every page loads it once, async, inside <head>', () => {
  assert.ok(pages.length >= 11, `found pages: ${pages.join(', ')}`);
  for (const page of pages) {
    const html = readFileSync(new URL(page, ROOT), 'utf8');
    const at = html.indexOf(COUNTER);
    assert.ok(at > 0, `${page} loads the GoatCounter script`);
    assert.equal(html.indexOf(COUNTER, at + 1), -1, `${page} loads it only once`);
    assert.ok(at < html.indexOf('</head>'), `${page} loads it inside <head>`);
  }
});

test('visitor counter: every navigation rank has its own result event', () => {
  assert.deepEqual(Object.keys(NAV_RESULTS).sort(), Object.keys(RANKS).sort());
  const paths = Object.values(NAV_RESULTS).map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length, 'each rank counts on its own path');
});

test('visitor counter: every flight counts, and the 2nd, 3rd, 5th and 10th also mark a milestone', () => {
  assert.deepEqual(navPlayEvents(1).map((e) => e.path), ['navegacao/voo']);
  assert.deepEqual(navPlayEvents(4).map((e) => e.path), ['navegacao/voo']);
  for (const n of NAV_PLAY_MILESTONES) {
    assert.deepEqual(navPlayEvents(n).map((e) => e.path), ['navegacao/voo', `navegacao/voos-${n}-ou-mais`]);
  }
});

test('visitor counter: an event is sent as an event, and nothing breaks without GoatCounter', () => {
  const sent = [];
  track(NAV_RESULTS.wasted, { goatcounter: { count: (vars) => sent.push(vars) } });
  assert.deepEqual(sent, [{ path: 'navegacao/resultado-morridinha', title: 'Navegação: Morridinha', event: true }]);
  // Blocked or not loaded yet; or the script itself fails.
  assert.doesNotThrow(() => track(NAV_RESULTS.legendary, {}));
  assert.doesNotThrow(() => track(NAV_RESULTS.legendary, { goatcounter: {} }));
  assert.doesNotThrow(() => track(NAV_RESULTS.legendary, { goatcounter: { count: () => { throw new Error('offline'); } } }));
});
