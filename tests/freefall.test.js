import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONTROLS, GROUPS, COMBOS, NEUTRAL, toggle, isOn, activeControls, comboNote, effects, describe, createState, step,
} from '../js/freefall/sim.js';
import { buildModel, projectModel } from '../js/freefall/figure.js';

const on = (...ids) => ids.reduce(toggle, { ...NEUTRAL });
/** Fly a pose for a few seconds and return the final state. */
const fly = (pose, seconds = 3) => {
  let state = createState();
  for (let t = 0; t < seconds; t += 0.02) state = step(state, pose, 0.02);
  return state;
};

test('neutral box position holds still at the normal fall rate', () => {
  assert.deepEqual(describe(NEUTRAL), { move: 'still', turn: null });
  assert.equal(effects(NEUTRAL).fallRate, 1);
  assert.equal(Math.round(fly(NEUTRAL).x * 1000), 0);
});

test('stretched legs or swept-back arms move the jumper forward', () => {
  assert.equal(describe(on('legsStretch')).move, 'forward');
  assert.equal(describe(on('armsBack')).move, 'forward');
  assert.ok(fly(on('legsStretch')).x > 0);
});

test('tucked legs or arms forward move the jumper backward', () => {
  assert.equal(describe(on('legsTuck')).move, 'backward');
  assert.equal(describe(on('armsForward')).move, 'backward');
  assert.ok(fly(on('armsForward')).x < 0);
});

test('effects add up, and opposing limbs cancel', () => {
  assert.ok(effects(on('legsStretch', 'armsBack')).drift > effects(on('legsStretch')).drift);
  assert.equal(effects(on('legsStretch', 'armsForward')).drift, 0, 'opposing limbs cancel the drift');
});

test('arch changes the fall rate, and only flat wobbles', () => {
  assert.equal(effects(on('archMore')).fallRate, 1.3);
  assert.ok(effects(on('archFlat')).fallRate < 1);
  assert.equal(effects(on('archFlat')).wobble, 1);
  assert.equal(effects(on('archMore')).wobble, 0);
});

test('dipping a shoulder turns that way', () => {
  assert.equal(describe(on('dipRight')).turn, 'right');
  assert.equal(describe(on('dipLeft')).turn, 'left');
  const heading = fly(on('dipRight'), 1).heading;
  assert.ok(heading > 0 && heading < 180);
});

test('a control toggles off, and turns its opposite off', () => {
  assert.deepEqual(on('legsStretch', 'legsStretch'), NEUTRAL);
  const pose = on('legsStretch', 'legsTuck');
  assert.ok(isOn(pose, 'legsTuck') && !isOn(pose, 'legsStretch'));
  assert.deepEqual(activeControls(on('archMore', 'dipLeft')), ['archMore', 'dipLeft']);
  assert.throws(() => toggle(NEUTRAL, 'nope'));
});

test('forward drift shows as backward on screen once the jumper faces the other way', () => {
  let state = { ...createState(), heading: 180 };
  for (let i = 0; i < 100; i += 1) state = step(state, on('legsStretch'), 0.02);
  assert.ok(state.x < 0);
});

/** Screen points of the jumper for a pose and view. */
const RAD = Math.PI / 180;
const project = (pose, view) => projectModel(buildModel({ ...NEUTRAL, ...pose }), { heading: 0, ...view });

test('figure: the box knee bends 45 degrees, and tucking only bends the knee', () => {
  const leg = (legs) => buildModel({ ...NEUTRAL, legs });
  const dir = ([a, b]) => { const d = b.map((x, i) => x - a[i]); const n = Math.hypot(...d); return d.map((x) => x / n); };
  const bend = (model) => Math.acos(dir(model.thighR.points).reduce((s, x, i) => s + x * dir(model.shinR.points)[i], 0)) / RAD;
  assert.equal(Math.round(bend(leg(0))), 45);
  assert.deepEqual(leg(-1).thighR.points, leg(0).thighR.points, 'the hips and thighs stay put');
  const ankle = (legs) => leg(legs).shinR.points[1];
  assert.ok(ankle(-1)[1] > ankle(0)[1], 'tucked ankles come up');
  assert.ok(ankle(-1)[0] > ankle(0)[0], 'and closer to the body');
  assert.ok(project({ legs: 1 }).footR.points[1].x < project({}).footR.points[1].x, 'stretched feet reach further back');
  const { shinR, footR } = project({});
  assert.deepEqual(footR.points[0], shinR.points[1], 'the foot starts at the ankle');
});

test('figure: facing the viewer, the arms spread to both sides and the right one is on screen left', () => {
  const { handR, handL } = project({}, { heading: 90 });
  assert.ok(handR.points[0].x < -10 && handL.points[0].x > 10);
});

test('figure: from the side, the right side is nearer, and the far side is behind', () => {
  const parts = project({});
  assert.ok(parts.thighR.depth > 0 && parts.thighL.depth < 0);
});

test('figure: dipping the right shoulder lowers the right hand and raises the left', () => {
  const level = { heading: 90, roll: 0 };
  const dipped = { heading: 90, roll: 16 };
  const hand = (view, side) => project({ turn: 1 }, view)[`hand${side}`].points[0].y;
  assert.ok(hand(dipped, 'R') > hand(level, 'R'), 'screen y grows downward');
  assert.ok(hand(dipped, 'L') < hand(level, 'L'));
});

test('figure: box arms sit 30 degrees forward of the shoulders; pulled back, they line up with them', () => {
  const upper = (arms) => {
    const [a, b] = buildModel({ ...NEUTRAL, arms }).upperArmR.points;
    return Math.atan2(b[0] - a[0], b[2] - a[2]) / RAD; // forward angle from the shoulder line
  };
  assert.equal(Math.round(upper(0)), 30);
  assert.equal(Math.round(upper(1)), 0);
  for (const arms of [0, 1]) {
    const [e, h] = buildModel({ ...NEUTRAL, arms }).forearmR.points;
    assert.ok(h[0] - e[0] > 10, `forearms point forward (arms ${arms})`);
  }
});

test('figure: from above, each leg is one straight line, even tucked', () => {
  for (const legs of [-1, 0, 1]) {
    const parts = project({ legs }, { camera: 'top' });
    const [hip, knee] = parts.thighR.points;
    const cross = (p) => (knee.x - hip.x) * (p.y - hip.y) - (knee.y - hip.y) * (p.x - hip.x);
    for (const p of [parts.shinR.points[1], parts.footR.points[1]]) assert.ok(Math.abs(cross(p)) < 1e-6, `legs ${legs}`);
  }
});

test('figure: the top view shows the heading', () => {
  const head = (heading) => project({}, { heading, camera: 'top' }).head.points[0];
  assert.ok(head(0).x > 20);
  assert.ok(head(90).y > 20, 'after a right turn the head points down the compass');
});

test('legs stretched with arms forward slow the fall a little, and more when flat too', () => {
  assert.equal(comboNote(on('legsStretch')), null);
  assert.equal(comboNote(on('legsStretch', 'armsForward')), 'moreArea');
  assert.equal(comboNote(on('legsStretch', 'armsForward', 'archFlat')), 'slowFall');
  assert.equal(comboNote(on('legsStretch', 'armsForward', 'dipLeft')), 'moreArea', 'other buttons may be on');
  const spread = effects(on('legsStretch', 'armsForward')).fallRate;
  assert.ok(spread < 1 && spread > effects(on('legsStretch', 'armsForward', 'archFlat')).fallRate);
});

test('legs stretched with arms forward: neutral, falling as slow as de-arching', () => {
  const pose = on('legsStretch', 'armsForward');
  assert.equal(effects(pose).drift, 0);
  assert.equal(effects(pose).fallRate, effects(on('archFlat')).fallRate);
  assert.deepEqual(describe(pose), { move: 'stillSlower', turn: null });
  assert.deepEqual(describe(on('legsStretch', 'armsForward', 'dipRight')), { move: 'stillSlower', turn: 'right' });
});

test('legs tucked with arms pulled back: neutral, falling as fast as arching more', () => {
  const pose = on('legsTuck', 'armsBack');
  assert.equal(effects(pose).drift, 0);
  assert.equal(effects(pose).fallRate, effects(on('archMore')).fallRate);
  assert.deepEqual(describe(pose), { move: 'stillFaster', turn: null });
});

test('the readout says neutral only when nothing changes the fall', () => {
  assert.equal(describe(NEUTRAL).move, 'still');
  assert.equal(describe(on('archMore')).move, 'still', 'arch alone keeps the plain neutral label');
});

test('falling faster sinks down the window, falling slower rises, like drifting sideways', () => {
  const flyY = (pose) => {
    let state = createState();
    for (let t = 0; t < 3; t += 0.02) state = step(state, pose, 0.02, 60, 160);
    return state.y;
  };
  assert.equal(Math.round(flyY(NEUTRAL) * 1000), 0, 'neutral stays at the same height');
  assert.ok(flyY(on('archMore')) > 0, 'arching more sinks (y grows downward)');
  assert.ok(flyY(on('archFlat')) < 0, 'de-arching rises');
  assert.ok(flyY(on('legsTuck', 'armsBack')) > 0, 'legs tucked with arms back sinks');
  assert.ok(flyY(on('legsStretch', 'armsForward')) < 0, 'legs stretched with arms forward rises');
  assert.equal(Math.round(flyY(on('legsStretch'))), 0, 'drifting forward alone keeps the height');
  assert.equal(step(createState(), on('archMore'), 0.02, 60).y, 0, 'no up/down movement unless a fall speed is given');
});

test('every control and group has text in every locale', () => {
  for (const locale of ['en_US', 'pt_BR']) {
    const { freefall } = JSON.parse(readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), 'utf8'));
    for (const { id } of CONTROLS) {
      assert.ok(freefall.controls[id], `${locale}: freefall.controls.${id}`);
      assert.ok(freefall.explain[id], `${locale}: freefall.explain.${id}`);
    }
    for (const group of GROUPS) assert.ok(freefall.groups[group], `${locale}: freefall.groups.${group}`);
    for (const { id } of COMBOS) assert.ok(freefall.combos[id], `${locale}: freefall.combos.${id}`);
    for (const move of ['forward', 'backward', 'still', 'stillSlower', 'stillFaster']) {
      assert.ok(freefall.status.move[move], `${locale}: freefall.status.move.${move}`);
    }
  }
});

