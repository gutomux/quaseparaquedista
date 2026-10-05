/**
 * Online checks: the external resources the pages embed still load.
 * Run with `npm run test:links`; the pre-commit hook runs them before every commit.
 *
 * The addresses are read from the HTML pages, so new or changed resources are
 * checked without editing this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { embedUrl } from '../js/pdf-embed.js';

const ROOT = new URL('../', import.meta.url);
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const html = pages.map((f) => readFileSync(new URL(f, ROOT), 'utf8')).join('\n');

const unique = (list) => [...new Set(list)];
const pdfs = unique([...html.matchAll(/data-pdf="([^"]+)"/g)].map((m) => m[1]));
const videos = unique([...html.matchAll(/youtube-nocookie\.com\/embed\/([\w-]+)/g)].map((m) => m[1]));

const TIMEOUT_MS = 20000;

/** Answers that usually mean "try again shortly": too many requests, or a temporary server error. */
const TEMPORARY = (status) => status === 429 || status >= 500;

/**
 * fetch with a timeout and one retry, so a passing hiccup doesn't block a commit: no answer
 * at all, or a temporary answer. A missing file (404 and the like) fails straight away.
 */
async function get(url, headers = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'quaseparaquedista-link-check', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!TEMPORARY(response.status) || attempt >= 2) return response;
    } catch (error) {
      if (attempt >= 2) throw new Error(`${url} did not answer: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

test('the pages still list the resources to check', () => {
  assert.ok(pdfs.length >= 2, `found PDFs: ${pdfs.join(', ')}`);
  assert.ok(videos.length >= 7, `found videos: ${videos.join(', ')}`);
});

for (const pdf of pdfs) {
  test(`PDF loads from its site: ${pdf}`, async () => {
    const response = await get(pdf, { Range: 'bytes=0-1023' });
    assert.ok([200, 206].includes(response.status), `HTTP ${response.status}`);
    assert.match(response.headers.get('content-type') || '', /pdf/i, 'not served as a PDF');
    const reader = response.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    assert.equal(Buffer.from(value.subarray(0, 4)).toString(), '%PDF', 'the file does not start like a PDF');
  });

  // Google's viewer answers even for a missing file, so this only checks the viewer service
  // is up for this address; the test above checks the file itself.
  test(`Google's viewer (used on Android) is available for: ${pdf}`, async () => {
    const response = await get(embedUrl(pdf, false));
    assert.equal(response.status, 200, `HTTP ${response.status}`);
    const name = decodeURIComponent(new URL(pdf).pathname.split('/').pop());
    assert.match(await response.text(), new RegExp(`<title>${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'the viewer did not answer for this file');
  });
}

for (const id of videos) {
  test(`YouTube video is public and can be embedded: ${id}`, async () => {
    // oEmbed answers 200 for public, embeddable videos; 401 when embedding is turned off; 400/404 when private or removed.
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const response = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`);
    const reasons = { 401: 'embedding turned off by the owner', 403: 'embedding not allowed', 404: 'private or removed', 400: 'private or removed' };
    assert.equal(response.status, 200, `HTTP ${response.status} (${reasons[response.status] || 'unexpected'}) for ${watch}`);
    const { title } = await response.json();
    assert.ok(title, 'no title returned');
  });
}
