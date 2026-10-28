/**
 * Tabs on the training materials page: CBPq and USPA.
 *
 * Without JavaScript both lists show, one after the other. The open tab is kept in the
 * address (materiais-instrucao#uspa), so a link or the Back button returns to it; with no
 * tab in the address, Portuguese opens on CBPq and English on USPA.
 */

/** Which tab opens: the one in the address, else the one for the reader's language. */
export function initialTab(names, hash, locale) {
  const fromHash = hash.replace('#', '');
  if (names.includes(fromHash)) return fromHash;
  return locale.startsWith('pt') ? names[0] : names[names.length - 1];
}

/**
 * @param {HTMLElement} root Element with [role="tablist"] and the panels. Each tab names itself
 * for the address with data-tab="uspa"; its panel has another id ("panel-uspa"), so opening
 * materiais-instrucao#uspa doesn't scroll down to the panel.
 */
export function mountTabs(root, locale) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const names = tabs.map((tab) => tab.dataset.tab);
  root.querySelector('[role="tablist"]').hidden = false;

  const select = (name, { focus = false, keepAddress = false } = {}) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) tab.focus();
    });
    if (!keepAddress) history.replaceState(null, '', `#${name}`);
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(names[i]));
    // Arrow keys move between tabs, as in any tab list.
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      select(names[(i + step + names.length) % names.length], { focus: true });
    });
  });
  select(initialTab(names, location.hash, locale), { keepAddress: true });
}
