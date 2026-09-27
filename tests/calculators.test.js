import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, computeWingLoading, KG_TO_LB } from '../js/calculators.js';

test('parseNumber accepts comma or dot decimals', () => {
  assert.equal(parseNumber('80,5'), 80.5);
  assert.equal(parseNumber(' 12.0 '), 12);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('abc'), null);
});

test('wing loading = (body + gear) × 2.2 ÷ canopy', () => {
  const { value } = computeWingLoading({ body: '80', gear: '12', canopy: '190' });
  assert.equal(KG_TO_LB, 2.2);
  assert.ok(Math.abs(value - ((80 + 12) * 2.2) / 190) < 1e-9);
  assert.equal(value.toFixed(2), '1.07');
});

test('wing loading reports missing and invalid input', () => {
  assert.deepEqual(computeWingLoading({ body: '80', gear: '', canopy: '190' }), { error: 'missing' });
  assert.deepEqual(computeWingLoading({ body: '80', gear: '12', canopy: '0' }), { error: 'invalid' });
  assert.deepEqual(computeWingLoading({ body: '-5', gear: '12', canopy: '190' }), { error: 'invalid' });
});

import { classifyWingLoading, WING_LOADING_LIMITS } from '../js/calculators.js';

test('classifyWingLoading picks the lowest allowed CBPq category', () => {
  assert.equal(classifyWingLoading(0.8).category, 'AI');
  assert.equal(classifyWingLoading(1.0).category, 'AI');
  assert.equal(classifyWingLoading(1.07).category, 'A');
  assert.equal(classifyWingLoading(0.4).category, 'A');
  const b = classifyWingLoading(1.2);
  assert.equal(b.category, 'B');
  assert.equal(b.aboveRecommended, true);
  assert.equal(classifyWingLoading(1.4).category, 'C');
  assert.equal(classifyWingLoading(1.8).category, 'D');
});

test('limits table covers every category in order', () => {
  assert.deepEqual(WING_LOADING_LIMITS.map((l) => l.category), ['AI', 'A', 'B', 'C', 'D']);
});
