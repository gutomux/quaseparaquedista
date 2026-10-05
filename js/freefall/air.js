/**
 * Air dots that flow around the jumper instead of passing through.
 *
 * Pure functions only, so the flow can be tested in Node. The body is a list of
 * "capsules" (line segments with a thickness, a circle being a segment of length 0)
 * in scene units. A dot that reaches a capsule is pushed back to its surface and
 * slides along it, then eases back into the free upward flow once clear.
 */

/** How quickly a dot returns to the free flow after leaving the body, in seconds. */
const RELAX_SECONDS = 0.35;
/** How long a dot stays marked as deflected after touching the body, in seconds. */
const MARK_SECONDS = 0.7;
/** Sliding speed along the body, as a share of the oncoming air's speed. */
const SLIDE_SHARE = 0.9;

/** Longest distance a dot moves in one collision step; less than the thinnest limb, so none is skipped. */
const MAX_STEP = 4;

/**
 * Share of the free-flow speed for a dot at this depth (0.35 far to 1 near): 70% to 100%.
 * Far dots are a little slower for a sense of depth, but every dot stays fast.
 */
export function flowShare(depth) {
  return 0.7 + (0.3 * (depth - 0.35)) / 0.65;
}

/** Closest point to p on segment a-b. */
function closestOnSegment(px, py, s) {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2));
  return { x: s.ax + dx * t, y: s.ay + dy * t };
}

/** A new dot somewhere in the scene, moving with the free flow. */
export function createDot(bounds, random = Math.random, anywhere = true) {
  const depth = 0.35 + random() * 0.65; // nearer dots are bigger and faster
  return {
    x: bounds.left + random() * bounds.width,
    y: anywhere ? bounds.top + random() * bounds.height : bounds.top + bounds.height,
    vx: 0,
    vy: 0,
    depth,
    deflectedUntil: -1,
  };
}

/**
 * Push a dot out of the body and turn its velocity along the surface.
 * @param {object} dot Mutated in place.
 * @param {Array<{ax:number, ay:number, bx:number, by:number, r:number}>} body Capsules.
 * @param {{x:number, y:number}} center The body's middle, to pick a side when a dot hits head-on.
 * @param {number} time Seconds, to mark the dot as deflected.
 * @param {number} [flowSpeed] Speed of the oncoming air; the dot slides on at most of it,
 *   since the air behind keeps pushing it along the surface. Defaults to the dot's own speed.
 * @returns {boolean} Whether the dot touched the body.
 */
export function collide(dot, body, center, time, flowSpeed) {
  let hit = null;
  let deepest = 0;
  for (const capsule of body) {
    const c = closestOnSegment(dot.x, dot.y, capsule);
    const dx = dot.x - c.x;
    const dy = dot.y - c.y;
    const dist = Math.hypot(dx, dy);
    const overlap = capsule.r - dist;
    if (overlap > deepest) {
      deepest = overlap;
      // Exactly on the centerline: push down, toward the oncoming air.
      hit = dist > 1e-6 ? { c, nx: dx / dist, ny: dy / dist, r: capsule.r } : { c, nx: 0, ny: 1, r: capsule.r };
    }
  }
  if (!hit) return false;

  const { c, nx, ny, r } = hit;
  dot.x = c.x + nx * r;
  dot.y = c.y + ny * r;

  const speed = Math.hypot(dot.vx, dot.vy);
  const into = dot.vx * nx + dot.vy * ny;
  if (into < 0) {
    // Remove the part of the motion going into the surface; keep the part along it.
    let tx = dot.vx - into * nx;
    let ty = dot.vy - into * ny;
    let along = Math.hypot(tx, ty);
    if (along < speed * 0.05) {
      // Head-on: slide toward the nearer edge of the body.
      const side = dot.x >= center.x ? 1 : -1;
      tx = -ny * side;
      ty = nx * side;
      if (tx * side < 0) { tx = -tx; ty = -ty; }
      along = Math.hypot(tx, ty) || 1;
    }
    const slide = Math.max(flowSpeed ?? speed, speed) * SLIDE_SHARE;
    dot.vx = (tx / along) * slide;
    dot.vy = (ty / along) * slide;
  }
  dot.deflectedUntil = time + MARK_SECONDS;
  return true;
}

/**
 * Move every dot one step: ease toward the free flow, move, collide, and recycle
 * dots that leave the scene at the bottom.
 * @param {object[]} dots From createDot(); mutated in place.
 * @param {object} options
 * @param {number} options.dt Seconds.
 * @param {number} options.time Seconds since the start.
 * @param {number} options.speed Free-flow speed (scene units per second) for the nearest dots.
 * @param {object[]} options.body Capsules, see collide().
 * @param {{x:number, y:number}} options.center
 * @param {{left:number, top:number, width:number, height:number}} options.bounds
 * @param {() => number} [options.random]
 */
export function stepDots(dots, { dt, time, speed, body, center, bounds, random = Math.random }) {
  if (dt <= 0) return;
  // Fast air could jump over a thin arm in one frame, so move in small steps.
  const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
  const h = dt / steps;
  const k = 1 - Math.exp(-h / RELAX_SECONDS);
  for (let i = 0; i < dots.length; i += 1) {
    let dot = dots[i];
    for (let s = 0; s < steps; s += 1) {
      const freeVy = -speed * flowShare(dot.depth); // the air rises past a falling jumper
      dot.vx += (0 - dot.vx) * k;
      dot.vy += (freeVy - dot.vy) * k;
      if (dot.vx === 0 && dot.vy === 0) dot.vy = freeVy;
      dot.x += dot.vx * h;
      dot.y += dot.vy * h;
      collide(dot, body, center, time, -freeVy);

      const out = dot.y < bounds.top || dot.x < bounds.left - 10 || dot.x > bounds.left + bounds.width + 10;
      if (out) {
        dot = createDot(bounds, random, false);
        dot.vy = -speed * flowShare(dot.depth);
        dots[i] = dot;
        break;
      }
    }
  }
}

/** Whether a dot should be shown as deflected. */
export const isDeflected = (dot, time) => dot.deflectedUntil > time;
