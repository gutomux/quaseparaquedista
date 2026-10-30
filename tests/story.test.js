import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storyContent, storyFrame } from '../js/navigation/story.js';
import { createTranslator } from '../js/i18n.js';

const messages = (locale) => JSON.parse(readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), 'utf8'));
const point = (name, reached) => ({ name, reached, distM: reached ? 10 : 60, altFt: 1000 });
const report = (over = {}) => ({
  points: [point('A', true), point('B', true), point('C', true)],
  rightTurns: 0, lowTurns: 0, flare: 'good', landing: { distM: 3, grade: 'legendary' }, ...over,
});

test('story: a clean flight shows only good badges, and no sharp-turn badge', () => {
  const { rank, badges } = storyContent(report());
  assert.equal(rank, 'legendary');
  assert.deepEqual(badges.map((b) => [b.kind, b.key]), [['ok', 'points.all'], ['ok', 'rightTurns.zero'], ['ok', 'flare.good']]);
});

test('story: serious mistakes are red badges, things to improve are not', () => {
  const { badges } = storyContent(report({
    points: [point('A', true), point('B', false), point('C', true)],
    rightTurns: 1, lowTurns: 2, flare: 'high', landing: { distM: 34, grade: 'missed' },
  }));
  assert.deepEqual(badges.map((b) => [b.kind, b.key, b.params?.count]), [
    ['off', 'points.some', 2], ['alert', 'rightTurns', 1], ['alert', 'lowTurns', 2], ['off', 'flare.high', undefined],
  ]);
  assert.equal(storyContent(report({ flare: 'released' })).badges.at(-1).kind, 'alert', 'letting go of the flare is serious');
});

test('story: the rank follows the distance, in game tiers', () => {
  const rank = (grade) => storyContent(report({ landing: { distM: 0, grade } })).rank;
  assert.deepEqual(['legendary', 'great', 'goal', 'missed'].map(rank), ['legendary', 'epic', 'rare', 'almost']);
});

test('story: a sharp turn below 300 ft or letting go of the flare is "wasted", even on the target', () => {
  assert.equal(storyContent(report({ lowTurns: 1 })).rank, 'wasted');
  assert.equal(storyContent(report({ flare: 'released' })).rank, 'wasted');
  assert.equal(storyContent(report({ rightTurns: 1 })).rank, 'legendary', 'a right turn only shows as a red badge');
});

test('story: the map frames the whole flight with a margin', () => {
  const points = { A: { x: -300, y: 200 }, B: { x: -300, y: -100 }, C: { x: 0, y: -100 }, X: { x: 0, y: 0 } };
  const track = [{ x: -600, y: 700 }, { x: -300, y: 200 }];
  const frame = storyFrame(track, points, { x: 5, y: 2 });
  for (const p of [...track, ...Object.values(points)]) {
    assert.ok(Math.abs(p.x - frame.cx) < frame.half && Math.abs(p.y - frame.cy) < frame.half, `${p.x},${p.y} in view`);
  }
});

test('story: every rank, the distance and every badge have text in both languages', () => {
  for (const locale of ['pt_BR', 'en_US']) {
    const t = createTranslator(messages(locale), locale);
    for (const rank of ['legendary', 'epic', 'rare', 'almost', 'wasted']) {
      assert.notEqual(t(`navigation.story.rank.${rank}`), `navigation.story.rank.${rank}`, `${locale}: rank ${rank}`);
    }
    assert.match(t('navigation.story.landed', { dist: 7 }), /7/, `${locale}: distance`);
    assert.notEqual(t('navigation.story.mode'), 'navigation.story.mode', `${locale}: mode`);
    const all = storyContent(report({ points: [point('A', false), point('B', true), point('C', true)], rightTurns: 2, lowTurns: 1, flare: 'none' })).badges;
    for (const badge of [...all, ...storyContent(report()).badges]) {
      const text = t(`navigation.story.badges.${badge.key}`, badge.params);
      assert.ok(!text.startsWith('navigation.'), `${locale}: ${badge.key}`);
      if (badge.params) assert.match(text, new RegExp(String(badge.params.count)), `${locale}: ${badge.key} shows the count`);
    }
  }
});
