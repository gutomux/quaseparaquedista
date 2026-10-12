import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MENU, menuItems, pageName } from '../js/nav.js';

const ROOT = new URL('../', import.meta.url);
const files = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const pages = files.map((f) => f.replace(/\.html$/, ''));

test('menu: Home comes first, then the tools', () => {
  assert.deepEqual(MENU.map((m) => m.key), ['home', 'glossary', 'freefall', 'navigation', 'materials']);
  assert.equal(MENU[0].href, './');
});

test('menu: marks the page you are on, and the section of the material pages', () => {
  const current = (file) => Object.fromEntries(menuItems(file).filter((i) => i.current).map((i) => [i.key, i.current]));
  // GitHub Pages serves each page with or without ".html"; both mark the same item.
  assert.deepEqual(current('/'), { home: 'page' });
  assert.deepEqual(current('/index.html'), { home: 'page' });
  assert.deepEqual(current('/glossary'), { glossary: 'page' });
  assert.deepEqual(current('/glossary.html'), { glossary: 'page' });
  assert.deepEqual(current('/materiais-instrucao'), { materials: 'page' });
  assert.deepEqual(current('/apostila-aff'), { materials: 'true' });
  assert.deepEqual(current('/aff-videos.html'), { materials: 'true' });
  assert.equal(pageName('./'), 'index');
  assert.equal(pageName('/freefall.html'), 'freefall');
  assert.equal(pageName('/freefall'), 'freefall');
});

test('menu: every page in the menu exists, and every page is reachable from it', () => {
  const linked = MENU.flatMap((m) => [pageName(m.href), ...(m.pages || [])]);
  for (const href of linked) assert.ok(pages.includes(href), `${href} exists`);
  for (const page of pages) assert.ok(linked.includes(page), `${page} is in the menu or one of its sections`);
});

test('every page has the same top: the title, then the menu, and no old back links', () => {
  for (const page of files) {
    const html = readFileSync(new URL(page, ROOT), 'utf8');
    assert.match(html, /<header class="page-top">\s*<h1 class="page-title[^"]*"[^>]*>[\s\S]*?<\/h1>\s*<nav class="site-nav" data-site-nav><\/nav>\s*<\/header>/, `${page} has the shared title and menu row`);
    assert.ok(!html.includes('back-home'), `${page} has no separate back link`);
  }
});

test('menu: every item has text in every locale', () => {
  for (const locale of ['en_US', 'pt_BR']) {
    const { nav } = JSON.parse(readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['label', 'open', 'close']) assert.ok(nav.menu[key], `${locale}: nav.menu.${key}`);
    for (const { key } of MENU) {
      assert.ok(nav.menu[key]?.name && nav.menu[key]?.text, `${locale}: nav.menu.${key}`);
    }
  }
});

test('links between pages have no ".html" (GitHub Pages serves them without it)', () => {
  for (const { href, pages: sub = [] } of MENU) for (const link of [href, ...sub]) assert.ok(!link.endsWith('.html'), link);
  for (const page of files) {
    const html = readFileSync(new URL(page, ROOT), 'utf8');
    const old = [...html.matchAll(/href="([^"]+\.html[^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(old, [], `${page} still links with .html`);
  }
});
