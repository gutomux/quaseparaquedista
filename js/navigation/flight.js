/**
 * The canopy in flight: glide, wind, turns (held, like pulling a toggle), flare and landing.
 *
 * Pure functions on a plain state object (no page), so a whole flight can be run in a test.
 * Units: meters on the ground (x east, y north, target at 0,0), altitude in feet, compass headings.
 */
import { CANOPY, WIND_SPEED, FT, PATTERN, unit, distance, crosswindSpeed } from './pattern.js';

/** How the canopy turns and flares. */
export const FLIGHT = Object.freeze({
  /** Degrees per second while a turn is held, as seen on screen (a 90° turn takes 1.5 s). */
  turnRate: 60,
  /** Share of forward speed and of sink left while the flare is held. */
  flareSpeed: 0.45,
  flareSink: 0.25,
  /** How much faster the clock runs when the student picks the faster speed. */
  fastTimeScale: 4,
});

/**
 * A new flight from the run's start.
 * @param {object} run From pattern.newRun().
 * @param {object} points From pattern.patternPoints().
 */
export function createFlight(run, points) {
  return {
    x: run.start.x,
    y: run.start.y,
    altFt: run.start.altFt,
    heading: run.start.heading,
    /** True when the student picked the faster speed (the clock runs FLIGHT.fastTimeScale× faster). */
    fast: false,
    /** -1 while left is held, 1 while right is held, 0 flying straight. */
    turning: 0,
    windHeading: (run.setaHeading + 180) % 360, // the wind blows against the seta
    points,
    time: 0,
    landed: false,
    /** True while the flare is held. */
    flaring: false,
    /** Height where the current flare hold started (ft), while flaring. */
    flareStartFt: null,
    /** Set at touchdown: where the flare held at touchdown started, or null if none was held. */
    flareAltFt: null,
    /** Set at touchdown: true if a flare was held earlier but let go before touching down. */
    flareReleased: false,
    flaredOnce: false,
    /**
     * Every held turn: { dir: -1 left | 1 right, altFt (where it started), inPattern,
     * patternDeg (degrees turned at or below point A's altitude), lowDeg (degrees turned by a hold
     * started too low: below LOW_TURN_FT, or below C_TURN.lowestFt over point C), atC (started
     * over point C), start and end (flight time, s) }.
     * inPattern becomes true if the turn reaches point A's altitude while still held.
     */
    turns: [],
    /** Closest pass to each point while within ±tolerance of its altitude: { distM, altFt }. */
    passes: { A: null, B: null, C: null },
    landing: null,
    track: [{ x: run.start.x, y: run.start.y }],
  };
}

/**
 * A sharp turn started below this height (ft) is dangerous: the canopy dives, speeds up and can't
 * flare well. It is point C's altitude: the turn onto final starts there, and nothing after it.
 */
export const LOW_TURN_FT = 300;
/**
 * The turn onto final, started over point C (within `radiusM` of it), may start a little late:
 * down to `lowestFt` without counting as a low turn.
 */
export const C_TURN = Object.freeze({ lowestFt: 250, radiusM: 60 });

/**
 * Landing callouts (shown top right of the view), on final down to the flare:
 * each shown from its height (ft) down to the next one. A countdown runs into the flare.
 */
export const CALLOUTS = Object.freeze([
  { belowFt: 150, key: 'prepare' },
  { belowFt: 100, key: 'armsUp' },
  { belowFt: 70, key: 'wait' },
  { belowFt: 49, text: '3', count: true },
  { belowFt: 35, text: '2', count: true },
  { belowFt: 21, text: '1', count: true },
  { belowFt: 7, key: 'flare', flare: true },
]);
/** The callout for a height: the last one whose height has been reached, or null above 150 ft. */
export function calloutFor(altFt) {
  return CALLOUTS.filter((c) => altFt <= c.belowFt).pop() || null;
}

/** The pattern starts at point A's altitude; from then on, a right turn is a mistake. */
export const inPattern = (flight) => flight.altFt <= PATTERN.altitudesFt.A;

/** Clock speed: real time, or faster if the student picked it. */
export const timeScale = (flight) => (flight.fast ? FLIGHT.fastTimeScale : 1);

/** Pick the faster speed (true) or real time (false); it can change at any moment of the flight. */
export function setFast(flight, fast) {
  flight.fast = Boolean(fast);
  return flight;
}

/**
 * Hold a turn: -1 left, 1 right, 0 to let go and fly straight. Holding the same direction
 * again changes nothing; each new hold is recorded for the report.
 */
export function setTurn(flight, dir) {
  if (flight.landed || dir === flight.turning) return flight;
  const last = flight.turns[flight.turns.length - 1];
  if (flight.turning !== 0 && last) last.end = flight.time;
  flight.turning = dir;
  if (dir !== 0) flight.turns.push({ dir, altFt: Math.round(flight.altFt), inPattern: inPattern(flight), patternDeg: 0, lowDeg: 0, atC: distance(flight, flight.points.C) <= C_TURN.radiusM, start: flight.time, end: null });
  return flight;
}

/**
 * Hold (true) or let go of (false) the flare, like holding both toggles down. It only works
 * while held: for a good landing, press at about 6–7 ft and hold until touchdown.
 */
export function setFlare(flight, on) {
  if (flight.landed || on === flight.flaring) return flight;
  flight.flaring = on;
  flight.flareStartFt = on ? flight.altFt : null;
  if (on) flight.flaredOnce = true;
  return flight;
}

/** Move the flight forward by dt seconds of simulated time. */
export function step(flight, dt, { canopy = CANOPY, wind = WIND_SPEED } = {}) {
  if (flight.landed || dt <= 0) return flight;

  // Turn while a toggle is held. The rate is per real second, so turns feel the same when the
  // clock runs faster.
  if (flight.turning !== 0) {
    const deg = (FLIGHT.turnRate / timeScale(flight)) * dt;
    flight.heading = (flight.heading + flight.turning * deg + 360) % 360;
    const hold = flight.turns[flight.turns.length - 1];
    if (hold && inPattern(flight)) {
      hold.inPattern = true;
      hold.patternDeg += deg;
    }
    // Only turns started too low: below 300 ft, or below 250 ft for the turn onto final over
    // point C (it may start a little late, and ends a little lower).
    if (hold && hold.altFt < (hold.atC ? C_TURN.lowestFt : LOW_TURN_FT)) hold.lowDeg += deg;
  }

  const flared = flight.flaring;
  const airspeed = canopy.airspeed * (flared ? FLIGHT.flareSpeed : 1);
  const sink = (canopy.airspeed / canopy.glide) * (flared ? FLIGHT.flareSink : 1); // m/s
  const fwd = unit(flight.heading);
  const drift = unit(flight.windHeading);
  // The student corrects for the drift and holds the line the canopy points along (as taught for
  // a crosswind): the sideways part of the wind is cancelled by angling slightly into it, and the
  // wind along the line speeds the canopy up or slows it down.
  const along = wind * (fwd.x * drift.x + fwd.y * drift.y);
  const across = wind * (fwd.x * drift.y - fwd.y * drift.x);
  const ground = crosswindSpeed(airspeed, across) + along;
  flight.x += fwd.x * ground * dt;
  flight.y += fwd.y * ground * dt;
  flight.altFt = Math.max(0, flight.altFt - (sink * dt) / FT);
  flight.time += dt;

  // Closest pass to each point while within its altitude window.
  for (const name of ['A', 'B', 'C']) {
    const target = PATTERN.altitudesFt[name];
    if (Math.abs(flight.altFt - target) > PATTERN.toleranceFt) continue;
    const distM = distance(flight, flight.points[name]);
    const best = flight.passes[name];
    if (!best || distM < best.distM) flight.passes[name] = { distM, altFt: flight.altFt };
  }

  const last = flight.track[flight.track.length - 1];
  if (distance(last, flight) > 8) flight.track.push({ x: flight.x, y: flight.y });

  if (flight.altFt <= 0) {
    flight.landed = true;
    const hold = flight.turns[flight.turns.length - 1];
    if (flight.turning !== 0 && hold) hold.end = flight.time;
    flight.landing = { x: flight.x, y: flight.y, distM: distance(flight, flight.points.X) };
    // The flare that counts is the one held at touchdown.
    flight.flareAltFt = flight.flaring ? flight.flareStartFt : null;
    flight.flareReleased = !flight.flaring && flight.flaredOnce;
  }
  return flight;
}
