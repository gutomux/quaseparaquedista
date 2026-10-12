/**
 * The landing pattern as CBPq teaches it, worked out for a given seta direction.
 *
 * Pure functions only (no page), so they can be tested. Positions are in meters on the ground,
 * x to the east and y to the north, with the target X at (0, 0). Headings are compass degrees
 * (0 = north, 90 = east).
 *
 * The seta points the landing direction, into the wind. The holding area is upwind, in the
 * direction the seta points. Every turn in the pattern is to the left:
 *   A (1000 ft) → downwind leg → B (600 ft) → left turn, base leg → C (300 ft) → left turn,
 *   final into the wind → X.
 * The points come from the flight itself (canopy speed, glide ratio, wind), so a student who
 * flies the pattern perfectly passes over each point at its altitude and lands on X. The legs
 * always meet at 90°: across the wind (the base leg) the canopy corrects for the drift and holds
 * its track (see flight.js), as students are taught.
 */

export const FT = 0.3048;

/** A typical student canopy, and the wind every run uses. */
export const CANOPY = Object.freeze({
  /** Forward speed through the air, m/s (32 km/h). */
  airspeed: 32 / 3.6,
  /** Feet forward for each foot down, in calm air. */
  glide: 3.2,
});
export const WIND_SPEED = 10 / 3.6; // 10 km/h, in m/s

/** The pattern's rules. */
export const PATTERN = Object.freeze({
  altitudesFt: Object.freeze({ A: 1000, B: 600, C: 300 }),
  /** A point counts as reached within this many feet of its altitude... */
  toleranceFt: 100,
  /** ...and within this many meters of it, horizontally. */
  reachM: 30,
  /**
   * The holding area: a rounded, irregular area on the seta's line, beyond the target in the
   * direction the seta points, its center this far upwind of point A. `across` is its width
   * across the landing line, `along` its depth along it (before the irregular edge).
   */
  holdingOffsetM: 300,
  holdingSize: Object.freeze({ across: 480, along: 320 }),
  /**
   * The holding area (and every holding area offered while planning) stays at least this far
   * outside the landing area, so it never covers the seta or the landing area on the map. Where
   * the usual offset isn't enough (diagonal setas, near the landing area's corners), it moves
   * further out.
   */
  holdingClearanceM: 60,
});

/**
 * The landing area: a square centered on the target, big enough that points A, B and C lie over
 * it for any seta (each at least PATTERN.reachM inside its edge).
 */
export const LANDING_AREA = Object.freeze({ halfSize: 490 });

/**
 * Ground speed across the wind when correcting for the drift: the canopy angles slightly into the
 * wind so its track stays straight, which costs a little speed over the ground.
 */
export function crosswindSpeed(airspeed, wind) {
  return Math.sqrt(Math.max(airspeed * airspeed - wind * wind, 0));
}

/** Unit vector for a compass heading. */
export function unit(headingDeg) {
  const r = (headingDeg * Math.PI) / 180;
  return { x: Math.sin(r), y: Math.cos(r) };
}

const along = (p, dir, meters) => ({ x: p.x + dir.x * meters, y: p.y + dir.y * meters });
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** Compass heading from a to b. */
export function headingTo(a, b) {
  return ((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360) % 360;
}

/**
 * Where everything is for a seta pointing at `setaHeading`.
 * @returns {{X, C, B, A, H, legs: {downwind: number, base: number, final: number}}}
 */
export function patternPoints(setaHeading, { canopy = CANOPY, wind = WIND_SPEED } = {}) {
  const seta = unit(setaHeading);
  const left = unit(setaHeading - 90); // the side of the pattern, to the lander's left
  const sink = canopy.airspeed / canopy.glide; // m/s
  const seconds = (feet) => (feet * FT) / sink;
  const { A: altA, B: altB, C: altC } = PATTERN.altitudesFt;

  const legs = {
    downwind: (canopy.airspeed + wind) * seconds(altA - altB), // the wind helps
    base: crosswindSpeed(canopy.airspeed, wind) * seconds(altB - altC), // across the wind, holding the track
    final: (canopy.airspeed - wind) * seconds(altC), // into the wind
  };
  const X = { x: 0, y: 0 };
  const C = along(X, seta, -legs.final);
  const B = along(C, left, legs.base);
  const A = along(B, seta, legs.downwind);
  // On the seta's line, beyond the target where the seta points (not off to A's side), and far
  // enough that neither it nor the other options offered at its distance cover the landing area.
  let reach = A.x * seta.x + A.y * seta.y + PATTERN.holdingOffsetM;
  while (!holdingClear(setaHeading, reach)) reach += 10;
  const H = along(X, seta, reach);
  return { X, C, B, A, H, legs };
}

/* ---------- Planning: choosing each point from a few options ---------- */

/** The holding area's edge can reach this share beyond its basic oval. */
export const HOLDING_WOBBLE = 0.16;

/**
 * The holding area's outline: a wide oval centered on `center`, its depth along `axisHeading`
 * (away from the target), with a gently irregular edge. The irregularity comes from the
 * center's position, so each area has its own shape and keeps it between frames.
 */
export function holdingShape(center, axisHeading, points = 40) {
  const f = unit(axisHeading);
  const r = unit(axisHeading + 90);
  const { across, along: depth } = PATTERN.holdingSize;
  const seed = Math.abs(Math.sin(center.x * 12.9898 + center.y * 78.233) * 43758.5453);
  const p1 = (seed % 1) * Math.PI * 2;
  const p2 = ((seed * 7.13) % 1) * Math.PI * 2;
  const p3 = ((seed * 3.71) % 1) * Math.PI * 2;
  return Array.from({ length: points }, (_, i) => {
    const t = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.08 * Math.sin(2 * t + p1) + 0.05 * Math.sin(3 * t + p2) + 0.03 * Math.sin(5 * t + p3);
    const a = Math.cos(t) * (depth / 2) * wobble;
    const b = Math.sin(t) * (across / 2) * wobble;
    return { x: center.x + f.x * a + r.x * b, y: center.y + f.y * a + r.y * b };
  });
}

/** How far a point is outside the landing area (0 if over it). */
export function outsideLanding({ x, y }) {
  const h = LANDING_AREA.halfSize;
  return Math.hypot(Math.max(Math.abs(x) - h, 0), Math.max(Math.abs(y) - h, 0));
}

/** Directions of the holding areas offered while planning, relative to the seta. */
export const HOLDING_OPTION_ANGLES = Object.freeze([0, 90, 180, -90]);

/** True if holding areas `radius` m from the target, in every option's direction, clear the landing area. */
function holdingClear(setaHeading, radius) {
  return HOLDING_OPTION_ANGLES.every((deg) => {
    const d = unit(setaHeading + deg);
    const center = { x: d.x * radius, y: d.y * radius };
    return holdingShape(center, setaHeading + deg).every((q) => outsideLanding(q) >= PATTERN.holdingClearanceM);
  });
}

/** The points the student places, in order. X is shown on the ground. */
export const PLAN_STEPS = Object.freeze(['H', 'A', 'B', 'C']);

/** Mirror a point to the other side of the landing line (a right-hand pattern). */
function otherSide(p, setaHeading) {
  const left = unit(setaHeading - 90);
  const d = p.x * left.x + p.y * left.y;
  return { x: p.x - 2 * d * left.x, y: p.y - 2 * d * left.y };
}
/** Mirror a point to the other end of the landing line (downwind instead of upwind). */
function otherEnd(p, setaHeading) {
  const seta = unit(setaHeading);
  const d = p.x * seta.x + p.y * seta.y;
  return { x: p.x - 2 * d * seta.x, y: p.y - 2 * d * seta.y };
}

/** Fisher-Yates shuffle with an injectable random source. */
function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The options offered for one step: the right position and typical mistakes, shuffled.
 * Each wrong option names its mistake, so the page can show a hint that teaches.
 * @returns {Array<{pos: {x: number, y: number}, correct: boolean, mistake: string|null}>}
 *   mistake: 'downwind' (the wrong end), 'rightSide' (a right-hand pattern), 'both', or
 *   for C, 'pastTarget' (final flown with the wind) or 'cRight', or for the holding area,
 *   'holdingSide' (not in the direction the seta points).
 */
export function planOptions(points, step, setaHeading, random = Math.random) {
  const p = points[step];
  let options;
  if (step === 'H') {
    // Four areas around the target at the same distance: in the seta's direction (the right
    // one, on its line), to its right, to its left and behind it.
    const radius = Math.hypot(p.x, p.y);
    const at = (deg) => { const d = unit(setaHeading + deg); return { x: d.x * radius, y: d.y * radius }; };
    options = [
      { pos: p, correct: true, mistake: null },
      { pos: at(90), correct: false, mistake: 'holdingSide' },
      { pos: at(180), correct: false, mistake: 'downwind' },
      { pos: at(-90), correct: false, mistake: 'holdingSide' },
    ];
  } else if (step === 'C') {
    // C lies on the landing line, so mirroring it sideways would land on itself.
    const left = unit(setaHeading - 90);
    options = [
      { pos: p, correct: true, mistake: null },
      { pos: { x: -p.x, y: -p.y }, correct: false, mistake: 'pastTarget' },
      { pos: along(p, left, -points.legs.base * 0.8), correct: false, mistake: 'cRight' },
    ];
  } else {
    options = [
      { pos: p, correct: true, mistake: null },
      { pos: otherEnd(p, setaHeading), correct: false, mistake: 'downwind' },
      { pos: otherSide(p, setaHeading), correct: false, mistake: 'rightSide' },
      { pos: otherSide(otherEnd(p, setaHeading), setaHeading), correct: false, mistake: 'both' },
    ];
  }
  return shuffle(options, random);
}

/* ---------- A new run ---------- */

/** Where the holding area can be, seen from the student at the opening: ahead, ahead-left/right, left or right. */
export const START = Object.freeze({
  bearings: Object.freeze([0, -45, 45, -90, 90]),
  minM: 330,
  maxM: 450,
});

/**
 * A new run: the seta points one of 8 compass directions, and the student opens the canopy at 3000 ft close to
 * the holding area, with it ahead or to one side (never behind), at a different spot each time.
 * The student faces along one of the pattern's directions (each tap turns 90°, so they can line
 * up with every leg).
 */
export function newRun(random = Math.random) {
  // The seta points one of 8 ways: N, NE, E, SE, S, SW, W or NW.
  const setaHeading = 45 * Math.floor(random() * 8);
  const { H } = patternPoints(setaHeading);
  const heading = (setaHeading + 90 * Math.floor(random() * 4)) % 360;
  const relative = START.bearings[Math.floor(random() * START.bearings.length)];
  const away = START.minM + random() * (START.maxM - START.minM);
  const toHolding = unit(heading + relative);
  return {
    setaHeading,
    start: { x: H.x - toHolding.x * away, y: H.y - toHolding.y * away, altFt: 3000, heading },
  };
}
