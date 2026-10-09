/**
 * Entry point for the simple content pages (training materials, PDFs, videos):
 * detect the locale, fill in the text and the site menu, and embed the PDF if the page has one.
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

  const pdf = document.querySelector('[data-pdf]');
  if (pdf) {
    const { mountPdfEmbed } = await import('./pdf-embed.js');
    mountPdfEmbed(pdf, document.querySelector('h1').textContent);
  }
}

init().catch((error) => console.error(error));
