/**
 * Welcome page entry point: detect the locale, fill in the text,
 * show the feedback button, and run the site menu and the photo carousel.
 */
import { CONFIG } from './config.js';
import { loadMessages, createTranslator } from './i18n.js';
import { currentLocale } from './locale.js';
import { applyTranslations } from './view.js';
import { isFeedbackFormUrl } from './feedback.js';
import { setupCarousel } from './carousel.js';
import { mountSiteMenu } from './nav.js';

async function init() {
  const locale = currentLocale(CONFIG);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, 'home.meta.title');
  mountSiteMenu(document.querySelector('[data-site-nav]'), t);
  setupCarousel(document.querySelector('.carousel'), t, {
    autoplay: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  const formUrl = CONFIG.feedbackFormUrl;
  const audienceFeedback = document.querySelector('#audience-feedback');
  if (isFeedbackFormUrl(formUrl)) {
    document.querySelector('#feedback').href = formUrl.trim();
    document.querySelector('.feedback').hidden = false;
    audienceFeedback.href = formUrl.trim();
  } else {
    // No form configured: the "Já é paraquedista?" card stays, without a link.
    audienceFeedback.removeAttribute('href');
    audienceFeedback.querySelector('.home-audience-cta').hidden = true;
  }
}

init().catch((error) => console.error(error));
