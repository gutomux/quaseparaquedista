/**
 * Visitor counting with GoatCounter (dashboard: https://quaseparaquedista.goatcounter.com).
 *
 * Every page loads GoatCounter's script (gc.zgo.at/count.js) at the end of its <head>, async,
 * and that script counts the page view by itself. This module adds events: things a visitor
 * does inside a page, such as flying the navigation simulator. Each event shows in the dashboard
 * as its own "page" (the path below), with how many times it happened and by how many visitors.
 *
 * Counting must never break the site: when the script is blocked (ad blockers), hasn't loaded
 * yet, or GoatCounter is offline, `track` does nothing. GoatCounter also ignores visits from
 * localhost and file://, so testing on a computer isn't counted.
 */

/** Ranks of the navigation story (js/navigation/story.js RANKS) → event path and title. */
export const NAV_RESULTS = Object.freeze({
  legendary: { path: 'navegacao/resultado-lendario', title: 'Navegação: Lendário' },
  epic: { path: 'navegacao/resultado-epico', title: 'Navegação: Épico' },
  rare: { path: 'navegacao/resultado-raro', title: 'Navegação: Raro' },
  almost: { path: 'navegacao/resultado-quase', title: 'Navegação: Quase' },
  wasted: { path: 'navegacao/resultado-morridinha', title: 'Navegação: Morridinha' },
});

/** Every flight is counted; these also mark visitors who flew this many times in one visit. */
export const NAV_PLAY_MILESTONES = Object.freeze([2, 3, 5, 10]);

/**
 * The events for the visitor's nth flight in this visit (counted from 1): always "a flight",
 * plus a milestone at the 2nd, 3rd, 5th and 10th.
 * @returns {Array<{path: string, title: string}>}
 */
export function navPlayEvents(n) {
  const events = [{ path: 'navegacao/voo', title: 'Navegação: voos' }];
  if (NAV_PLAY_MILESTONES.includes(n)) {
    events.push({ path: `navegacao/voos-${n}-ou-mais`, title: `Navegação: ${n} voos ou mais na mesma visita` });
  }
  return events;
}

/** Counts one event in GoatCounter, or does nothing if it isn't available. */
export function track({ path, title }, root = globalThis) {
  try {
    root.goatcounter?.count?.({ path, title, event: true });
  } catch {
    // Counting is optional: never let it stop the page.
  }
}
