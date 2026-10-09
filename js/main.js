/**
 * Entry point: detect the locale, load interface text and data,
 * build the search index, start the app.
 */
import { CONFIG } from './config.js';
import { loadMessages, createTranslator } from './i18n.js';
import { currentLocale } from './locale.js';
import { loadGlossary } from './data.js';
import { createIndex } from './search.js';
import { GlossaryView, supportsFlagEmoji } from './view.js';
import { GlossaryController } from './controller.js';
import { mountSiteMenu } from './nav.js';

/**
 * The open entry lives in the address: glossary.html#term-canopy. Opening an entry adds a
 * history step, so the link can be shared and the phone's Back button returns to the last one.
 */
function hashRouter() {
  const current = () => decodeURIComponent(location.hash.slice(1)) || null;
  return {
    current,
    push(id) {
      if (current() === id) return;
      history.pushState(null, '', id ? `#${encodeURIComponent(id)}` : location.pathname + location.search);
    },
  };
}

async function init() {
  const locale = currentLocale(CONFIG);
  const viewOptions = { flags: supportsFlagEmoji(navigator) };
  let t = createTranslator({}, locale);
  let view = new GlossaryView(document, t, viewOptions);

  try {
    const [messages, glossary] = await Promise.all([
      loadMessages(CONFIG.i18nPath, locale),
      loadGlossary(CONFIG.dataUrl, CONFIG.supportedLocales),
    ]);
    t = createTranslator(messages, locale);
    view = new GlossaryView(document, t, viewOptions);

    const controller = new GlossaryController({
      entries: glossary.entries,
      index: createIndex(glossary.entries, CONFIG.supportedLocales),
      view,
      t,
      locale,
      config: CONFIG,
      router: hashRouter(),
    });
    // Back and Forward move between opened entries.
    window.addEventListener('popstate', () => controller.openFromRoute(hashRouter().current()));
    controller.start();
    mountSiteMenu(document.querySelector('[data-site-nav]'), t);
  } catch (error) {
    console.error(error);
    // Interface text may be what failed to load, so fall back to English here.
    view.renderError(
      'Glossary unavailable',
      'The glossary data could not be loaded. Refresh the page, or check that the data and i18n folders are published next to glossary.html.',
    );
  }
}

init();
