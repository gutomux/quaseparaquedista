/**
 * Entry point for the simple content pages (training materials, PDFs, videos):
 * detect the locale, fill in the text, and embed the PDF if the page has one.
 * The page names its title key with <body data-title-key="...">.
 */
import { CONFIG } from './config.js';
import { detectLocale, loadMessages, createTranslator } from './i18n.js';
import { applyTranslations } from './view.js';

async function init() {
  const locale = detectLocale(navigator.languages || [navigator.language], CONFIG.supportedLocales, CONFIG.defaultLocale);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, document.body.dataset.titleKey);

  const pdf = document.querySelector('[data-pdf]');
  if (pdf) {
    const { mountPdfEmbed } = await import('./pdf-embed.js');
    mountPdfEmbed(pdf, document.querySelector('h1').textContent);
  }
}

init().catch((error) => console.error(error));
