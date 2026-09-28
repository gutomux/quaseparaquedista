/**
 * The cartoon jumper, drawn in SVG from a simple 3D body.
 *
 * buildModel() and projectModel() are pure: a (possibly in-between) pose
 * becomes 3D joint positions, which are then turned by the heading and
 * flattened for a camera. Because the body is 3D, a turn really rotates it:
 * seen from the side while facing the viewer, both arms and legs spread out
 * like the box position does. JumperFigure creates the SVG shapes once and
 * moves and re-stacks them every frame.
 *
 * Body coordinates are [forward, up, right] in drawing units.
 * World coordinates: X to the screen's right, Y up, Z toward the viewer.
 * Heading 0 faces the screen's right with the jumper's right side toward the viewer;
 * a positive heading is a right turn.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;

/**
 * Leg angles for tucked (-1), box (0) and stretched (+1).
 * thigh: in the forward/up plane (0 = forward, 90 = up). Tucking doesn't move it: only the knee bends.
 * knee: bend in degrees (0 = straight leg). Box is 45; stretched is 20 (a 160-degree knee);
 *   tucked brings the ankles up toward the body.
 */
const LEGS = Object.freeze({
  thigh: [170, 170, 176],
  spread: [28, 28, 14], // sideways, from the body's centerline
  knee: [105, 45, 20],
  foot: [70, 78, 22], // foot angle relative to the shin; small when the toes are pointed
});
/**
 * Arm directions [forward, up, out] for reaching forward (-1), box (0) and pulled back (+1).
 * Box: upper arms about 30 degrees forward of the shoulder line, forearms pointing forward.
 * Pulled back: upper arms in line with the shoulders, forearms still pointing forward.
 */
const ARMS = Object.freeze({
  upper: [[0.85, 0.15, 0.5], [0.5, 0.08, 0.866], [0, 0.08, 1]],
  fore: [[0.97, 0.1, 0.2], [0.97, 0.2, 0.05], [0.97, 0.2, 0.05]],
});
const LENGTH = Object.freeze({ thigh: 19, shin: 18, foot: 7, upperArm: 13, forearm: 12 });
/** Body roll with a shoulder dipped, in degrees. */
const ROLL_DEGREES = 16;

const lerp = (a, b, k) => a + (b - a) * k;
/** Interpolate a [low, mid, high] triple for v in -1..1. Works on numbers and vectors. */
function blend([low, mid, high], v) {
  const [a, b, k] = v < 0 ? [mid, low, -v] : [mid, high, v];
  return Array.isArray(a) ? a.map((x, i) => lerp(x, b[i], k)) : lerp(a, b, k);
}
const add = (p, d, length) => p.map((x, i) => x + d[i] * length);
function unit(v) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
/**
 * Direction from an angle in a leg's plane: the forward/up plane turned by `spread` degrees,
 * so backward points outward and forward points inward. Thigh, shin and foot all stay in
 * this plane, so from above a leg is one straight line however far the knee bends.
 */
function planeDirection(angle, spread, side) {
  const along = Math.cos(angle * RAD);
  return [along * Math.cos(spread * RAD), Math.sin(angle * RAD), -side * along * Math.sin(spread * RAD)];
}

/**
 * The body in 3D for a pose.
 * @param {{legs: number, arms: number, arch: number, turn: number}} pose Values from -1 to 1 (may be fractional).
 *   arms: -1 reaching forward, +1 swept back; turn: +1 right shoulder down. Same as sim.js.
 * @returns {Object<string, {points: number[][], r?: number}>} Parts by name; sides end in R or L.
 */
export function buildModel(pose) {
  const arch = 0.5 + 0.5 * pose.arch; // 0 flat, 0.5 box, 1 strong arch
  const lift = arch * 5; // arching lifts the head and feet and pushes the belly down
  const parts = {
    spine: { points: [[-16, lift, 0], [0, -(2 + arch * 6), 0], [15, lift, 0]] },
    hips: { points: [[-16, lift, -6], [-16, lift, 6]] },
    shoulders: { points: [[15, lift + 1, -9], [15, lift + 1, 9]] },
    container: { points: [[-10, lift + 5, -6], [8, lift + 5, -6], [8, lift + 5, 6], [-10, lift + 5, 6]] },
    head: { points: [[26, lift + 3 + arch * 2, 0]], r: 7 },
  };
  parts.visor = { points: [add(parts.head.points[0], [0.8, -0.45, 0], 4.5)], r: 3.6 };

  for (const [name, side] of [['R', 1], ['L', -1]]) {
    const hip = [-16, lift, side * 5];
    const spread = blend(LEGS.spread, pose.legs);
    const thighAngle = blend(LEGS.thigh, pose.legs) - arch * 8;
    const shinAngle = thighAngle - blend(LEGS.knee, pose.legs);
    const knee = add(hip, planeDirection(thighAngle, spread, side), LENGTH.thigh);
    const ankle = add(knee, planeDirection(shinAngle, spread, side), LENGTH.shin);
    const toe = add(ankle, planeDirection(shinAngle + blend(LEGS.foot, pose.legs), spread, side), LENGTH.foot);
    parts[`thigh${name}`] = { points: [hip, knee] };
    parts[`shin${name}`] = { points: [knee, ankle] };
    parts[`foot${name}`] = { points: [ankle, toe] };

    const outward = (v) => unit([v[0], v[1], v[2] * side]);
    // The dipped side's arm reaches a little lower, on top of the body roll.
    const drop = Math.max(pose.turn * side, 0) * 5;
    const shoulder = [15, lift + 1, side * 9];
    const elbow = add(shoulder, outward(blend(ARMS.upper, pose.arms)), LENGTH.upperArm);
    const hand = add(elbow, outward(blend(ARMS.fore, pose.arms)), LENGTH.forearm);
    elbow[1] -= drop / 2;
    hand[1] -= drop;
    parts[`upperArm${name}`] = { points: [shoulder, elbow] };
    parts[`forearm${name}`] = { points: [elbow, hand] };
    parts[`hand${name}`] = { points: [hand], r: 3 };
  }
  return parts;
}

/**
 * Turn and flatten the body for one camera.
 * @param {object} model From buildModel().
 * @param {object} view
 * @param {number} view.heading Degrees, + is a right turn.
 * @param {number} [view.tilt=0] Pitch in degrees; + dips the head.
 * @param {number} [view.roll=0] Roll in degrees; + dips the right shoulder.
 * @param {'side'|'top'} [view.camera='side']
 * @returns {Object<string, {points: {x: number, y: number}[], depth: number, r?: number}>}
 *   Screen points (SVG y grows downward) and depth: bigger is nearer the camera.
 */
export function projectModel(model, { heading, tilt = 0, roll = 0, camera = 'side' }) {
  const [ct, st] = [Math.cos(tilt * RAD), Math.sin(tilt * RAD)];
  const [cr, sr] = [Math.cos(roll * RAD), Math.sin(roll * RAD)];
  const [ch, sh] = [Math.cos(heading * RAD), Math.sin(heading * RAD)];
  const toWorld = ([f, u, r]) => {
    const f1 = f * ct + u * st;
    const u1 = u * ct - f * st;
    const u2 = u1 * cr - r * sr;
    const r2 = r * cr + u1 * sr;
    return { X: f1 * ch - r2 * sh, Y: u2, Z: f1 * sh + r2 * ch };
  };
  const out = {};
  for (const [name, part] of Object.entries(model)) {
    const world = part.points.map(toWorld);
    const points = world.map((w) => (camera === 'top' ? { x: w.X, y: w.Z } : { x: w.X, y: -w.Y }));
    const depths = world.map((w) => (camera === 'top' ? w.Y : w.Z));
    out[name] = { points, depth: depths.reduce((a, b) => a + b, 0) / depths.length, r: part.r };
  }
  return out;
}

/** Shapes in their default stacking order; the frame re-stacks them by depth. */
const SHAPES = Object.freeze([
  ['thighL', 'path', 'ff-suit ff-thigh'], ['shinL', 'path', 'ff-suit ff-shin'], ['footL', 'path', 'ff-boot'],
  ['upperArmL', 'path', 'ff-suit ff-arm'], ['forearmL', 'path', 'ff-suit ff-forearm'], ['handL', 'circle', 'ff-glove'],
  ['hips', 'path', 'ff-suit ff-hips'], ['spine', 'path', 'ff-suit ff-spine'], ['shoulders', 'path', 'ff-suit ff-hips'],
  ['container', 'path', 'ff-container'], ['head', 'circle', 'ff-helmet'], ['visor', 'circle', 'ff-visor'],
  ['thighR', 'path', 'ff-suit ff-thigh'], ['shinR', 'path', 'ff-suit ff-shin'], ['footR', 'path', 'ff-boot'],
  ['upperArmR', 'path', 'ff-suit ff-arm'], ['forearmR', 'path', 'ff-suit ff-forearm'], ['handR', 'circle', 'ff-glove'],
]);
/** Parts behind the body by more than this are shaded darker. */
const FAR_DEPTH = -2;

const fmt = (n) => n.toFixed(1);
function pathData(name, points) {
  if (name === 'spine') {
    const [a, c, b] = points;
    return `M${fmt(a.x)} ${fmt(a.y)} Q${fmt(c.x)} ${fmt(c.y)} ${fmt(b.x)} ${fmt(b.y)}`;
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`).join(' ');
  return name === 'container' ? `${d} Z` : d;
}

export class JumperFigure {
  /**
   * @param {'side'|'top'} camera
   * @param {number} size Drawing scale.
   */
  constructor(camera = 'side', size = 1) {
    this.camera = camera;
    this.size = size;
    this.node = document.createElementNS(SVG_NS, 'g');
    this.node.setAttribute('class', `ff-jumper ff-jumper-${camera}`);
    this.shapes = SHAPES.map(([name, tag, className], order) => {
      const node = document.createElementNS(SVG_NS, tag);
      node.setAttribute('class', className);
      this.node.append(node);
      return { name, node, className, order };
    });
    this.stack = '';
  }

  /**
   * Draw one frame.
   * @param {object} pose Eased pose (see buildModel).
   * @param {object} view
   * @param {number} view.x Position in the scene.
   * @param {number} view.heading Degrees.
   * @param {number} view.tilt Pitch in degrees; + dips the head.
   * @param {number} view.rock Extra roll in degrees, for wobbling.
   */
  update(pose, { x = 0, heading, tilt = 0, rock = 0 }) {
    const parts = projectModel(buildModel(pose), {
      heading, tilt, roll: pose.turn * ROLL_DEGREES + rock, camera: this.camera,
    });
    for (const shape of this.shapes) {
      const part = parts[shape.name];
      shape.depth = part.depth;
      if (part.r) {
        shape.node.setAttribute('cx', fmt(part.points[0].x));
        shape.node.setAttribute('cy', fmt(part.points[0].y));
        shape.node.setAttribute('r', part.r);
      } else {
        shape.node.setAttribute('d', pathData(shape.name, part.points));
      }
      shape.node.classList.toggle('is-far', part.depth < FAR_DEPTH);
    }

    // Nearer parts go on top. Small depth differences keep the default order, so nothing flickers.
    const sorted = [...this.shapes].sort((a, b) => Math.round(a.depth / 2) - Math.round(b.depth / 2) || a.order - b.order);
    const stack = sorted.map((s) => s.order).join(',');
    if (stack !== this.stack) {
      this.stack = stack;
      this.node.append(...sorted.map((s) => s.node));
    }
    this.node.setAttribute('transform', `translate(${fmt(x)} 0) scale(${this.size})`);
  }
}
