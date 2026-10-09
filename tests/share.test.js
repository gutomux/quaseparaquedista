import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyText, shareLink } from '../js/share.js';

/** Wait for both parts of a share. */
const done = async (result) => ({ copied: await result.copied, shared: await result.shared });

/** A fake page for the older copy method; records what was "copied". */
function fakeDoc({ copyWorks = true } = {}) {
  const doc = {
    copied: null,
    body: { append() {} },
    createElement: () => ({ value: '', style: {}, setAttribute() {}, select() {}, remove() {} }),
    execCommand(command) {
      if (command !== 'copy' || !copyWorks) return false;
      doc.copied = 'legacy';
      return true;
    },
  };
  return doc;
}
const link = { url: 'https://quaseparaquedista.com.br/glossary.html#term-canopy', title: 'Velame' };

test('share: copies the link and opens the share menu, copy first', async () => {
  const order = [];
  const nav = {
    clipboard: { writeText: async (text) => { order.push(`copy ${text}`); } },
    share: async (data) => { order.push(`share ${data.url}`); },
  };
  assert.deepEqual(await done(shareLink(link, { nav, doc: fakeDoc() })), { copied: true, shared: true });
  assert.deepEqual(order, [`copy ${link.url}`, `share ${link.url}`]);
});

test('share: a closed or failing share menu still leaves the link copied', async () => {
  const nav = { clipboard: { writeText: async () => {} }, share: async () => { throw new DOMException('closed', 'AbortError'); } };
  assert.deepEqual(await done(shareLink(link, { nav, doc: fakeDoc() })), { copied: true, shared: false });
});

test('share: without the modern features (http pages, older browsers), copies the older way', async () => {
  const doc = fakeDoc();
  assert.deepEqual(await done(shareLink(link, { nav: {}, doc })), { copied: true, shared: false });
  assert.equal(doc.copied, 'legacy');
});

test('share: a blocked clipboard falls back to the older copy', async () => {
  const doc = fakeDoc();
  const nav = { clipboard: { writeText: async () => { throw new Error('not focused'); } } };
  assert.equal(await copyText('x', { nav, doc }), true);
  assert.equal(doc.copied, 'legacy');
});

test('share: when no copy method works, it says so (the page then shows the link)', async () => {
  assert.deepEqual(await done(shareLink(link, { nav: {}, doc: fakeDoc({ copyWorks: false }) })), { copied: false, shared: false });
});

test('share: "copied" is known right away, without waiting for the share menu to close', async () => {
  const nav = { clipboard: { writeText: async () => {} }, share: () => new Promise(() => {}) }; // menu left open
  const result = shareLink(link, { nav, doc: fakeDoc() });
  assert.equal(await result.copied, true);
});
