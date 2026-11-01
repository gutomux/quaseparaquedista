/**
 * The wing load page (wingload.html), opened from the menu and the welcome page: the "Carga alar"
 * definition, the calculator and the CBPq limits table. They are the glossary entry's own pieces
 * (GlossaryView builds them, GlossaryController fills them in), so the two always match.
 */
import { CONFIG } from './config.js';
import { loadMessages, createTranslator } from './i18n.js';
import { currentLocale } from './locale.js';
import { applyTranslations, GlossaryView } from './view.js';
import { GlossaryController } from './controller.js';
import { mountSiteMenu, mountSiteFooter } from './nav.js';

/** The glossary entry this page is about. */
const ENTRY_ID = 'term-wing-loading';

async function init() {
  const locale = currentLocale(CONFIG);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, document.body.dataset.titleKey);
  mountSiteMenu(document.querySelector('[data-site-nav]'), t);
  mountSiteFooter(t);

  // The definition, from the glossary (in the reader's language, else the default one).
  try {
    const response = await fetch(CONFIG.dataUrl, { cache: 'no-cache' });
    const data = await response.json();
    const entry = (Array.isArray(data) ? data : data.entries).find((e) => e.id === ENTRY_ID);
    const text = entry?.translations?.[locale] ?? entry?.translations?.[CONFIG.defaultLocale];
    if (text) document.querySelector('#wing-intro').textContent = text.definition;
  } catch {
    // Without the definition the calculator still works.
  }

  const view = new GlossaryView(document, t);
  const controller = new GlossaryController({ entries: [], index: null, view, t, locale, config: CONFIG });
  const card = document.createElement('article');
  card.className = 'card';
  card.append(view.buildWingLoadingCalculator(), view.buildLimitsTable(controller.wingLoadingLimitsTable()));
  view.result.replaceChildren(card);
  view.result.addEventListener('input', (e) => {
    if (e.target.closest('.calc')) controller.updateWingLoading(view.readCalculator());
  });
}

init().catch((error) => console.error(error));
