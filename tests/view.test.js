import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagEmoji, supportsFlagEmoji } from '../js/view.js';

test('flagEmoji turns a locale region into a flag', () => {
  assert.equal(flagEmoji('pt_BR'), '🇧🇷');
  assert.equal(flagEmoji('en_US'), '🇺🇸');
});

test('Windows falls back to locale codes instead of flags', () => {
  assert.equal(supportsFlagEmoji({ userAgentData: { platform: 'Windows' } }), false);
  assert.equal(supportsFlagEmoji({ platform: 'Win32' }), false);
  assert.equal(supportsFlagEmoji({ platform: 'MacIntel' }), true);
  assert.equal(supportsFlagEmoji({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true);
});

test('only Windows platforms lose flags', () => {
  assert.equal(supportsFlagEmoji({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), false);
  assert.equal(supportsFlagEmoji({ userAgent: 'Something Darwin/24.0' }), true);
});

test('carousel: nextIndex wraps around in both directions', async () => {
  const { nextIndex } = await import('../js/carousel.js');
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(nextIndex(2, 3), 0);
  assert.equal(nextIndex(0, 3, -1), 2);
});

test('pdf embed: the original file where the browser can show PDFs, Google\'s viewer elsewhere', async () => {
  const { embedUrl } = await import('../js/pdf-embed.js');
  const pdf = 'https://old.cbpq.org.br/site/download/i/ged/documentos/2023/05/668.pdf';
  assert.equal(embedUrl(pdf, true), `${pdf}#navpanes=0&view=FitH`);
  assert.equal(embedUrl(pdf, false), `https://docs.google.com/viewer?url=${encodeURIComponent(pdf)}&embedded=true`);
});
