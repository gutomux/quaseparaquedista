/**
 * The view: everything that reads or writes the DOM lives here.
 *
 * It knows nothing about how searching works. It receives ready-made data
 * (entries, highlight segments) and reports user actions through callbacks.
 * All text is inserted with textContent, never innerHTML, so glossary data
 * can never inject markup. Interface text comes from the translator (see i18n.js).
 */

/** Small helper to create an element with a class and optional text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Render highlight segments ([{text, match}]) into a parent element. */
function appendSegments(parent, segments) {
  for (const { text, match } of segments) {
    parent.append(match ? el('mark', '', text) : document.createTextNode(text));
  }
}


export class GlossaryView {
  /**
   * @param {Document|HTMLElement} root Where to look up the page elements.
   * @param {Function} t Translator from createTranslator().
   */
  constructor(root = document, t = (key) => key) {
    this.root = root;
    this.t = t;
    this.input = root.querySelector('#q');
    this.clearButton = root.querySelector('#clear');
    this.list = root.querySelector('#list');
    this.result = root.querySelector('#result');
    this.examples = root.querySelector('#try');
    this.status = root.querySelector('#status');
    this.searchBox = root.querySelector('.search');
    this.feedbackLink = root.querySelector('#feedback');
  }

  /**
   * Fill every element marked with data-i18n (text) or data-i18n-attr
   * ("attribute:key; attribute:key") with the current locale's text.
   */
  applyTranslations() {
    const { t } = this;
    const doc = this.root.ownerDocument || this.root;
    doc.documentElement.lang = t('meta.lang');
    doc.title = t('meta.title');
    this.root.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    this.root.querySelectorAll('[data-i18n-attr]').forEach((node) => {
      node.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((p) => p.trim());
        if (attr && key) node.setAttribute(attr, t(key));
      });
    });
  }

  typeBadge(type) {
    return el('span', `kind${type === 'acronym' ? ' acr' : ''}`, this.t(`entry.type.${type}`));
  }

  /**
   * Connect user actions to controller callbacks.
   * @param {object} handlers
   * @param {(value: string) => void} handlers.onInput
   * @param {(key: string, event: KeyboardEvent) => void} handlers.onKey
   * @param {(id: string) => void} handlers.onSelect   An entry was chosen.
   * @param {(index: number) => void} handlers.onHover A suggestion was hovered.
   * @param {(query: string) => void} handlers.onExample An example chip was clicked.
   * @param {() => void} handlers.onClear
   * @param {() => void} handlers.onDismiss Click outside the search box.
   * @param {(values: {body: string, gear: string, canopy: string}) => void} handlers.onCalculatorInput
   */
  bind(handlers) {
    this.input.addEventListener('input', () => handlers.onInput(this.input.value));
    this.input.addEventListener('keydown', (e) => handlers.onKey(e.key, e));
    this.clearButton.addEventListener('click', () => handlers.onClear());

    // mousedown (not click) so the input keeps focus while choosing.
    this.list.addEventListener('mousedown', (e) => {
      const option = e.target.closest('[data-id]');
      if (!option) return;
      e.preventDefault();
      handlers.onSelect(option.dataset.id);
    });
    this.list.addEventListener('mousemove', (e) => {
      const option = e.target.closest('[data-index]');
      if (option) handlers.onHover(Number(option.dataset.index));
    });

    // The calculator is re-created with each card, so listen on the result area.
    this.result.addEventListener('input', (e) => {
      if (e.target.closest('.calc')) handlers.onCalculatorInput(this.readCalculator());
    });

    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip && chip.dataset.id) handlers.onSelect(chip.dataset.id);
      else if (chip && chip.dataset.example) handlers.onExample(chip.dataset.example);
      if (!e.target.closest('.search')) handlers.onDismiss();
    });
  }

  /* ---------- Search field ---------- */

  setQuery(value) {
    this.input.value = value;
    this.setClearVisible(value.length > 0);
  }

  setClearVisible(visible) {
    this.clearButton.classList.toggle('show', visible);
  }

  focusInput() {
    this.input.focus();
  }

  /* ---------- Suggestions ---------- */

  /**
   * @param {Array<{entry: object, nameSegments: Array, subSegments: Array}>} items
   *   entry is already localized (see localizeEntry). subSegments may show
   *   the expansion, the definition, or the matched name in another language.
   * @param {number} activeIndex
   */
  renderSuggestions(items, activeIndex) {
    const options = items.map(({ entry, nameSegments, subSegments }, i) => {
      const li = el('li');
      li.id = `opt-${i}`;
      li.setAttribute('role', 'option');
      li.dataset.id = entry.id;
      li.dataset.index = String(i);
      const name = el('span', 's-name');
      const sub = el('span', 's-sub');
      appendSegments(name, nameSegments);
      appendSegments(sub, subSegments);
      li.append(this.typeBadge(entry.type), name, sub);
      return li;
    });
    this.list.replaceChildren(...options);
    this.openList();
    this.setActive(activeIndex);
    this.announce(this.t('search.count', { count: items.length }));
  }

  renderNoMatches(query) {
    const li = el('li', 'empty-row', this.t('search.noMatch', { query }));
    li.setAttribute('role', 'option');
    li.setAttribute('aria-disabled', 'true');
    this.list.replaceChildren(li);
    this.openList();
    this.setActive(-1);
    this.announce(this.t('search.noMatchStatus'));
  }

  setActive(index) {
    this.list.querySelectorAll('[data-index]').forEach((li) => {
      li.setAttribute('aria-selected', String(Number(li.dataset.index) === index));
    });
    if (index >= 0) {
      this.input.setAttribute('aria-activedescendant', `opt-${index}`);
      this.list.querySelector(`#opt-${index}`)?.scrollIntoView({ block: 'nearest' });
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  openList() {
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  closeList() {
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }

  /* ---------- Examples ---------- */

  renderExamples(examples) {
    const chips = examples.map((text) => {
      const button = el('button', 'chip', text);
      button.type = 'button';
      button.dataset.example = text;
      return button;
    });
    this.examples.replaceChildren(el('span', '', this.t('examples.label')), ...chips);
  }

  setExamplesVisible(visible) {
    this.examples.hidden = !visible;
  }

  /* ---------- Result card ---------- */

  /**
   * @param {object} entry Localized entry to show.
   * @param {Array<{language: string, term: string}>} otherNames Names in other locales that differ.
   * @param {Array<object>} related Localized related entries.
   * @param {object} [extras]
   * @param {{caption: string, headers: string[], rows: Array<{category: string, cells: string[]}>, footnote: string}} [extras.limits]
   *   Ready-to-show limits table for entries with a calculator.
   */
  renderEntry(entry, otherNames, related, extras = {}) {
    const card = el('article', 'card');
    card.lang = this.t('meta.lang');
    card.append(this.typeBadge(entry.type), el('h2', '', entry.term));
    if (entry.type === 'acronym') card.append(el('p', 'stands', entry.expansion));
    for (const { language, term } of otherNames) {
      card.append(el('p', 'other-lang', this.t('entry.inLanguage', { language, term })));
    }
    card.append(el('p', 'def', entry.definition));
    if (entry.calculator === 'wing-loading') card.append(this.buildWingLoadingCalculator());
    if (extras.limits) card.append(this.buildLimitsTable(extras.limits));

    if (related.length) {
      const also = el('div', 'also');
      also.append(el('span', '', this.t('entry.seeAlso')));
      for (const r of related) {
        const chip = el('button', 'chip', r.term);
        chip.type = 'button';
        chip.dataset.id = r.id;
        also.append(chip);
      }
      card.append(also);
    }
    this.result.replaceChildren(card);
  }

  /** Build the three wing-loading fields and the result line. */
  buildWingLoadingCalculator() {
    const key = (k) => this.t(`calculator.wingLoading.${k}`);
    const form = el('div', 'calc');
    form.setAttribute('role', 'group');
    form.setAttribute('aria-label', key('label'));

    for (const name of ['body', 'gear', 'canopy']) {
      const id = `calc-${name}`;
      const label = el('label', 'calc-field');
      label.htmlFor = id;
      const input = el('input');
      Object.assign(input, { id, name, type: 'text', inputMode: 'decimal', autocomplete: 'off', placeholder: key(`${name}Placeholder`) });
      label.append(el('span', '', key(name)), input);
      form.append(label);
    }
    const output = el('output', 'calc-result', key('missing'));
    output.setAttribute('aria-live', 'polite');
    output.htmlFor = 'calc-body calc-gear calc-canopy';
    form.append(output);
    return form;
  }

  /** Build a small table (caption, header row, rows, footnote). Rows carry data-category for highlighting. */
  buildLimitsTable({ caption, headers, rows, footnote }) {
    const wrap = el('div', 'limits');
    const table = el('table');
    table.append(el('caption', '', caption));
    const head = el('tr');
    headers.forEach((h) => { const th = el('th', '', h); th.scope = 'col'; head.append(th); });
    table.append(el('thead'));
    table.tHead.append(head);
    const body = el('tbody');
    for (const { category, cells } of rows) {
      const tr = el('tr');
      tr.dataset.category = category;
      cells.forEach((c, i) => {
        const cell = el(i === 0 ? 'th' : 'td', '', c);
        if (i === 0) cell.scope = 'row';
        tr.append(cell);
      });
      body.append(tr);
    }
    table.append(body);
    wrap.append(table);
    if (footnote) wrap.append(el('p', 'limits-note', footnote));
    return wrap;
  }

  /** Current text in the calculator fields. */
  readCalculator() {
    const value = (name) => this.result.querySelector(`#calc-${name}`)?.value ?? '';
    return { body: value('body'), gear: value('gear'), canopy: value('canopy') };
  }

  /**
   * Show the calculator outcome.
   * @param {string} message Main line (result or guidance).
   * @param {string} [detail] Secondary line, e.g. the worked formula.
   * @param {boolean} [ok] Whether this is a real result (styled more strongly).
   * @param {object} [match]
   * @param {string[]} [match.lines] Category match sentences.
   * @param {string} [match.category] Limits-table row to highlight.
   */
  setCalculatorResult(message, detail = '', ok = false, match = {}) {
    const output = this.result.querySelector('.calc-result');
    if (!output) return;
    output.classList.toggle('has-value', ok);
    output.replaceChildren(el('strong', '', message));
    if (detail) output.append(el('span', 'calc-formula', detail));
    (match.lines || []).forEach((line, i) => output.append(el('span', i === 0 ? 'calc-match' : 'calc-match-note', line)));

    this.result.querySelectorAll('.limits tr[data-category]').forEach((tr) => {
      const hit = tr.dataset.category === match.category;
      tr.classList.toggle('is-match', hit);
      if (hit) tr.setAttribute('aria-current', 'true');
      else tr.removeAttribute('aria-current');
    });
  }

  clearResult() {
    this.result.replaceChildren();
  }

  renderError(title, message) {
    const box = el('div', 'card error');
    box.append(el('h2', '', title), el('p', 'def', message));
    this.result.replaceChildren(box);
    this.input.disabled = true;
    this.setExamplesVisible(false);
  }

  /* ---------- Feedback ---------- */

  /** Point the "Suggest an entry or correction" button at a mailto: link. */
  setFeedbackLink(href) {
    if (this.feedbackLink) this.feedbackLink.href = href;
  }

  /* ---------- Accessibility ---------- */

  announce(message) {
    this.status.textContent = message;
  }
}
