/**
 * The controller: holds UI state and connects the search logic to the view.
 * It never touches the DOM directly; it only calls view methods.
 *
 * Search always covers every locale. Each suggestion shows the term in every
 * language, the user's locale first, so a Portuguese reader typing "canopy"
 * sees "Velame 🇧🇷 | Canopy 🇺🇸".
 */
import { search, highlightSegments, findRelated, normalize } from './search.js';
import { localizeEntry } from './data.js';
import { isFeedbackFormUrl } from './feedback.js';
import { computeWingLoading, classifyWingLoading, WING_LOADING_LIMITS } from './calculators.js';

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
    const formUrl = this.config.feedbackFormUrl;
    this.view.setFeedbackLink(isFeedbackFormUrl(formUrl) ? formUrl.trim() : '');
    this.view.bind({
      onInput: (value) => this.handleInput(value),
      onKey: (key, event) => this.handleKey(key, event),
      onSelect: (id) => this.select(id),
      onHover: (i) => this.setActive(i),
      onExample: (query) => this.selectBestMatch(query),
      onClear: () => this.clear(),
      onDismiss: () => this.closeSuggestions(),
      onCalculatorInput: (values) => this.updateWingLoading(values),
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

  /** Build what one suggestion row shows: the term in every locale, the shown one first. */
  toSuggestion({ entry }, query) {
    const shown = this.localize(entry);
    const locales = [shown.locale, ...this.config.supportedLocales.filter((l) => l !== shown.locale)];
    const names = locales
      .filter((locale) => entry.translations[locale])
      .map((locale) => ({ locale, segments: highlightSegments(entry.translations[locale].term, query) }));
    const subText = shown.type === 'acronym' ? shown.expansion : shown.definition;
    return {
      entry: shown,
      names,
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
    const extras = shown.calculator === 'wing-loading' ? { limits: this.wingLoadingLimitsTable() } : {};
    this.view.renderEntry(shown, otherNames, related, extras);
  }

  /** Format a number in the reader's locale with a fixed number of decimals. */
  formatNumber(n, digits) {
    return n.toLocaleString(this.t('meta.lang'), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /** Turn WING_LOADING_LIMITS into translated, formatted table rows. */
  wingLoadingLimitsTable() {
    const key = (k, params) => this.t(`calculator.wingLoading.limits.${k}`, params);
    const f = (n) => this.formatNumber(n, Number.isInteger(n * 10) ? 1 : 2);
    const range = ({ min, max, recommended }) => {
      if (max === Infinity) return key('unlimited');
      if (min !== undefined) return key('between', { min: f(min), max: f(max) });
      if (recommended !== undefined) return key('recommendedUpTo', { recommended: f(recommended), max: f(max) });
      return key('upTo', { max: f(max) });
    };
    const c = WING_LOADING_LIMITS.find((l) => l.category === 'C');
    return {
      caption: key('caption'),
      headers: [key('category'), key('loading'), key('canopy')],
      rows: WING_LOADING_LIMITS.map((limit) => ({
        category: limit.category,
        cells: [limit.category, range(limit), key(`canopies.${limit.category}`)],
      })),
      footnote: key('footnote', { recommended: f(c.recommended) }),
    };
  }

  /** Sentences saying which CBPq category a wing loading matches. */
  wingLoadingMatch(value) {
    const key = (k, params) => this.t(`calculator.wingLoading.match.${k}`, params);
    const f = (n) => this.formatNumber(n, 1);
    const result = classifyWingLoading(value);
    const lines = [];
    if (result.category === 'D') lines.push(key('onlyD'));
    else if (result.aboveRecommended) lines.push(key('aboveRecommended', { category: result.category, recommended: f(result.recommended) }));
    else lines.push(key('from', { category: result.category }));
    if (result.category === 'C') lines.push(key('experienceC', { recommended: f(result.recommended) }));
    const studentMin = WING_LOADING_LIMITS[0].min;
    if (value < studentMin) lines.push(key('belowStudentMin', { min: f(studentMin) }));
    return { lines, category: result.category };
  }

  /** Recalculate wing loading and show it, formatted for the current locale. */
  updateWingLoading(values) {
    const key = (k, params) => this.t(`calculator.wingLoading.${k}`, params);
    const outcome = computeWingLoading(values);
    if (outcome.error) {
      this.view.setCalculatorResult(key(outcome.error), '', false, {});
      return;
    }
    const lang = this.t('meta.lang');
    const fmt = (n, digits) => n.toLocaleString(lang, { maximumFractionDigits: digits });
    this.view.setCalculatorResult(
      key('result', { value: outcome.value.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }),
      key('formula', { body: fmt(outcome.body, 1), gear: fmt(outcome.gear, 1), canopy: fmt(outcome.canopy, 0) }),
      true,
      this.wingLoadingMatch(outcome.value),
    );
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
