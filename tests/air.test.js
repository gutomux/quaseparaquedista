import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDot, collide, stepDots, isDeflected } from '../js/freefall/air.js';
import { buildModel, projectModel, bodyCapsules } from '../js/freefall/figure.js';
import { NEUTRAL } from '../js/freefall/sim.js';

const bounds = { left: -200, top: -130, width: 400, height: 260 };
/** A flat bar, like a belly, 100 units wide at y = 0. */
const bar = [{ ax: -50, ay: 0, bx: 50, by: 0, r: 8 }];

/** One dot rising from below at x, flown for `seconds` against the body. */
function fly(body, x, seconds = 1, center = { x: 0, y: 0 }) {
  const dot = { x, y: 60, vx: 0, vy: -200, depth: 1, deflectedUntil: -1 };
  const dots = [dot];
  let lowest = Infinity;
  let closest = Infinity; // nearest the dot got to the first capsule's centerline
  let touched = false;
  const c0 = body[0];
  for (let t = 0; t < seconds; t += 0.01) {
    stepDots(dots, { dt: 0.01, time: t, speed: 200, body, center, bounds, random: () => 0.5 });
    if (dots[0] !== dot) break; // recycled at the top
    lowest = Math.min(lowest, dot.y);
    if (c0) {
      const t0 = Math.max(0, Math.min(1, ((dot.x - c0.ax) * (c0.bx - c0.ax) + (dot.y - c0.ay) * (c0.by - c0.ay)) / ((c0.bx - c0.ax) ** 2 + (c0.by - c0.ay) ** 2 || 1)));
      closest = Math.min(closest, Math.hypot(dot.x - (c0.ax + (c0.bx - c0.ax) * t0), dot.y - (c0.ay + (c0.by - c0.ay) * t0)));
    }
    touched ||= isDeflected(dot, t);
  }
  return { dot, lowest, closest, touched };
}

test('air: a dot rising under the body never passes through it', () => {
  for (const x of [-45, -10, 0, 10, 45]) {
    const { closest, touched } = fly(bar, x, 1.5);
    assert.ok(touched, `x = ${x}: the dot was marked as deflected`);
    assert.ok(closest >= 8 - 1e-6, `x = ${x}: the dot never went inside the body (got within ${closest.toFixed(2)} of its middle, thickness 8)`);
  }
});

test('air: a dot slides along the body toward the nearer edge and then rises again', () => {
  const right = fly(bar, 10, 1.5).dot;
  const left = fly(bar, -10, 1.5).dot;
  assert.ok(right.x > 50, `went past the right edge (x = ${right.x.toFixed(1)})`);
  assert.ok(left.x < -50, `went past the left edge (x = ${left.x.toFixed(1)})`);
  assert.ok(right.y < -8, 'and rose above the body once clear');
});

test('air: a slanted surface turns the air the way it slopes', () => {
  // Lower on the left, like legs angled down toward the back: the air slides off to the left.
  const slope = [{ ax: -50, ay: 20, bx: 50, by: -20, r: 6 }];
  const dot = { x: 0, y: 40, vx: 0, vy: -200, depth: 1, deflectedUntil: -1 };
  for (let i = 0; i < 20; i += 1) {
    dot.x += dot.vx * 0.01; dot.y += dot.vy * 0.01;
    collide(dot, slope, { x: 0, y: 0 }, 0);
  }
  assert.ok(dot.vx > 0, 'rising air hitting a surface that rises to the right slides to the right');
});

test('air: dots away from the body rise straight up, and leave the top to come back at the bottom', () => {
  const { dot } = fly(bar, 150, 0.2);
  assert.equal(dot.x, 150);
  assert.ok(dot.vy < 0 && Math.abs(dot.vx) < 1e-9);
  const dots = [{ x: 0, y: -129, vx: 0, vy: -200, depth: 1, deflectedUntil: -1 }];
  stepDots(dots, { dt: 0.02, time: 0, speed: 200, body: [], center: { x: 0, y: 0 }, bounds, random: () => 0.5 });
  assert.equal(dots[0].y, bounds.top + bounds.height, 'recycled at the bottom');
  assert.ok(createDot(bounds, () => 0.5).depth > 0);
});

test('air: the body the dots meet matches the drawn figure, with the figure\'s position and size', () => {
  const parts = projectModel(buildModel(NEUTRAL), { heading: 0 });
  const capsules = bodyCapsules(parts, { x: 30, size: 2 });
  const head = parts.head.points[0];
  assert.ok(capsules.some((c) => c.ax === 30 + head.x * 2 && c.ay === head.y * 2 && c.r === parts.head.r * 2), 'head circle placed and scaled');
  const spine = capsules.filter((c) => c.r === 11); // spine width 11, half = 5.5, times size 2
  assert.equal(spine.length, 6, 'the spine curve is followed in 6 pieces');
  const xs = capsules.flatMap((c) => [c.ax, c.bx]);
  assert.ok(Math.min(...xs) < 30 - 40 && Math.max(...xs) > 30 + 40, 'covers legs to head');
  const lowered = bodyCapsules(parts, { x: 30, y: 50, size: 2 });
  assert.ok(lowered.every((c, i) => c.ay === capsules[i].ay + 50), 'moves down with the figure');
});

test('air: fast air on a slow frame still cannot jump over a thin limb', () => {
  const thin = [{ ax: -40, ay: 0, bx: 40, by: 0, r: 3 }]; // about a forearm's half width on screen
  const dot = { x: 5, y: 20, vx: 0, vy: -800, depth: 1, deflectedUntil: -1 };
  const dots = [dot];
  stepDots(dots, { dt: 0.05, time: 0, speed: 800, body: thin, center: { x: 0, y: 0 }, bounds, random: () => 0.5 });
  assert.equal(dots[0], dot, 'not recycled');
  assert.ok(dot.y >= 3 - 1e-6 || Math.abs(dot.x) > 40, `stopped below the limb or went around its end (x ${dot.x.toFixed(1)}, y ${dot.y.toFixed(1)})`);
  assert.ok(isDeflected(dot, 0), 'it touched the limb');
});
