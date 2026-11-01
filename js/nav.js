/**
 * The site menu: the ☰ button at the top right of every page and the list it opens,
 * ending with the language switch (PT | EN).
 *
 * Every page has an empty <nav class="site-nav" data-site-nav> beside its title;
 * mountSiteMenu() fills it in, so the menu is defined once, here. The first item is
 * always Home. Text comes from nav.menu.* in the i18n files.
 */

import { CONFIG } from './config.js';
import { switchLocale } from './locale.js';
import { isFeedbackFormUrl } from './feedback.js';

/**
 * Languages in the switch: a short label, and the language's own name (read by screen readers,
 * so a speaker of that language can find it whatever language the page is in).
 */
export const LANGUAGES = Object.freeze({
  pt_BR: { short: 'PT', name: 'Português', tag: 'pt-BR' },
  en_US: { short: 'EN', name: 'English', tag: 'en-US' },
});

/**
 * Pages in the menu, in order. Pages under a section (e.g. the PDFs) mark that section.
 * Links have no ".html": GitHub Pages serves "/glossary" from glossary.html, and "./" is Home.
 */
export const MENU = Object.freeze([
  { key: 'home', href: './' },
  { key: 'glossary', href: 'glossary' },
  // A shortcut to one glossary entry (with its calculator), not a page of its own.
  { key: 'wingLoad', href: 'glossary#term-wing-loading' },
  { key: 'freefall', href: 'freefall' },
  { key: 'navigation', href: 'navigation' },
  { key: 'materials', href: 'materiais-instrucao', pages: ['apostila-aff', 'revisao-emergencias-aff', 'aff-videos', 'uspa-update'] },
  { key: 'about', href: 'sobre' },
]);

/**
 * The page's name from a path or link, with or without ".html":
 * "/glossary.html" and "/glossary" → "glossary"; "/", "./" and "/index.html" → "index".
 */
export function pageName(path) {
  return String(path).split(/[?#]/)[0].split('/').pop().replace(/\.html$/, '') || 'index';
}

/**
 * Menu items for the current page.
 * @returns {Array<{key: string, href: string, current: 'page'|'true'|null}>}
 *   current is "page" on the page itself and "true" on its section (aria-current values).
 */
export function menuItems(currentPage) {
  const page = pageName(currentPage);
  return MENU.map(({ key, href, pages = [] }) => ({
    key,
    href,
    // A shortcut into a page (with "#") is never marked: the page's own item is.
    current: href.includes('#') ? null : pageName(href) === page ? 'page' : pages.includes(page) ? 'true' : null,
  }));
}

/** "Idioma: PT | EN" at the end of the menu; the current language is pressed. */
function languageSwitch(t) {
  const li = el('li', 'site-lang');
  const group = el('div', 'site-lang-group');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('nav.menu.language'));
  const label = el('span', 'site-lang-label', t('nav.menu.language'));
  label.setAttribute('aria-hidden', 'true');
  group.append(label);
  // In LANGUAGES order (Portuguese first), limited to the languages the site has.
  for (const locale of Object.keys(LANGUAGES).filter((l) => CONFIG.supportedLocales.includes(l))) {
    const { short, name, tag } = LANGUAGES[locale];
    const option = el('button', 'site-lang-option', short);
    option.type = 'button';
    option.lang = tag;
    option.setAttribute('aria-label', name);
    option.setAttribute('aria-pressed', String(t.locale === locale));
    option.addEventListener('click', () => {
      if (t.locale !== locale) switchLocale(locale);
    });
    group.append(option);
  }
  li.append(group);
  return li;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Build the button and list, and make them open, close and label themselves.
 * Closes on Escape (focus returns to the button), on a click outside, and when focus leaves.
 * @param {HTMLElement} nav The empty <nav data-site-nav>.
 * @param {Function} t Translator from createTranslator().
 * @param {string} [currentFile] Defaults to the page being shown.
 */
export function mountSiteMenu(nav, t, currentFile = pageName(location.pathname)) {
  if (!nav) return;
  nav.setAttribute('aria-label', t('nav.menu.label'));

  const button = el('button', 'site-burger');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'site-menu');
  const lines = el('span', 'site-burger-lines');
  lines.setAttribute('aria-hidden', 'true');
  lines.append(el('span'), el('span'), el('span'));
  button.append(lines);

  const list = el('ul', 'site-menu');
  list.id = 'site-menu';
  list.hidden = true;
  for (const item of menuItems(currentFile)) {
    const link = el('a');
    link.href = item.href;
    if (item.current) link.setAttribute('aria-current', item.current);
    link.append(el('span', 'site-menu-name', t(`nav.menu.${item.key}.name`)), el('span', 'site-menu-text', t(`nav.menu.${item.key}.text`)));
    const li = el('li');
    li.append(link);
    list.append(li);
  }
  list.append(languageSwitch(t));
  nav.replaceChildren(button, list);

  const setOpen = (open) => {
    const label = t(open ? 'nav.menu.close' : 'nav.menu.open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', label);
    button.title = label;
    list.hidden = !open;
  };
  setOpen(false);
  button.addEventListener('click', () => {
    const open = list.hidden;
    setOpen(open);
    if (open) list.querySelector('a').focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!list.hidden && !nav.contains(e.target)) setOpen(false);
  });
  // A link to a spot on the same page (e.g. a glossary entry) doesn't load a new page: close the menu.
  list.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  list.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !nav.contains(e.relatedTarget)) setOpen(false);
  });
}

/** The project's Instagram, linked from the site footer. */
export const INSTAGRAM_URL = 'https://www.instagram.com/quaseparaquedista/';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The Instagram symbol, drawn like the site's other line icons. */
function instagramIcon() {
  const icon = document.createElementNS(SVG_NS, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 5 }], ['circle', { cx: 12, cy: 12, r: 4.2 }], ['circle', { cx: 17.3, cy: 6.7, r: 1.15, class: 'dot' }]]) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    icon.append(shape);
  }
  return icon;
}

/**
 * The site footer, the last thing on every page (after the page's own disclaimer): the name,
 * links to About us, the suggestion form and Instagram, and a signature. Defined once, here,
 * like the menu; each page's script calls it. Text comes from footer.* in the i18n files.
 * @param {Function} t Translator from createTranslator().
 */
export function mountSiteFooter(t) {
  if (document.querySelector('.site-footer')) return;
  const newTab = (link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(el('span', 'sr', ` ${t('feedback.newTab')}`));
    return link;
  };
  const pill = (href, text) => {
    const link = el('a', 'sf-pill', text);
    link.href = href;
    return link;
  };

  const links = el('nav', 'sf-links');
  links.setAttribute('aria-label', t('footer.label'));
  links.append(pill('sobre', t('nav.menu.about.name')));
  // The suggestion form, only when one is configured (as on the welcome page).
  if (isFeedbackFormUrl(CONFIG.feedbackFormUrl)) links.append(newTab(pill(CONFIG.feedbackFormUrl.trim(), t('footer.feedback'))));
  const instagram = newTab(pill(INSTAGRAM_URL, t('footer.instagram')));
  instagram.prepend(instagramIcon());
  links.append(instagram);

  const inner = el('div', 'sf-inner');
  inner.append(el('p', 'sf-brand', 'QuaseParaquedista'), links, el('p', 'sf-sign', t('footer.sign')));
  const footer = el('footer', 'site-footer');
  footer.append(inner);
  document.body.append(footer);
}
