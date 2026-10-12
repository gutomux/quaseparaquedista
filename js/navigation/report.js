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

/** The right turns in the pattern that count as mistakes, each with its total degrees. */
export function patternRightTurns(turns) {
  const groups = [];
  let current = null;
  for (const t of turns) {
    if (t.dir <= 0) {
      current = null;
      continue;
    }
    if (current && t.start - current.end < RIGHT_TURN.mergeS) {
      current.deg += t.patternDeg || 0;
      current.end = t.end ?? t.start;
    } else {
      current = { deg: t.patternDeg || 0, end: t.end ?? t.start };
      groups.push(current);
    }
  }
  return groups.filter((g) => g.deg >= RIGHT_TURN.minDeg).map((g) => ({ deg: Math.round(g.deg) }));
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
 *   rightTurns: number, flare: string, flareAltFt: number|null, landing: {distM: number, grade: string}, clean: boolean}}
 *   rightTurns: right turns in the pattern (small corrections don't count, see RIGHT_TURN).
 *   clean: every point reached, no right turn in the pattern, flare on time.
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
  const flare = flareGrade(flight.flareAltFt, flight.flareReleased);
  const distM = flight.landing ? flight.landing.distM : Infinity;
  const landing = { distM: Math.round(distM), grade: landingGrade(distM) };
  return {
    points,
    rightTurns,
    flare,
    flareAltFt: flight.flareAltFt === null ? null : Math.round(flight.flareAltFt * 10) / 10,
    landing,
    clean: points.every((p) => p.reached) && rightTurns === 0 && flare === 'good',
  };
}
