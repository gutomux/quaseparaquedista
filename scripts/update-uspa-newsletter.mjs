/**
 * Finds the latest USPA "Skydiver Update" e-newsletter and records it in data/uspa-update.json,
 * which the newsletter page (uspa-update.html) reads to show that issue.
 *
 * Run with `node scripts/update-uspa-newsletter.mjs`; a GitHub Action runs it every day
 * (.github/workflows/uspa-newsletter.yml) and publishes the file when a new issue comes out.
 *
 * Why a script: USPA lists the issues through its file library (a DNN "UserFiles" module).
 * The list only answers with the cookie and form token of its own page, which a visitor's
 * browser on another site can't send, so the page can't ask for it directly.
 * The issues are PDFs named by month ("2026-05.pdf"); their download address is public.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ARCHIVE = 'https://www.uspa.org/education/skydiver-update-e-newsletter';
const API = 'https://www.uspa.org/API/Evotiva-UserFiles';
/** The archive's file library: its module, page (tab) and folder ("The Update"). */
const MODULE_ID = 1387;
const TAB_ID = 913;
const FOLDER_ID = 27972;
const OUTPUT = new URL('../data/uspa-update.json', import.meta.url);
const ISSUE = /^(\d{4})-(\d{2})\.pdf$/i;

/** Public address of one file, the one USPA's own "download" button opens. */
export function downloadUrl(itemId) {
  return `${API}/FileActionsServices/DownloadFile?ItemId=${itemId}&ModuleId=${MODULE_ID}&TabId=${TAB_ID}`;
}

/** The newest monthly issue in the library's file list, or null if none looks like one. */
export function latestIssue(items) {
  const issues = items
    .filter((item) => !item.IsFolder && ISSUE.test(item.ItemName))
    .map((item) => ({ issue: item.ItemName.replace(/\.pdf$/i, ''), itemId: item.ItemID }));
  issues.sort((a, b) => b.issue.localeCompare(a.issue));
  return issues[0] ?? null;
}

async function fetchItems() {
  const page = await fetch(ARCHIVE, { headers: { 'User-Agent': 'Mozilla/5.0 (quaseparaquedista newsletter check)' } });
  if (!page.ok) throw new Error(`archive page: HTTP ${page.status}`);
  const cookies = page.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const token = (await page.text()).match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('archive page: no form token found (did the page change?)');

  const query = new URLSearchParams({ itemId: FOLDER_ID, rootItemId: FOLDER_ID, sortExpression: '', searchText: '', searchTags: '', take: 500, skip: 0, page: 1, pageSize: 500 });
  const list = await fetch(`${API}/GetItemsServices/GetItems?${query}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (quaseparaquedista newsletter check)',
      Cookie: cookies, RequestVerificationToken: token, ModuleId: String(MODULE_ID), TabId: String(TAB_ID),
      'X-Requested-With': 'XMLHttpRequest', Referer: ARCHIVE,
    },
  });
  if (!list.ok) throw new Error(`file list: HTTP ${list.status}`);
  return (await list.json()).Data ?? [];
}

async function main() {
  const latest = latestIssue(await fetchItems());
  if (!latest) throw new Error('file list: no issue named like "2026-05.pdf"');

  const pdf = downloadUrl(latest.itemId);
  const head = await fetch(pdf, { headers: { Range: 'bytes=0-3' } });
  if (![200, 206].includes(head.status)) throw new Error(`${latest.issue}: the PDF answered HTTP ${head.status}`);

  const current = JSON.parse(await readFile(OUTPUT, 'utf8').catch(() => '{}'));
  if (current.issue === latest.issue && current.pdf === pdf) {
    console.log(`Up to date: ${latest.issue}`);
    return;
  }
  await writeFile(OUTPUT, `${JSON.stringify({ issue: latest.issue, pdf, archive: ARCHIVE }, null, 2)}\n`);
  console.log(`New issue: ${latest.issue} (was ${current.issue ?? 'none'})`);
}

// Run only when called directly, not when a test imports the functions above.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
