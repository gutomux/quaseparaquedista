/**
 * Entry point for the simple content pages (training materials, PDFs, videos):
 * detect the locale, fill in the text and the site menu, then the tabs and the PDF if the page has them.
 * The page names its title key with <body data-title-key="...">.
 */
import { CONFIG } from './config.js';
import { loadMessages, createTranslator } from './i18n.js';
import { currentLocale } from './locale.js';
import { applyTranslations } from './view.js';
import { mountSiteMenu } from './nav.js';

async function init() {
  const locale = currentLocale(CONFIG);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, document.body.dataset.titleKey);
  mountSiteMenu(document.querySelector('[data-site-nav]'), t);

  const tabs = document.querySelector('[data-tabs]');
  if (tabs) {
    const { mountTabs } = await import('./tabs.js');
    mountTabs(tabs, locale);
  }

  // The USPA newsletter page learns its PDF (the latest issue) from a data file first.
  const latest = document.querySelector('[data-pdf-latest]');
  if (latest) {
    const { loadLatestIssue } = await import('./latest-issue.js');
    // If it can't be read, the page keeps only its links to the archive.
    if (!(await loadLatestIssue(latest, locale))) document.querySelectorAll('[data-latest-only]').forEach((node) => { node.hidden = true; });
  }

  const pdf = document.querySelector('[data-pdf]');
  if (pdf) {
    const { mountPdfEmbed } = await import('./pdf-embed.js');
    mountPdfEmbed(pdf, document.querySelector('h1').textContent);
  }
}

init().catch((error) => console.error(error));
