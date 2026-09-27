import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFeedbackFormUrl } from '../js/feedback.js';

test('accepts Google Forms links only', () => {
  assert.equal(isFeedbackFormUrl('https://forms.gle/AbC123'), true);
  assert.equal(isFeedbackFormUrl('https://docs.google.com/forms/d/e/xyz/viewform'), true);
  assert.equal(isFeedbackFormUrl(''), false);
  assert.equal(isFeedbackFormUrl('https://example.com/form'), false);
  assert.equal(isFeedbackFormUrl(undefined), false);
});
