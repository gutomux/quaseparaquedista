import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { latestIssue, downloadUrl } from '../scripts/update-uspa-newsletter.mjs';
import { issueName } from '../js/latest-issue.js';
import { initialTab } from '../js/tabs.js';
import { embedUrl } from '../js/pdf-embed.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('newsletter: the latest issue is the newest month, ignoring folders and other files', () => {
  const items = [
    { ItemName: '2025-12.pdf', ItemID: 1, IsFolder: false },
    { ItemName: '2026-05.pdf', ItemID: 5, IsFolder: false },
    { ItemName: '2026-04.pdf', ItemID: 4, IsFolder: false },
    { ItemName: 'Archive', ItemID: 9, IsFolder: true },
    { ItemName: 'logo.png', ItemID: 8, IsFolder: false },
  ];
  assert.deepEqual(latestIssue(items), { issue: '2026-05', itemId: 5 });
  assert.equal(latestIssue([{ ItemName: 'notes.txt', ItemID: 1, IsFolder: false }]), null);
  assert.match(downloadUrl(5), /DownloadFile\?ItemId=5&ModuleId=1387&TabId=913$/);
});

test('newsletter: the issue is named by month, in the reader\'s language', () => {
  assert.equal(issueName('2026-05', 'en_US'), 'May 2026');
  assert.equal(issueName('2026-05', 'pt_BR'), 'maio de 2026');
  assert.equal(issueName('2025-12', 'en_US'), 'December 2025');
});

test('newsletter: the data file names an issue and its PDF on the USPA site', () => {
  const data = JSON.parse(read('data/uspa-update.json'));
  assert.match(data.issue, /^\d{4}-\d{2}$/);
  assert.match(data.pdf, /^https:\/\/www\.uspa\.org\//);
});

test('newsletter page: always uses Google\'s viewer, since USPA forbids framing its files', () => {
  const html = read('uspa-update.html');
  assert.match(html, /data-pdf-latest="data\/uspa-update\.json" data-pdf-viewer="google"/);
  assert.match(embedUrl('https://www.uspa.org/x.pdf', false), /^https:\/\/docs\.google\.com\/viewer\?url=/);
});

test('materials tabs: the address picks the tab, else Portuguese opens CBPq and English USPA', () => {
  const names = ['cbpq', 'uspa'];
  assert.equal(initialTab(names, '#uspa', 'pt_BR'), 'uspa');
  assert.equal(initialTab(names, '#cbpq', 'en_US'), 'cbpq');
  assert.equal(initialTab(names, '', 'pt_BR'), 'cbpq');
  assert.equal(initialTab(names, '#other', 'en_US'), 'uspa');
});

test('materials page: one tab and panel per association, and the USPA links', () => {
  const html = read('materiais-instrucao.html');
  for (const name of ['cbpq', 'uspa']) {
    assert.match(html, new RegExp(`role="tab" id="tab-${name}" data-tab="${name}" aria-controls="panel-${name}"`));
    assert.match(html, new RegExp(`id="panel-${name}" role="tabpanel" aria-labelledby="tab-${name}"`));
  }
  for (const href of ['https://www.uspa.org/portals/0/FLIP/SIM/HTML5/index.html', 'uspa-update', 'https://www.uspa.org/downloads']) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
});
