import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMailto } from '../js/contact.js';

test('buildMailto encodes subject and body, keeping line breaks', () => {
  const href = buildMailto('me@example.com', { subject: 'Sugestão & correção', body: 'Linha 1\nLinha 2' });
  assert.equal(href, 'mailto:me@example.com?subject=Sugest%C3%A3o%20%26%20corre%C3%A7%C3%A3o&body=Linha%201%0ALinha%202');
});

test('buildMailto works with no subject or body', () => {
  assert.equal(buildMailto('me@example.com'), 'mailto:me@example.com');
});
