/**
 * Freefall body-position rules.
 *
 * Pure functions only: no DOM access, no animation loop. A pose goes in,
 * its effects come out, and step() moves the jumper forward in time.
 * The effects follow standard AFF belly-flying teaching and are deliberately
 * simplified; tune the numbers in EFFECT if needed.
 */

/**
 * Every toggle button. Buttons in the same group are opposites, so only one
 * of them can be on at a time. value is the direction within the group.
 * legs: +1 stretched, -1 tucked. arms: +1 swept back, -1 reaching forward.
 * arch: +1 more arch, -1 flat. turn: +1 right shoulder down, -1 left.
 */
export const CONTROLS = Object.freeze([
  { id: 'legsStretch', group: 'legs', value: 1 },
  { id: 'legsTuck', group: 'legs', value: -1 },
  { id: 'armsForward', group: 'arms', value: -1 },
  { id: 'armsBack', group: 'arms', value: 1 },
  { id: 'archMore', group: 'arch', value: 1 },
  { id: 'archFlat', group: 'arch', value: -1 },
  { id: 'dipLeft', group: 'turn', value: -1 },
  { id: 'dipRight', group: 'turn', value: 1 },
]);

export const GROUPS = Object.freeze(['legs', 'arms', 'arch', 'turn']);

/** Box position: everything neutral. */
export const NEUTRAL = Object.freeze({ legs: 0, arms: 0, arch: 0, turn: 0 });

/** How strongly each group changes the flight. */
export const EFFECT = Object.freeze({
  /** Forward drift per unit of legs or arms (legs and arms add up; max 1). */
  driftPerLimb: 0.5,
  /**
   * Fall rate change, relative to 1 (neutral). Faster: more arch, or legs tucked with arms
   * pulled back (less body in the wind). Slower: a flat body, or legs stretched with arms
   * forward (more body in the wind). The limb combinations count the same as the arch.
   */
  fallFaster: 0.3,
  fallSlower: 0.25,
  /** Heading change in degrees per second with a shoulder down. */
  turnDegPerSecond: 90,
  /** How long the flight takes to settle into a new pose, in seconds. */
  settleSeconds: 0.6,
});

/**
 * Scene speeds, in scene units per second (the scene is 400 × 260).
 * The air must stay clearly faster than the jumper's own up/down movement, even in the
 * slowest position, or the body seems carried along by the air (a test checks this).
 */
export const SPEED = Object.freeze({
  /** Sideways drift at full drift (legs and arms both pushing). */
  drift: 60,
  /** Up/down movement per unit of fall rate away from neutral (arching more: 0.3 × 160 = 48). */
  fall: 160,
  /** The air rising past the jumper at the neutral fall rate, for the nearest dots. */
  air: 520,
  /**
   * The air never slows below this share of its neutral speed. Only the slowest position
   * (legs and arms stretched, de-arched: fall rate 0.5) reaches it; there the air stays
   * 40% faster than the fall rate alone would make it.
   */
  airMinRate: 0.7,
});

/** Air speed for a fall rate: follows the fall rate, but never below SPEED.airMinRate. */
export function airSpeed(fallRate) {
  return SPEED.air * Math.max(fallRate, SPEED.airMinRate);
}

/** Turn a control on, or off if it is already on. Its opposite turns off. */
export function toggle(pose, id) {
  const control = CONTROLS.find((c) => c.id === id);
  if (!control) throw new Error(`Unknown control "${id}".`);
  const current = pose[control.group];
  return { ...pose, [control.group]: current === control.value ? 0 : control.value };
}

/** Is this control on in the pose? */
export function isOn(pose, id) {
  const control = CONTROLS.find((c) => c.id === id);
  return Boolean(control) && pose[control.group] === control.value;
}

/**
 * Combinations with an extra explanation, most specific first; only the first match is shown.
 * Other controls may be on too.
 */
export const COMBOS = Object.freeze([
  { id: 'slowFall', controls: ['legsStretch', 'armsForward', 'archFlat'] },
  { id: 'moreArea', controls: ['legsStretch', 'armsForward'] },
]);

/** The combination note for a pose, or null. */
export function comboNote(pose) {
  return COMBOS.find((combo) => combo.controls.every((id) => isOn(pose, id)))?.id ?? null;
}

/** Ids of the controls that are on, in button order. */
export function activeControls(pose) {
  return CONTROLS.filter((c) => pose[c.group] === c.value).map((c) => c.id);
}

/**
 * What a pose does.
 * @returns {{drift: number, fallRate: number, turnRate: number, wobble: number}}
 *   drift: -1 (backward) to 1 (forward), along the jumper's heading.
 *   fallRate: relative to neutral (1). turnRate: degrees per second, + is right.
 *   wobble: 0 (stable) to 1 (rocking), only when flat.
 */
/** Legs stretched with arms forward: 1 when fully on (values may be in between while easing). */
const spreadOut = (pose) => Math.max(pose.legs, 0) * Math.max(-pose.arms, 0);
/** Legs tucked with arms pulled back. */
const tuckedIn = (pose) => Math.max(-pose.legs, 0) * Math.max(pose.arms, 0);

export function effects(pose) {
  return {
    drift: (pose.legs + pose.arms) * EFFECT.driftPerLimb,
    fallRate: 1 + pose.arch * (pose.arch > 0 ? EFFECT.fallFaster : EFFECT.fallSlower)
      - spreadOut(pose) * EFFECT.fallSlower
      + tuckedIn(pose) * EFFECT.fallFaster,
    turnRate: pose.turn * EFFECT.turnDegPerSecond,
    wobble: pose.arch < 0 ? 1 : 0,
  };
}

/** Words for how a pose moves the jumper (sideways, faster/slower fall, turn), as keys the view can translate. */
export function describe(pose) {
  const { drift, turnRate, fallRate } = effects(pose);
  const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  return {
    move: ['backward', 'still', 'forward'][sign(drift) + 1],
    // Any change of fall rate (arch, or legs and arms together) moves the jumper down or up the window.
    fall: ['slower', null, 'faster'][sign(fallRate - 1) + 1],
    turn: ['left', null, 'right'][sign(turnRate) + 1],
  };
}

/** Move value a toward b, settling in about `seconds`. */
function approach(a, b, dt, seconds) {
  return b + (a - b) * Math.exp(-dt / Math.max(seconds / 3, 1e-6));
}

/** Starting state: centered, heading screen-right, flying neutral. */
export function createState() {
  return { x: 0, y: 0, heading: 0, time: 0, flight: effects(NEUTRAL) };
}

/**
 * Advance the jumper by dt seconds. The flight eases toward the pose's
 * effects, so changes feel gradual rather than instant.
 * @param {object} state From createState() or a previous step().
 * @param {object} pose
 * @param {number} dt Seconds.
 * @param {number} [speed=1] Drift distance per second at full drift.
 * @param {number} [fallSpeed=0] Up/down distance per second per unit of fall rate away from neutral.
 * @returns {object} New state; x and y are the position in the side view (y grows downward).
 */
export function step(state, pose, dt, speed = 1, fallSpeed = 0) {
  const target = effects(pose);
  const flight = {};
  for (const key of Object.keys(target)) {
    flight[key] = approach(state.flight[key], target[key], dt, EFFECT.settleSeconds);
  }
  const heading = (state.heading + flight.turnRate * dt + 360) % 360;
  const along = Math.cos((heading * Math.PI) / 180);
  return {
    x: state.x + flight.drift * along * speed * dt,
    // Seen from a camera falling at the neutral rate: faster sinks (y grows downward), slower rises.
    y: (state.y ?? 0) + (flight.fallRate - 1) * fallSpeed * dt,
    heading,
    time: state.time + dt,
    flight,
  };
}
