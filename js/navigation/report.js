/**
 * The report after landing: what went well and what to work on.
 * Pure function of the finished flight, so the grading can be tested.
 */
import { PATTERN } from './pattern.js';

/** Landing distance grades, best first (meters from the target). */
export const LANDING_GRADES = Object.freeze([
  { grade: 'legendary', withinM: 5 },
  { grade: 'great', withinM: 10 },
  { grade: 'goal', withinM: 20 },
]);

/** The flare is on time between these heights above the ground (ft). */
export const FLARE_WINDOW = Object.freeze({ lowFt: 5, highFt: 8 });

/**
 * A right turn in the pattern is a mistake only when it really changes direction: at least this
 * many degrees (a 90° turn that ends a little short still counts). Smaller ones are corrections.
 * Right holds close together (less than `mergeS` seconds of straight flight between them) add up,
 * so a 90° turn made in a few taps still counts.
 */
export const RIGHT_TURN = Object.freeze({ minDeg: 70, mergeS: 2 });

/**
 * A turn started below LOW_TURN_FT (300 ft) is a serious mistake from this many degrees on, either way:
 * the canopy dives and speeds up, and can't flare well, so the landing can hurt. Smaller ones are
 * the gentle corrections allowed on final. Holds the same way close together add up.
 */
export const LOW_TURN = Object.freeze({ minDeg: 45, mergeS: 2 });

/**
 * Holds the same way (`dir`, or either way if null) close together, added up from `key`
 * (degrees), keeping those of at least `minDeg`.
 */
function sumTurns(turns, { dir, key, minDeg, mergeS }) {
  const groups = [];
  let current = null;
  for (const t of turns) {
    if (dir !== null && t.dir !== dir) {
      current = null;
      continue;
    }
    if (current && current.dir === t.dir && t.start - current.end < mergeS) {
      current.deg += t[key] || 0;
      current.end = t.end ?? t.start;
    } else {
      current = { dir: t.dir, deg: t[key] || 0, end: t.end ?? t.start };
      groups.push(current);
    }
  }
  return groups.filter((g) => g.deg >= minDeg).map((g) => ({ dir: g.dir, deg: Math.round(g.deg) }));
}

/** The right turns in the pattern that count as mistakes, each with its total degrees. */
export function patternRightTurns(turns) {
  return sumTurns(turns, { dir: 1, key: 'patternDeg', ...RIGHT_TURN });
}

/** The sharp turns started below 300 ft (either way), each with its direction and total degrees. */
export function lowTurns(turns) {
  return sumTurns(turns, { dir: null, key: 'lowDeg', ...LOW_TURN });
}

export function landingGrade(distM) {
  return (LANDING_GRADES.find((g) => distM <= g.withinM) || { grade: 'missed' }).grade;
}

/**
 * @param {number|null} flareAltFt Where the flare held at touchdown started.
 * @param {boolean} [released] A flare was held but let go before touchdown.
 */
export function flareGrade(flareAltFt, released = false) {
  if (flareAltFt === null || flareAltFt === undefined) return released ? 'released' : 'none';
  if (flareAltFt > FLARE_WINDOW.highFt) return 'high';
  if (flareAltFt < FLARE_WINDOW.lowFt) return 'low';
  return 'good';
}

/**
 * @param {object} flight A landed flight from flight.js.
 * @returns {{points: Array<{name: string, targetFt: number, reached: boolean, distM: number|null, altFt: number|null}>,
 *   rightTurns: number, lowTurns: number, flare: string, flareAltFt: number|null, landing: {distM: number, grade: string}, clean: boolean}}
 *   rightTurns: right turns in the pattern (small corrections don't count, see RIGHT_TURN).
 *   lowTurns: sharp turns started below 300 ft (see LOW_TURN).
 *   clean: every point reached, no right turn in the pattern, no sharp turn low, flare on time.
 */
export function buildReport(flight) {
  const points = ['A', 'B', 'C'].map((name) => {
    const pass = flight.passes[name];
    return {
      name,
      targetFt: PATTERN.altitudesFt[name],
      reached: Boolean(pass) && pass.distM <= PATTERN.reachM,
      distM: pass ? Math.round(pass.distM) : null,
      altFt: pass ? Math.round(pass.altFt) : null,
    };
  });
  const rightTurns = patternRightTurns(flight.turns).length;
  const low = lowTurns(flight.turns).length;
  const flare = flareGrade(flight.flareAltFt, flight.flareReleased);
  const distM = flight.landing ? flight.landing.distM : Infinity;
  const landing = { distM: Math.round(distM), grade: landingGrade(distM) };
  return {
    points,
    rightTurns,
    lowTurns: low,
    flare,
    flareAltFt: flight.flareAltFt === null ? null : Math.round(flight.flareAltFt * 10) / 10,
    landing,
    clean: points.every((p) => p.reached) && rightTurns === 0 && low === 0 && flare === 'good',
  };
}
