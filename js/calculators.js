/**
 * Calculators attached to glossary entries. Pure functions only: no DOM.
 *
 * An entry opts in with a "calculator" field in glossary.json,
 * e.g. "calculator": "wing-loading".
 */

/** Conversion used for wing loading: kilograms to pounds. */
export const KG_TO_LB = 2.2;

/** Calculators the app knows how to show. */
export const CALCULATORS = Object.freeze(['wing-loading']);

/**
 * Parse a number typed by the user, accepting "," or "." as the decimal mark.
 * @param {string} text
 * @returns {number|null} null when the field is empty or not a number.
 */
export function parseNumber(text) {
  const cleaned = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

/**
 * Wing loading = (body weight + equipment weight) in kg × 2.2 ÷ canopy size in sq ft.
 * @param {{body: string|number, gear: string|number, canopy: string|number}} input
 * @returns {{value: number, body: number, gear: number, canopy: number} | {error: 'missing'|'invalid'}}
 */
export function computeWingLoading({ body, gear, canopy }) {
  const values = [body, gear, canopy].map((v) => (typeof v === 'number' ? v : parseNumber(v)));
  if (values.some((v) => v === null)) return { error: 'missing' };
  const [b, g, c] = values;
  if (b <= 0 || g < 0 || c <= 0) return { error: 'invalid' };
  return { value: ((b + g) * KG_TO_LB) / c, body: b, gear: g, canopy: c };
}

/**
 * CBPq wing-loading limits per category (Apostila do Aluno, Curso AFF, 2023).
 * min / max: allowed range; recommended: recommended maximum, when CBPq gives one.
 * This is the single source for both the limits table and the category match.
 */
export const WING_LOADING_LIMITS = Object.freeze([
  Object.freeze({ category: 'AI', min: 0.5, max: 1.0 }),
  Object.freeze({ category: 'A', max: 1.1 }),
  Object.freeze({ category: 'B', recommended: 1.1, max: 1.3 }),
  Object.freeze({ category: 'C', recommended: 1.3, max: 1.5 }),
  Object.freeze({ category: 'D', max: Infinity }),
]);

/**
 * Find the lowest CBPq category allowed to jump a given wing loading.
 * Higher categories may always use loadings allowed for lower ones.
 * @param {number} value Wing loading.
 * @returns {{category: string, aboveRecommended: boolean, recommended?: number, max: number}}
 */
export function classifyWingLoading(value) {
  const match = WING_LOADING_LIMITS.find((limit) =>
    (limit.min === undefined || value >= limit.min) && value <= limit.max);
  return {
    category: match.category,
    max: match.max,
    recommended: match.recommended,
    aboveRecommended: match.recommended !== undefined && value > match.recommended,
  };
}
