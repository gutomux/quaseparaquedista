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

/**
 * Languages in the switch: a short label, and the language's own name (read by screen readers,
 * so a speaker of that language can find it whatever language the page is in).
 */
export const LANGUAGES = Object.freeze({
  pt_BR: { short: 'PT', name: 'Português', tag: 'pt-BR' },
  en_US: { short: 'EN', name: 'English', tag: 'en-US' },
});

/** Pages in the menu, in order. Pages under a section (e.g. the PDFs) mark that section. */
export const MENU = Object.freeze([
  { key: 'home', href: 'index.html' },
  { key: 'glossary', href: 'glossary.html' },
  { key: 'freefall', href: 'freefall.html' },
  { key: 'materials', href: 'materiais-instrucao.html', pages: ['apostila-aff.html', 'revisao-emergencias-aff.html', 'aff-videos.html'] },
]);

/** The page file name from a path: "/glossary.html" → "glossary.html", "/" → "index.html". */
export function pageFile(pathname) {
  return String(pathname).split('/').pop() || 'index.html';
}

/**
 * Menu items for the current page.
 * @returns {Array<{key: string, href: string, current: 'page'|'true'|null}>}
 *   current is "page" on the page itself and "true" on its section (aria-current values).
 */
export function menuItems(currentFile) {
  return MENU.map(({ key, href, pages = [] }) => ({
    key,
    href,
    current: href === currentFile ? 'page' : pages.includes(currentFile) ? 'true' : null,
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
export function mountSiteMenu(nav, t, currentFile = pageFile(location.pathname)) {
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
  list.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !nav.contains(e.relatedTarget)) setOpen(false);
  });
}
