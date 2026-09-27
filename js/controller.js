/**
 * The controller: holds UI state and connects the search logic to the view.
 * It never touches the DOM directly; it only calls view methods.
 *
 * Search always covers every locale. Results are shown in the user's locale;
 * when a match came from another language, the suggestion shows that name
 * too, so a Portuguese reader typing "canopy" sees "Velame — Em inglês: Canopy".
 */
import { search, highlightSegments, findRelated, normalize } from './search.js';
import { localizeEntry } from './data.js';

export class GlossaryController {
  /**
   * @param {object} deps
   * @param {Array<object>} deps.entries Raw glossary entries.
   * @param {Array<object>} deps.index   Output of createIndex(entries, locales).
   * @param {import('./view.js').GlossaryView} deps.view
   * @param {Function} deps.t            Translator for the current locale.
   * @param {string} deps.locale         Current locale, e.g. 'pt_BR'.
   * @param {object} deps.config         See config.js.
   */
  constructor({ entries, index, view, t, locale, config }) {
    this.entries = entries;
    this.index = index;
    this.view = view;
    this.t = t;
    this.locale = locale;
    this.config = config;
    this.byId = new Map(entries.map((e) => [e.id, e]));

    this.state = { query: '', results: [], active: -1, open: false };
  }

  start() {
    this.view.applyTranslations();
    this.view.renderExamples(this.t.raw('examples.items') || []);
    this.view.bind({
      onInput: (value) => this.handleInput(value),
      onKey: (key, event) => this.handleKey(key, event),
      onSelect: (id) => this.select(id),
      onHover: (i) => this.setActive(i),
      onExample: (query) => this.selectBestMatch(query),
      onClear: () => this.clear(),
      onDismiss: () => this.closeSuggestions(),
    });
  }

  /** Entry text in the current locale, falling back to the default locale. */
  localize(entry) {
    return localizeEntry(entry, this.locale, this.config.defaultLocale);
  }

  languageName(locale) {
    return this.t(`languages.${locale}`);
  }

  runSearch(query) {
    return search(this.index, query, {
      limit: this.config.maxSuggestions,
      minDefinitionQueryLength: this.config.minDefinitionQueryLength,
      preferLocale: this.locale,
    });
  }

  /** Build what one suggestion row shows, including cross-language hints. */
  toSuggestion({ entry, locale: matchedLocale }, query) {
    const shown = this.localize(entry);
    const matched = entry.translations[matchedLocale];
    const fromOtherLanguage = matchedLocale !== shown.locale
      && normalize(matched.term) !== normalize(shown.term);

    let subText;
    if (fromOtherLanguage) {
      subText = this.t('entry.inLanguage', { language: this.languageName(matchedLocale), term: matched.term });
    } else {
      subText = shown.type === 'acronym' ? shown.expansion : shown.definition;
    }
    return {
      entry: shown,
      nameSegments: highlightSegments(shown.term, query),
      subSegments: highlightSegments(subText, query),
    };
  }

  handleInput(value) {
    this.state.query = value;
    this.view.setClearVisible(value.length > 0);

    if (!value.trim()) {
      this.closeSuggestions();
      return;
    }

    const results = this.runSearch(value);
    this.state.results = results;
    this.state.active = results.length ? 0 : -1;
    this.state.open = true;

    if (!results.length) {
      this.view.renderNoMatches(value.trim());
      return;
    }
    this.view.renderSuggestions(results.map((r) => this.toSuggestion(r, value)), this.state.active);
  }

  handleKey(key, event) {
    const { results, open } = this.state;
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) this.handleInput(this.state.query);
        else if (results.length) this.setActive((this.state.active + 1) % results.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (results.length) this.setActive((this.state.active - 1 + results.length) % results.length);
        break;
      case 'Enter':
        event.preventDefault();
        if (open && results[this.state.active]) this.select(results[this.state.active].entry.id);
        else this.selectBestMatch(this.state.query);
        break;
      case 'Escape':
        if (open) this.closeSuggestions();
        else this.clear();
        break;
      default:
        break;
    }
  }

  setActive(index) {
    if (index === this.state.active) return;
    this.state.active = index;
    this.view.setActive(index);
  }

  select(id) {
    const entry = this.byId.get(id);
    if (!entry) return;
    const shown = this.localize(entry);

    // Names in the other languages, when they differ from the one shown.
    const otherNames = this.config.supportedLocales
      .filter((locale) => locale !== shown.locale && entry.translations[locale])
      .map((locale) => ({ language: this.languageName(locale), term: entry.translations[locale].term }))
      .filter(({ term }) => normalize(term) !== normalize(shown.term));

    const related = findRelated(this.entries, entry, {
      locale: this.config.defaultLocale,
      limit: this.config.maxRelated,
    }).map((e) => this.localize(e));

    this.state.query = shown.term;
    this.view.setQuery(shown.term);
    this.closeSuggestions();
    this.view.setExamplesVisible(false);
    this.view.renderEntry(shown, otherNames, related);
  }

  selectBestMatch(query) {
    const [best] = this.runSearch(query || '');
    if (best) this.select(best.entry.id);
  }

  closeSuggestions() {
    this.state.open = false;
    this.view.closeList();
  }

  clear() {
    this.state = { query: '', results: [], active: -1, open: false };
    this.view.setQuery('');
    this.view.closeList();
    this.view.clearResult();
    this.view.setExamplesVisible(true);
    this.view.focusInput();
  }
}
