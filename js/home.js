/**
 * Welcome page entry point: detect the locale, fill in the text,
 * show the feedback button, and run the tool menu and the photo carousel.
 */
import { CONFIG } from './config.js';
import { detectLocale, loadMessages, createTranslator } from './i18n.js';
import { applyTranslations } from './view.js';
import { isFeedbackFormUrl } from './feedback.js';
import { setupCarousel } from './carousel.js';

/**
 * Open/close the hamburger menu; closes on Escape, on a click outside and when focus leaves it.
 * @returns {(label: (open: boolean) => string) => void} Sets the button's label, which says open or close.
 */
function setupMenu(button, menu) {
  let label = (open) => (open ? 'Close tools menu' : 'Open tools menu');
  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', label(open));
    button.title = label(open);
    menu.hidden = !open;
  };
  button.addEventListener('click', () => {
    const open = menu.hidden;
    setOpen(open);
    if (open) menu.querySelector('a').focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !button.contains(e.target) && !menu.contains(e.target)) setOpen(false);
  });
  menu.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== button) setOpen(false);
  });
  return (next) => {
    label = next;
    setOpen(!menu.hidden);
  };
}

async function init() {
  const setMenuLabel = setupMenu(document.querySelector('#menu-button'), document.querySelector('#menu'));

  const locale = detectLocale(navigator.languages || [navigator.language], CONFIG.supportedLocales, CONFIG.defaultLocale);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, 'home.meta.title');
  setMenuLabel((open) => t(open ? 'home.menu.close' : 'home.menu.open'));
  setupCarousel(document.querySelector('.carousel'), t, {
    autoplay: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  const formUrl = CONFIG.feedbackFormUrl;
  if (isFeedbackFormUrl(formUrl)) {
    document.querySelector('#feedback').href = formUrl.trim();
    document.querySelector('.feedback').hidden = false;
  }
}

// The menu works even if the text fails to load; the page then keeps its built-in English.
init().catch((error) => console.error(error));
