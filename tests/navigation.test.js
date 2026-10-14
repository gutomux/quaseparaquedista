import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  patternPoints, planOptions, newRun, PLAN_STEPS, PATTERN, START, HOLDING_WOBBLE, holdingShape, unit, distance, headingTo, outsideLanding, HOLDING_OPTION_ANGLES,
} from '../js/navigation/pattern.js';
import { createFlight, step, setTurn, setFlare, setFast, inPattern, timeScale } from '../js/navigation/flight.js';
import { buildReport, landingGrade, flareGrade, patternRightTurns, lowTurns } from '../js/navigation/report.js';
import { buildDropzone } from '../js/navigation/dropzone.js';

const dot = (a, b) => a.x * b.x + a.y * b.y;
/** A seeded random source, so runs are repeatable. */
function seeded(seed = 1) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/**
 * Fly the pattern like a perfect student: start over A at 1000 ft heading downwind, hold a left
 * turn for 90° when reaching 600 ft (B) and 300 ft (C), flare at 7 ft.
 */
function flyPerfectPattern(setaHeading, leadFt = 0) {
  const points = patternPoints(setaHeading);
  const run = { setaHeading, start: { ...points.A, altFt: 1000, heading: (setaHeading + 180) % 360 } };
  const flight = createFlight(run, points);
  const turnsAt = [600 + leadFt, 300 + leadFt];
  let turned = 0; // degrees turned in the current held turn
  while (!flight.landed) {
    const before = flight.heading;
    step(flight, 0.02);
    if (flight.turning) {
      turned += Math.abs(((flight.heading - before + 540) % 360) - 180);
      if (turned >= 90) setTurn(flight, 0);
    } else if (turnsAt.length && flight.altFt <= turnsAt[0]) {
      turnsAt.shift();
      turned = 0;
      setTurn(flight, -1);
    }
    if (flight.altFt <= 7) setFlare(flight, true);
  }
  return { flight, points };
}

test('pattern: with the seta pointing east, it is the shape CBPq teaches', () => {
  const p = patternPoints(90);
  // X at the target; C west of it (final flown east, into the wind); B north of C; A east of B.
  assert.ok(p.C.x < -100 && Math.abs(p.C.y) < 1, 'C is downwind of the target, on the landing line');
  assert.ok(p.B.y > 200, 'B is on the left of the landing line (north, for a lander heading east)');
  assert.ok(p.A.x > p.B.x + 300 && Math.abs(p.A.y - p.B.y) < 1, 'A is upwind of B, on the same side');
  assert.ok(p.H.x > p.A.x, 'the holding area is further upwind, where the seta points');
});

test('pattern: the legs run downwind, across, then into the wind, with left turns', () => {
  const seta = 37; // any direction
  const p = patternPoints(seta);
  const s = unit(seta);
  const downwind = headingTo(p.A, p.B);
  const final = headingTo(p.C, p.X);
  assert.ok(Math.abs(((downwind - (seta + 180)) % 360 + 360) % 360) < 1, 'A to B flies with the wind');
  assert.ok(Math.abs(((final - seta) % 360 + 360) % 360) < 1, 'C to X flies into the wind');
  assert.ok(dot(p.H, s) > dot(p.A, s), 'holding area upwind of A');
});

test('pattern: A, B, C and X always meet at 90°', () => {
  for (const seta of [0, 37, 90, 213, 301]) {
    const p = patternPoints(seta);
    const s = unit(seta);
    const dir = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };
    const ab = dir(p.A, p.B);
    const bc = dir(p.B, p.C);
    const cx = dir(p.C, p.X);
    assert.ok(Math.abs(Math.abs(dot(ab, s)) - 1) < 1e-9, `seta ${seta}: A–B along the landing line`);
    assert.ok(Math.abs(dot(ab, bc)) < 1e-9, `seta ${seta}: 90° at B`);
    assert.ok(Math.abs(dot(bc, cx)) < 1e-9, `seta ${seta}: 90° at C`);
  }
});

test('flare: it only works while held, and the one held at touchdown counts', () => {
  const points = patternPoints(0);
  const fly = (actions) => {
    const flight = createFlight({ setaHeading: 0, start: { x: 0, y: -100, altFt: 30, heading: 0 } }, points);
    while (!flight.landed) { step(flight, 0.02); actions(flight); }
    return buildReport(flight);
  };
  assert.equal(fly((f) => { if (f.altFt <= 7) setFlare(f, true); }).flare, 'good', 'pressed at 7 ft and held');
  assert.equal(fly((f) => { if (f.altFt <= 7) setFlare(f, true); if (f.altFt <= 3) setFlare(f, false); }).flare, 'released', 'let go before touchdown');
  assert.equal(fly((f) => { if (f.altFt <= 20) setFlare(f, true); }).flare, 'high', 'held from 20 ft');
  assert.equal(fly(() => {}).flare, 'none');
  // Letting go restores the normal sink rate.
  const flight = createFlight({ setaHeading: 0, start: { x: 0, y: 0, altFt: 50, heading: 0 } }, points);
  setFlare(flight, true); step(flight, 1); const held = 50 - flight.altFt;
  setFlare(flight, false); const before = flight.altFt; step(flight, 1);
  assert.ok(before - flight.altFt > held * 2, 'without the flare the canopy sinks faster again');
});

test('flight: at the faster speed the clock runs faster but turns feel the same on screen', () => {
  const flight = setFast(createFlight({ setaHeading: 0, start: { x: 0, y: 0, altFt: 2500, heading: 0 } }, patternPoints(0)), true);
  setTurn(flight, 1);
  step(flight, 1 * timeScale(flight)); // one real second, at 4× clock
  assert.equal(Math.round(flight.heading), 60);
});

test('flight: across the wind the canopy holds its track (drift corrected)', () => {
  const points = patternPoints(0); // seta north: wind blows south
  const flight = createFlight({ setaHeading: 0, start: { x: 0, y: 0, altFt: 2000, heading: 90 } }, points);
  for (let i = 0; i < 100; i += 1) step(flight, 0.05);
  assert.ok(Math.abs(flight.y) < 1e-6, 'flying east across a north–south wind stays on its line');
  assert.ok(flight.x > 0);
});

test('flight: a perfectly flown pattern reaches every point and lands on target', () => {
  for (const seta of [0, 90, 213]) {
    const { flight } = flyPerfectPattern(seta);
    const report = buildReport(flight);
    for (const p of report.points) assert.ok(p.reached, `seta ${seta}: point ${p.name} reached (${p.distM} m at ${p.altFt} ft)`);
    assert.equal(report.rightTurns, 0);
    assert.equal(report.flare, 'good');
    assert.ok(report.landing.distM <= 20, `seta ${seta}: landed ${report.landing.distM} m from X`);
  }
});

test('flight: a right turn after point A is counted, one in the holding area is not', () => {
  const points = patternPoints(0);
  const flight = createFlight({ setaHeading: 0, start: { x: 0, y: 900, altFt: 1300, heading: 0 } }, points);
  setTurn(flight, 1); // holding area: fine
  step(flight, 0.5);
  setTurn(flight, 0);
  while (!inPattern(flight)) step(flight, 0.05);
  setTurn(flight, 1); // in the pattern, a full 90°: a mistake
  for (let i = 0; i < 30; i += 1) step(flight, 0.05);
  setTurn(flight, -1);
  step(flight, 0.5);
  setTurn(flight, 0);
  while (!flight.landed) step(flight, 0.05);
  assert.equal(buildReport(flight).rightTurns, 1);
});

test('flight: a right turn held from the holding area into the pattern counts', () => {
  const flight = createFlight({ setaHeading: 0, start: { x: 0, y: 900, altFt: 1005, heading: 0 } }, patternPoints(0));
  setTurn(flight, 1);
  while (flight.altFt > 960) step(flight, 0.05);
  setTurn(flight, 0);
  while (!flight.landed) step(flight, 0.05);
  assert.equal(buildReport(flight).rightTurns, 1);
});

test('flight: small right corrections in the pattern are not mistakes, a 90° turn in taps is', () => {
  const run = { setaHeading: 0, start: { x: 0, y: 900, altFt: 900, heading: 0 } };
  const tap = (flight, seconds) => {
    setTurn(flight, 1);
    for (let i = 0; i < Math.round(seconds / 0.05); i += 1) step(flight, 0.05);
    setTurn(flight, 0);
  };
  const straight = (flight, seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i += 1) step(flight, 0.05); };
  // Three 15° corrections, well apart.
  const fine = createFlight(run, patternPoints(0));
  for (let i = 0; i < 3; i += 1) { tap(fine, 0.25); straight(fine, 4); }
  assert.deepEqual(patternRightTurns(fine.turns), []);
  // Three 30° taps in a row: a 90° turn to the right.
  const turn = createFlight(run, patternPoints(0));
  for (let i = 0; i < 3; i += 1) { tap(turn, 0.5); straight(turn, 0.5); }
  const found = patternRightTurns(turn.turns);
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0].deg - 90) < 4);
});

test('flight: holding a turn turns at 60° per second, letting go flies straight; the flare slows it', () => {
  const points = patternPoints(0); // seta north: wind blows south
  const flight = createFlight({ setaHeading: 0, start: { x: 0, y: 0, altFt: 1000, heading: 90 } }, points);
  setTurn(flight, -1);
  for (let i = 0; i < 30; i += 1) step(flight, 0.05); // 1.5 s held
  setTurn(flight, 0);
  for (let i = 0; i < 70; i += 1) step(flight, 0.05);
  assert.equal(Math.round(flight.heading), 0, 'a 1.5 s left hold from east is north, and it stays there');
  const before = { ...flight };
  for (let i = 0; i < 20; i += 1) step(flight, 0.05);
  const climb = flight.y - before.y;
  const sinkNormal = before.altFt - flight.altFt;
  setFlare(flight, true);
  const afterFlare = { ...flight };
  for (let i = 0; i < 20; i += 1) step(flight, 0.05);
  assert.ok(climb > 0 && climb < 1 * 8.9, 'flying north into a south-blowing wind: slower over the ground');
  assert.ok(afterFlare.altFt - flight.altFt < sinkNormal / 2, 'the flare cuts the sink rate');
});

test('flight: real time unless the student picks the faster speed, at any altitude', () => {
  const flight = createFlight({ setaHeading: 0, start: { x: 0, y: 0, altFt: 3000, heading: 0 } }, patternPoints(0));
  assert.equal(timeScale(flight), 1, 'regular speed by default, even high up');
  setFast(flight, true);
  assert.equal(timeScale(flight), 4);
  flight.altFt = 300;
  assert.equal(timeScale(flight), 4, 'still faster near the ground, until switched back');
  setFast(flight, false);
  assert.equal(timeScale(flight), 1);
});

test('report: landing and flare grades follow the agreed scale', () => {
  assert.equal(landingGrade(4), 'legendary');
  assert.equal(landingGrade(9), 'great');
  assert.equal(landingGrade(18), 'goal');
  assert.equal(landingGrade(40), 'missed');
  assert.equal(flareGrade(null), 'none');
  assert.equal(flareGrade(12), 'high');
  assert.equal(flareGrade(6.5), 'good');
  assert.equal(flareGrade(2), 'low');
  assert.equal(flareGrade(null, true), 'released');
});

test('planning: one right option per step among 3-4, each wrong one naming its mistake', () => {
  const random = seeded(7);
  for (let i = 0; i < 20; i += 1) {
    const run = newRun(random);
    const points = patternPoints(run.setaHeading);
    for (const stepName of PLAN_STEPS) {
      const options = planOptions(points, stepName, run.setaHeading, random);
      assert.ok(options.length >= 3 && options.length <= 4);
      assert.equal(options.filter((o) => o.correct).length, 1);
      assert.ok(options.filter((o) => !o.correct).every((o) => o.mistake));
      const minGap = Math.min(...options.flatMap((a, ai) => options.slice(ai + 1).map((b) => distance(a.pos, b.pos))));
      assert.ok(minGap > 60, `${stepName}: options are clearly apart (${Math.round(minGap)} m)`);
      if (stepName === 'H') assert.ok(minGap > PATTERN.holdingSize.across * (1 + HOLDING_WOBBLE) + 20, `holding area options don't overlap (${Math.round(minGap)} m apart)`);
    }
  }
});

test('holding areas: wide, rounded and each a little different', () => {
  const a = holdingShape({ x: 0, y: 600 }, 0);
  const b = holdingShape({ x: 600, y: 0 }, 90);
  const radii = (shape, c) => shape.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  const ra = radii(a, { x: 0, y: 600 });
  assert.ok(a.length >= 24, 'a smooth, rounded outline');
  assert.ok(Math.max(...ra) <= (PATTERN.holdingSize.across / 2) * (1 + HOLDING_WOBBLE), 'stays within its size');
  assert.ok(Math.min(...ra) >= (PATTERN.holdingSize.along / 2) * (1 - HOLDING_WOBBLE), 'no deep dents');
  const shapeOf = (r) => r.map((v) => Math.round(v));
  assert.notDeepEqual(shapeOf(ra), shapeOf(radii(b, { x: 600, y: 0 })), 'two areas have different outlines');
  assert.deepEqual(holdingShape({ x: 0, y: 600 }, 0), a, 'the same area keeps its shape');
});

test('runs: open close to the holding area, with it ahead or to a side, never behind', () => {
  const random = seeded(3);
  const runs = Array.from({ length: 30 }, () => newRun(random));
  const setas = new Set(runs.map((r) => r.setaHeading));
  assert.ok([...setas].every((h) => h % 45 === 0 && h >= 0 && h < 360), 'the seta points N, NE, E, SE, S, SW, W or NW');
  assert.ok(setas.size >= 6, `the seta points different ways (${[...setas].sort((a, b) => a - b).join(', ')})`);
  const sides = new Set();
  for (const run of runs) {
    const { H } = patternPoints(run.setaHeading);
    const away = distance(run.start, H);
    assert.equal(run.start.altFt, 3000);
    assert.ok(away >= START.minM - 1e-6 && away <= START.maxM + 1e-6, `${Math.round(away)} m from the holding area`);
    const relative = ((headingTo(run.start, H) - run.start.heading + 540) % 360) - 180;
    assert.ok(Math.abs(relative) <= 90 + 1e-6, `holding area at ${Math.round(relative)}° from the nose`);
    sides.add(Math.round(relative));
    assert.equal(((run.start.heading - run.setaHeading) % 90 + 90) % 90, 0, 'taps of 90° can line up with every leg');
  }
  assert.ok(sides.size >= 4, 'the holding area shows up in different places: ahead, to the sides');
});

test('pattern: the holding area is on the seta\'s line, beyond the target where the seta points', () => {
  for (const seta of [0, 90, 213, 301]) {
    const { H } = patternPoints(seta);
    const s = unit(seta);
    const along = dot(H, s);
    assert.ok(along > 550, `seta ${seta}: well upwind of the target (${Math.round(along)} m)`);
    assert.ok(Math.abs(H.x * s.y - H.y * s.x) < 1e-6, `seta ${seta}: on the seta's line`);
  }
});

test('planning: the four holding areas are ahead of the seta, to its right, to its left and behind it', () => {
  const run = { setaHeading: 270 }; // seta pointing west
  const points = patternPoints(run.setaHeading);
  const options = planOptions(points, 'H', run.setaHeading, seeded(5));
  const where = Object.fromEntries(options.map((o) => [o.correct ? 'right' : o.mistake + Math.sign(o.pos.y), o.pos]));
  assert.ok(where.right.x < -300 && Math.abs(where.right.y) < 1e-6, 'the right answer is straight west, on the seta');
  assert.ok(options.some((o) => !o.correct && o.pos.y > 300), 'one to the north (the seta\'s right)');
  assert.ok(options.some((o) => !o.correct && o.pos.y < -300), 'one to the south (its left)');
  assert.ok(options.some((o) => o.mistake === 'downwind' && o.pos.x > 300), 'one behind it, to the east');
});

test('planning: only one holding area option lies in the direction the seta points', () => {
  const random = seeded(11);
  for (let i = 0; i < 40; i += 1) {
    const run = newRun(random);
    const points = patternPoints(run.setaHeading);
    const s = unit(run.setaHeading);
    const options = planOptions(points, 'H', run.setaHeading, random);
    // "In the seta's direction": within 45° of the seta, seen from the target.
    const upwind = options.filter((o) => dot(o.pos, s) / Math.hypot(o.pos.x, o.pos.y) > Math.cos(Math.PI / 4));
    assert.equal(upwind.length, 1, `seta ${run.setaHeading}: one upwind option`);
    assert.ok(upwind[0].correct);
    // Every wrong area is at least 60° away from the seta's direction, so none looks upwind.
    for (const o of options.filter((x) => !x.correct)) {
      assert.ok(dot(o.pos, s) / Math.hypot(o.pos.x, o.pos.y) < Math.cos(Math.PI / 3) + 1e-9, 'wrong area clearly off the seta');
    }
  }
});

test('every navigation text exists in every locale', () => {
  for (const locale of ['en_US', 'pt_BR']) {
    const { navigation } = JSON.parse(readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), 'utf8'));
    for (const stepName of PLAN_STEPS) assert.ok(navigation.plan.ask[stepName], `${locale}: plan.ask.${stepName}`);
    for (const m of ['downwind', 'rightSide', 'both', 'pastTarget', 'cRight', 'holdingSide']) assert.ok(navigation.plan.hints[m], `${locale}: plan.hints.${m}`);
    for (const g of ['legendary', 'great', 'goal', 'missed']) assert.ok(navigation.report.landing[g], `${locale}: report.landing.${g}`);
    for (const f of ['good', 'high', 'low', 'none', 'released']) assert.ok(navigation.report.flare[f], `${locale}: report.flare.${f}`);
  }
});

test('drop zone: points A, B and C (and X) lie over the landing area for every seta', () => {
  const { landing } = buildDropzone();
  const margin = PATTERN.reachM; // even a point missed by the full tolerance stays inside
  for (let seta = 0; seta < 360; seta += 45) {
    const p = patternPoints(seta);
    for (const name of ['X', 'A', 'B', 'C']) {
      const q = p[name];
      assert.ok(q.x > landing.x0 + margin && q.x < landing.x1 - margin && q.y > landing.y0 + margin && q.y < landing.y1 - margin,
        `seta ${seta}°: ${name} (${Math.round(q.x)}, ${Math.round(q.y)}) is outside the landing area`);
    }
  }
});

test('planning: no holding area offered covers the landing area (or the seta in it), for every seta', () => {
  for (let seta = 0; seta < 360; seta += 45) {
    const p = patternPoints(seta);
    const radius = Math.hypot(p.H.x, p.H.y);
    for (const deg of HOLDING_OPTION_ANGLES) {
      const d = unit(seta + deg);
      const shape = holdingShape({ x: d.x * radius, y: d.y * radius }, seta + deg);
      const closest = Math.min(...shape.map(outsideLanding));
      assert.ok(closest >= PATTERN.holdingClearanceM, `seta ${seta}°, option at ${deg}°: only ${Math.round(closest)} m from the landing area`);
    }
    // And never needlessly far: at most about 300 m more than the usual offset beyond A.
    const usual = p.A.x * unit(seta).x + p.A.y * unit(seta).y + PATTERN.holdingOffsetM;
    assert.ok(radius - usual <= 310, `seta ${seta}°: holding area ${Math.round(radius - usual)} m further than usual`);
  }
});

test('report: a sharp turn started below 300 ft is a serious mistake, small corrections there are not', () => {
  const run = { setaHeading: 0, start: { x: 0, y: -400, altFt: 280, heading: 0 } };
  const hold = (flight, dir, seconds) => {
    setTurn(flight, dir);
    for (let i = 0; i < Math.round(seconds / 0.05); i += 1) step(flight, 0.05);
    setTurn(flight, 0);
  };
  const straight = (flight, seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i += 1) step(flight, 0.05); };
  const land = (flight) => { while (!flight.landed) step(flight, 0.05); return buildReport(flight); };

  // A 90° left turn at 280 ft: even to the left, it counts, and the pattern is not clean.
  const sharp = createFlight(run, patternPoints(0));
  hold(sharp, -1, 1.5);
  const report = land(sharp);
  assert.equal(report.lowTurns, 1);
  assert.equal(report.clean, false);

  // Two 15° corrections, well apart: fine.
  const gentle = createFlight(run, patternPoints(0));
  hold(gentle, 1, 0.25); straight(gentle, 3); hold(gentle, -1, 0.25);
  assert.equal(land(gentle).lowTurns, 0);

  // Three quick 20° taps the same way add up to a 60° turn.
  const taps = createFlight(run, patternPoints(0));
  for (let i = 0; i < 3; i += 1) { hold(taps, 1, 1 / 3); straight(taps, 0.4); }
  assert.equal(lowTurns(taps.turns).length, 1);

  // A sharp turn above 300 ft is not this mistake...
  const high = createFlight({ setaHeading: 0, start: { x: 0, y: -400, altFt: 400, heading: 0 } }, patternPoints(0));
  hold(high, -1, 1.5);
  assert.equal(land(high).lowTurns, 0);

  // ...nor the turn onto final, started at point C (300 ft) and ending a little lower.
  const final = createFlight({ setaHeading: 0, start: { x: 0, y: -400, altFt: 302, heading: 0 } }, patternPoints(0));
  hold(final, -1, 1.5);
  assert.ok(final.altFt < 300);
  assert.equal(land(final).lowTurns, 0);

  // Over point C, the turn onto final may start down to 250 ft; lower, it counts.
  const points = patternPoints(0);
  const overC = (altFt) => createFlight({ setaHeading: 0, start: { x: points.C.x + 20, y: points.C.y, altFt, heading: 0 } }, points);
  const late = overC(255);
  hold(late, -1, 1.5);
  assert.equal(land(late).lowTurns, 0, '255 ft over C: a little late, allowed');
  const tooLate = overC(240);
  hold(tooLate, -1, 1.5);
  assert.equal(land(tooLate).lowTurns, 1, '240 ft over C: too low');
  // Away from point C, 255 ft is still too low.
  const away = createFlight({ setaHeading: 0, start: { x: points.C.x + 200, y: points.C.y, altFt: 255, heading: 0 } }, points);
  hold(away, -1, 1.5);
  assert.equal(land(away).lowTurns, 1, '255 ft away from C: too low');
});
