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
 * Items with a `group` are listed under that group's title (nav.menu.groups.*); Home has none.
 * Links have no ".html": GitHub Pages serves "/glossary" from glossary.html, and "./" is Home.
 */
export const MENU = Object.freeze([
  { key: 'home', href: './' },
  { key: 'glossary', href: 'glossary', group: 'tools' },
  { key: 'wingLoad', href: 'wingload', group: 'tools' },
  { key: 'freefall', href: 'freefall', group: 'tools' },
  { key: 'navigation', href: 'navigation', group: 'tools' },
  { key: 'materials', href: 'materiais-instrucao', pages: ['apostila-aff', 'revisao-emergencias-aff', 'aff-videos', 'uspa-update'], group: 'study' },
  { key: 'travel', href: 'traveling', group: 'guides' },
  { key: 'about', href: 'sobre', group: 'about' },
]);

/**
 * Each menu item's icon (SVG paths on a 24 × 24 grid), the same as its tile on the welcome page;
 * Home is a house, the travel guide an airplane seen from above and About us two people.
 * A circle with r 1.3 is drawn filled.
 */
const MENU_ICONS = Object.freeze({
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
  glossary: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  wingLoad: '<circle cx="12" cy="6" r="2.5"/><path d="M7.5 9.5h9L19 20H5z"/>',
  freefall: '<path d="M3 10.5a9 7 0 0 1 18 0"/><path d="M3 10.5 12 19l9-8.5M8.2 10l3.8 9 3.8-9"/><circle cx="12" cy="20.3" r="1.3"/>',
  navigation: '<path d="M5 19h14"/><path d="M17 5v9H7"/><path d="m10 11-3 3 3 3"/><circle cx="17" cy="5" r="1.3"/>',
  materials: '<path d="M4 5.5C6.5 4.2 9.5 4.2 12 6c2.5-1.8 5.5-1.8 8-.5v13c-2.5-1.3-5.5-1.3-8 .5-2.5-1.8-5.5-1.8-8-.5z"/><path d="M12 6v13.5"/>',
  travel: '<path d="M12 3c.9 0 1.5.8 1.5 1.8V9.5l7 4v2l-7-2v4.2l2 1.6V21L12 20l-3.5 1v-1.7l2-1.6v-4.2l-7 2v-2l7-4V4.8C10.5 3.8 11.1 3 12 3z"/>',
  about: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c.4-3.2 2.6-5.5 5.5-5.5s5.1 2.3 5.5 5.5"/><path d="M15.5 5.3a3 3 0 0 1 0 5.4M17.5 14.3c1.8.7 2.8 2.7 3 5.2"/>',
});

/** Where the open menu dims the page behind it: phones (matches the CSS below 40rem). */
const DIMMED = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 40rem)') : { matches: false };

/** A small yellow icon tile for a menu item (decorative: the name says it all). */
function menuIcon(key) {
  const tile = el('span', 'icon-tile site-menu-icon');
  tile.setAttribute('aria-hidden', 'true');
  // Fixed markup from MENU_ICONS above, never page or user text.
  tile.innerHTML = `<svg viewBox="0 0 24 24">${MENU_ICONS[key] || ''}</svg>`;
  return tile;
}

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
  return MENU.map(({ key, href, pages = [], group = null }) => ({
    key,
    href,
    group,
    // A shortcut into a page (with "#") is never marked: the page's own item is.
    current: href.includes('#') ? null : pageName(href) === page ? 'page' : pages.includes(page) ? 'true' : null,
  }));
}

/** Space left under the menu's top edge on the visible screen, keeping a 12 px gap at the bottom. */
export function menuMaxHeight(screenHeight, menuTop, gap = 12) {
  return Math.floor(screenHeight - menuTop - gap);
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
  // Items in a group go in their own list under the group's title, so screen readers hear
  // "Ferramentas, list, 4 items".
  let groupList = null;
  let groupName = null;
  for (const item of menuItems(currentFile)) {
    const link = el('a');
    link.href = item.href;
    if (item.current) link.setAttribute('aria-current', item.current);
    // Names only: the menu is for finding your way, so it stays short (the home tiles describe each tool).
    link.append(menuIcon(item.key), el('span', 'site-menu-name', t(`nav.menu.${item.key}.name`)));
    // "Você está aqui" on the page you're on (or its section). Screen readers already hear that
    // from aria-current, so the tag is for the eyes only.
    if (item.current) {
      const here = el('span', 'site-menu-here', t('nav.menu.here'));
      here.setAttribute('aria-hidden', 'true');
      link.append(here);
    }
    const li = el('li');
    li.append(link);
    if (!item.group) {
      list.append(li);
      groupName = null;
      continue;
    }
    if (item.group !== groupName) {
      groupName = item.group;
      const section = el('li', 'site-menu-group');
      const title = el('span', 'site-menu-heading', t(`nav.menu.groups.${groupName}`));
      title.id = `site-menu-${groupName}`;
      groupList = el('ul');
      groupList.setAttribute('aria-labelledby', title.id);
      section.append(title, groupList);
      list.append(section);
    }
    groupList.append(li);
  }
  list.append(languageSwitch(t));
  nav.replaceChildren(button, list);

  // The menu ends at the bottom of the visible screen and scrolls inside when it's taller: on a
  // phone the page behind doesn't scroll, so items below the edge (Sobre nós, the languages)
  // would be out of reach. The visible height changes as a phone browser shows or hides its address bar.
  const fitToScreen = () => {
    if (list.hidden) return;
    const screenHeight = window.visualViewport?.height ?? window.innerHeight;
    list.style.maxHeight = `${Math.max(menuMaxHeight(screenHeight, list.getBoundingClientRect().top), 0)}px`;
  };
  window.visualViewport?.addEventListener('resize', fitToScreen);
  window.addEventListener('resize', fitToScreen);

  const setOpen = (open) => {
    const label = t(open ? 'nav.menu.close' : 'nav.menu.open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', label);
    button.title = label;
    list.hidden = !open;
    // On a phone the page behind is dimmed and doesn't scroll while the menu is open (css: .site-menu-open).
    document.documentElement.classList.toggle('site-menu-open', open);
    if (open) {
      list.scrollTop = 0;
      fitToScreen();
    }
  };
  setOpen(false);
  button.addEventListener('click', (e) => {
    const open = list.hidden;
    setOpen(open);
    // Opened with the keyboard (Enter or Space: a click with no pointer, detail 0): move into the
    // menu, on the page you're on. Opened with a tap or click: leave the focus on the button, so no
    // outline appears on an item and makes it look like the current page.
    if (open && e.detail === 0) (list.querySelector('a[aria-current]') || list.querySelector('a')).focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (list.hidden || nav.contains(e.target)) return;
    // On a phone the page is dimmed, so a tap there only closes the menu: it doesn't also press
    // the link or button underneath (captured before the page sees it).
    if (DIMMED.matches) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(false);
  }, true);
  // A link to a spot on the same page (e.g. a glossary entry) doesn't load a new page: close the menu.
  list.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  list.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !nav.contains(e.relatedTarget)) setOpen(false);
  });
  mountSiteBar(t, currentFile);
}

/**
 * The top bar on computers (CSS shows it from 56rem wide and hides the ☰ there): the site name
 * (goes home), the menu groups (a group with several items opens a small dropdown, one with a
 * single item is a plain link named after the group) and the language switch. It stays at the
 * top while the page scrolls. Built from MENU, like the ☰ menu, so both always match.
 */
function mountSiteBar(t, currentFile) {
  if (document.querySelector('.site-bar')) return;
  const items = menuItems(currentFile);
  const groups = [];
  for (const item of items.filter((i) => i.group)) {
    const group = groups.find((g) => g.name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  const bar = el('header', 'site-bar');
  const inner = el('div', 'site-bar-inner');
  const home = items.find((i) => i.key === 'home');
  const brand = el('a', 'site-bar-brand', 'QuaseParaquedista');
  brand.href = home.href;
  if (home.current) brand.setAttribute('aria-current', home.current);
  const nav = el('nav', 'site-bar-nav');
  nav.setAttribute('aria-label', t('nav.menu.label'));
  const list = el('ul', 'site-bar-links');

  const dropdowns = [];
  for (const group of groups) {
    const li = el('li');
    const title = t(`nav.menu.groups.${group.name}`);
    const current = group.items.find((i) => i.current);
    if (group.items.length === 1) {
      const link = el('a', 'site-bar-link', title);
      link.href = group.items[0].href;
      if (current) link.setAttribute('aria-current', current.current);
      li.append(link);
    } else {
      const button = el('button', 'site-bar-link site-bar-toggle', title);
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.id = `site-bar-${group.name}`;
      if (current) button.classList.add('is-current');
      const caret = el('span', 'site-bar-caret', '▾');
      caret.setAttribute('aria-hidden', 'true');
      button.append(caret);
      const menu = el('ul', 'site-bar-menu');
      menu.hidden = true;
      menu.setAttribute('aria-labelledby', button.id);
      for (const item of group.items) {
        const link = el('a');
        link.href = item.href;
        if (item.current) link.setAttribute('aria-current', item.current);
        link.append(menuIcon(item.key), el('span', 'site-menu-name', t(`nav.menu.${item.key}.name`)));
        const entry = el('li');
        entry.append(link);
        menu.append(entry);
      }
      const setOpen = (open) => {
        button.setAttribute('aria-expanded', String(open));
        menu.hidden = !open;
      };
      button.addEventListener('click', () => setOpen(menu.hidden));
      menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) setOpen(false);
      });
      li.addEventListener('focusout', (e) => {
        if (e.relatedTarget && !li.contains(e.relatedTarget)) setOpen(false);
      });
      dropdowns.push({ li, button, setOpen, isOpen: () => !menu.hidden });
      li.append(button, menu);
    }
    list.append(li);
  }
  nav.append(list);

  const lang = languageSwitch(t);
  const switchGroup = lang.firstChild;
  switchGroup.classList.add('site-bar-lang');
  inner.append(brand, nav, switchGroup);
  bar.append(inner);
  document.body.prepend(bar);

  // A dropdown closes with Esc (back to its button) or a click anywhere else.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const d of dropdowns) if (d.isOpen()) { d.setOpen(false); d.button.focus(); }
  });
  document.addEventListener('click', (e) => {
    for (const d of dropdowns) if (d.isOpen() && !d.li.contains(e.target)) d.setOpen(false);
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
