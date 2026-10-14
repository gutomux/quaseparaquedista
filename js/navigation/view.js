/**
 * Navigation simulator view: the planning map (looking straight down), the flight view
 * (looking forward and down, drawn on a canvas), the small map, the altimeter and the report.
 * It holds no rules: main.js asks pattern.js, flight.js and report.js and passes results in.
 * Text goes in with textContent only.
 */
import { FT, PATTERN, unit, holdingShape, headingTo } from './pattern.js';
import { buildDropzone, PALETTE } from './dropzone.js';

/** The drop zone, built once, with each shape's center and bounds for quick culling. */
const DZ = (() => {
  const dz = buildDropzone();
  for (const s of dz.shapes) {
    const xs = s.pts.map((p) => p.x);
    const ys = s.pts.map((p) => p.y);
    s.box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    s.cx = (s.box.x0 + s.box.x1) / 2;
    s.cy = (s.box.y0 + s.box.y1) / 2;
  }
  return dz;
})();
/**
 * The seta, the same in every view: a fixed spot inside the landing area, near its south-east
 * corner, as at real drop zones. Only its direction changes with the wind. A circle around it
 * (`ring`, its radius as a share of the seta's length) makes it easy to find.
 */
const SETA = { at: { x: 420, y: -420 }, length: 67, ring: 0.75 };
/** The circle around the seta on a map, under the arrow. */
function appendSetaRing(root, scale = 1) {
  const c = SETA.at;
  root.append(svg('circle', { class: 'nm-seta-ring', cx: mx(c).toFixed(1), cy: my(c).toFixed(1), r: (SETA.length * SETA.ring * scale).toFixed(1) }));
}
const setaCenter = () => SETA.at;

/** Draw the drop zone into a map's SVG, skipping what's outside the view. */
function appendDropzone(root, range) {
  root.append(svg('rect', { x: -range, y: -range, width: range * 2, height: range * 2, fill: PALETTE.ground }));
  for (const s of DZ.shapes) {
    if (s.box.x1 < -range || s.box.x0 > range || s.box.y1 < -range || s.box.y0 > range) continue;
    root.append(svg('polygon', { points: toPoints(s.pts), fill: s.color }));
  }
  for (const b of DZ.structures) root.append(svg('polygon', { points: toPoints(b.pts), fill: b.roof, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 2 }));
  const trees = svg('g', { fill: PALETTE.tree });
  for (const t of DZ.trees) {
    if (Math.abs(t.x) > range + 20 || Math.abs(t.y) > range + 20) continue;
    trees.append(svg('circle', { cx: t.x.toFixed(1), cy: (-t.y).toFixed(1), r: t.r }));
  }
  root.append(trees);
}
/** The target: a pea-gravel pit (12 m radius, like a real one) with a red center. */
const TARGET = { gravel: 12, center: 4 };
/**
 * A flag beside the target, 6.5 ft tall: the flare reference. When its top is level with the
 * student's feet, the canopy is at flare height. Its cloth streams downwind.
 */
const EYE_ABOVE_FEET_M = 1.6;
/**
 * The pillars marking points A, B and C in flight: colors (as r,g,b), yellow until reached, then
 * green; each pillar's height (ft), and the band to enter it through, the ideal height to pass the
 * point at (ft).
 */
const PILLAR = {
  todo: '245,180,0',
  done: '63,191,116',
  A: { topFt: 1300, entryFt: [950, 1050] },
  B: { topFt: 800, entryFt: [550, 650] },
  C: { topFt: 500, entryFt: [280, 380] },
};
const FLAG = { at: { x: 16, y: 0 }, heightFt: 6.5, cloth: '#FF6A13', pole: '#F2F2EC' };
/** Convex hull of screen points (monotone chain), for the outline of a pillar. */
function hull(points) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half(pts.reverse())];
}
/** On the maps it's drawn bigger (`scale`) so it stays visible from far above. */
function appendTarget(root, scale = 1) {
  root.append(svg('circle', { cx: 0, cy: 0, r: 30 * scale, fill: PALETTE.gravel, stroke: PALETTE.target, 'stroke-width': 6 * scale }));
  root.append(svg('circle', { cx: 0, cy: 0, r: 9 * scale, fill: PALETTE.target }));
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The small map in flight shows this many meters around the target in each direction. */
const MINI_RANGE = 1100;

/** Planning map half-size: just enough to show the student, the pattern and the options. */
function mapRange(run, points) {
  const far = Math.max(Math.hypot(run.start.x, run.start.y), Math.hypot(points.H.x, points.H.y) + 180);
  return Math.ceil((far + 160) / 50) * 50;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
/** Map coordinates: north up, so the y axis flips. */
const mx = (p) => p.x;
const my = (p) => -p.y;

/** The seta as a polygon on the ground: an arrow `length` meters long, centered on `at`. */
function setaShape(at, heading, length = 70) {
  const f = unit(heading);
  const r = unit(heading + 90);
  const pt = (a, b) => ({ x: at.x + f.x * a + r.x * b, y: at.y + f.y * a + r.y * b });
  const l = length / 2;
  return [pt(l, 0), pt(l * 0.2, l * 0.5), pt(l * 0.2, l * 0.18), pt(-l, l * 0.18), pt(-l, -l * 0.18), pt(l * 0.2, -l * 0.18), pt(l * 0.2, -l * 0.5)];
}
const circle = (c, radius, n = 28) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return { x: c.x + Math.cos(a) * radius, y: c.y + Math.sin(a) * radius };
});
const toPoints = (list) => list.map((p) => `${mx(p).toFixed(1)},${my(p).toFixed(1)}`).join(' ');

export class NavigationView {
  constructor(root, t) {
    this.root = root;
    this.t = t;
    this.planSection = root.querySelector('#plan');
    this.flightSection = root.querySelector('#flight');
    this.reportSection = root.querySelector('#report');
    this.planMap = root.querySelector('#plan-map');
    this.planPrompt = root.querySelector('#plan-prompt');
    this.planOptionsBox = root.querySelector('#plan-options');
    this.planFeedback = root.querySelector('#plan-feedback');
    this.startButton = root.querySelector('#start-flight');
    this.canvas = root.querySelector('#nav-view');
    this.ctx = this.canvas.getContext('2d');
    this.miniMap = root.querySelector('#nav-minimap');
    this.altimeter = root.querySelector('#nav-altimeter');
    this.fastBadge = root.querySelector('#nav-fast');
    this.pauseButton = root.querySelector('#nav-pause');
    this.speedButtons = [...root.querySelectorAll('[data-speed]')];
    this.lookReset = root.querySelector('#nav-look-reset');
    /** Where the student looks, relative to straight ahead: yaw (+ right) and pitch (+ down), degrees. */
    this.look = { yaw: 0, pitch: 0 };
    this.reportList = root.querySelector('#report-list');
    this.reportNotes = root.querySelector('#report-notes');
  }

  /**
   * @param {object} h Handlers: onChoose(index), onStart(), onTurn(dir: -1 left | 1 right | 0 straight),
   *   onFlare(), onPause(), onAgain(), onSetting(name, value), onSpeed('regular' | 'fast')
   */
  bind(h) {
    this.planOptionsBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-option]');
      if (b) h.onChoose(Number(b.dataset.option));
    });
    this.planMap.addEventListener('click', (e) => {
      const g = e.target.closest('[data-option]');
      if (g) h.onChoose(Number(g.dataset.option));
    });
    this.startButton.addEventListener('click', h.onStart);
    // Hold to turn, like pulling a toggle down: press and hold, let go to fly straight.
    for (const [id, dir] of [['#nav-left', -1], ['#nav-right', 1]]) {
      const button = this.root.querySelector(id);
      const release = () => { if (this.holding === dir) { this.holding = 0; h.onTurn(0); } };
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.holding = dir;
        try { button.setPointerCapture(e.pointerId); } catch { /* keep holding without capture */ }
        h.onTurn(dir);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
      button.addEventListener('contextmenu', (e) => e.preventDefault()); // a long press would open a menu
      // Keyboard on the focused button: hold Space or Enter.
      button.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); this.holding = dir; h.onTurn(dir); }
      });
      button.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') release(); });
    }
    window.addEventListener('blur', () => { if (this.holding) { this.holding = 0; h.onTurn(0); } });
    // The flare is held too: press and hold until touchdown.
    const flareButton = this.root.querySelector('#nav-flare');
    const flareUp = () => { if (this.flareHeld) { this.flareHeld = false; h.onFlare(false); } };
    flareButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.flareHeld = true;
      h.onFlare(true);
      try { flareButton.setPointerCapture(e.pointerId); } catch { /* keep holding without capture */ }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) flareButton.addEventListener(type, flareUp);
    flareButton.addEventListener('contextmenu', (e) => e.preventDefault());
    flareButton.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); this.flareHeld = true; h.onFlare(true); }
    });
    flareButton.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') flareUp(); });
    window.addEventListener('blur', flareUp);
    this.pauseButton.addEventListener('click', h.onPause);
    for (const b of this.speedButtons) b.addEventListener('click', () => h.onSpeed(b.dataset.speed));
    this.root.querySelector('#report-again').addEventListener('click', h.onAgain);
    this.root.querySelectorAll('[name="nav-guides"]').forEach((input) => {
      input.addEventListener('change', () => h.onSetting(input.name, input.value));
    });
    // Keyboard while flying: hold an arrow to turn, Space or F flares.
    const keyDir = { ArrowLeft: -1, ArrowRight: 1 };
    document.addEventListener('keydown', (e) => {
      if (this.flightSection.hidden || e.target.closest('input, button, a, select, textarea')) return;
      if (keyDir[e.key]) {
        e.preventDefault();
        if (!e.repeat) { this.holding = keyDir[e.key]; h.onTurn(keyDir[e.key]); }
      }
      if (e.key === ' ' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (!e.repeat) { this.flareHeld = true; h.onFlare(true); }
      }
    });
    document.addEventListener('keyup', (e) => {
      if ((e.key === ' ' || e.key.toLowerCase() === 'f') && this.flareHeld) { this.flareHeld = false; h.onFlare(false); }
      if (keyDir[e.key] && this.holding === keyDir[e.key]) { this.holding = 0; h.onTurn(0); }
    });
    window.addEventListener('resize', () => { this.sized = false; });

    // Drag the view to look around, like grabbing the scenery: drag up to look down (to check
    // you're over a point), sideways to look around. The look stays until "Look ahead".
    let drag = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY };
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* keep dragging without capture */ }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = 70 / Math.max(this.canvas.clientWidth, 1); // degrees per pixel: the width is about 70°
      this.lookBy(-(e.clientX - drag.x) * k, -(e.clientY - drag.y) * k);
      drag = { x: e.clientX, y: e.clientY };
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.canvas.addEventListener(type, () => { drag = null; });
    this.lookReset.addEventListener('click', () => this.resetLook());
    document.addEventListener('keydown', (e) => {
      if (this.flightSection.hidden || e.target.closest('input, button, a, select, textarea')) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); this.lookBy(0, -10); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.lookBy(0, 10); }
    });
  }

  /** Turn the look direction by yaw/pitch degrees, and redraw right away (also when paused). */
  lookBy(yaw, pitch) {
    this.look.yaw = ((this.look.yaw + yaw + 540) % 360) - 180;
    this.look.pitch = Math.min(70, Math.max(-80, this.look.pitch + pitch));
    this.lookReset.hidden = Math.abs(this.look.yaw) < 2 && Math.abs(this.look.pitch) < 2;
    if (this.lastFrame) this.drawForward(this.lastFrame.flight, this.lastFrame.run, this.lastFrame.guides);
  }

  resetLook() {
    this.look = { yaw: 0, pitch: 0 };
    this.lookReset.hidden = true;
    if (this.lastFrame) this.drawForward(this.lastFrame.flight, this.lastFrame.run, this.lastFrame.guides);
  }

  setSettings({ guides }) {
    this.root.querySelectorAll('[name="nav-guides"]').forEach((i) => { i.checked = i.value === guides; });
  }

  showPhase(phase) {
    this.planSection.hidden = phase !== 'plan';
    this.flightSection.hidden = phase !== 'flight';
    this.reportSection.hidden = phase !== 'report';
  }

  /* ---------- Planning ---------- */

  /**
   * Draw the planning map and the current step.
   * @param {object} s { run, points, placed: {H?, A?, B?, C?}, step: string|null, options: Array|null }
   */
  renderPlan({ run, points, placed, step, options }) {
    const MAP_RANGE = mapRange(run, points);
    const k = MAP_RANGE / 1000; // symbol size grows with the zoom, so they stay readable on a phone
    const root = svg('svg', { viewBox: `${-MAP_RANGE} ${-MAP_RANGE} ${MAP_RANGE * 2} ${MAP_RANGE * 2}`, role: 'img' });
    root.setAttribute('aria-label', this.t('navigation.plan.mapLabel'));
    appendDropzone(root, MAP_RANGE);
    appendTarget(root, k);
    appendSetaRing(root);
    root.append(svg('polygon', { class: 'nm-seta', points: toPoints(setaShape(setaCenter(run.setaHeading), run.setaHeading, SETA.length)) }));

    // What the student has already placed.
    if (placed.H) root.append(svg('polygon', { class: 'nm-holding', points: toPoints(holdingShape(placed.H, run.setaHeading)) }));
    const order = ['H', 'A', 'B', 'C'].filter((k) => placed[k]);
    const path = [...order.filter((k) => k !== 'H').map((k) => placed[k]), ...(placed.C ? [points.X] : [])];
    if (path.length > 1) root.append(svg('polyline', { class: 'nm-path', points: toPoints(path) }));
    for (const key of order) this.pin(root, placed[key], key === 'H' ? '' : key, 'nm-pin is-placed', k);

    // The student, where the canopy opened.
    const you = svg('g', { class: 'nm-you', transform: `translate(${mx(run.start)} ${my(run.start)}) rotate(${run.start.heading}) scale(${k * 1.4})` });
    you.append(svg('path', { d: 'M0 -55 L34 30 L0 14 L-34 30 Z' }));
    root.append(you);

    // The options for the current step.
    if (options) {
      // The holding area is a region, so its options are areas; A, B and C are points.
      const region = step === 'H';
      options.forEach((o, i) => {
        const g = svg('g', { class: region ? 'nm-option is-region' : 'nm-option', 'data-option': i });
        if (region) g.append(svg('polygon', { class: 'nm-region', points: toPoints(holdingShape(o.pos, headingTo(points.X, o.pos))) }));
        const badge = svg('g', { transform: `translate(${mx(o.pos)} ${my(o.pos)}) scale(${k * 1.25})` });
        badge.append(svg('circle', { r: 70 }));
        const label = svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        label.textContent = String(i + 1);
        badge.append(label);
        g.append(badge);
        root.append(g);
      });
    }
    this.planMap.replaceChildren(root);

    // Prompt and option buttons (the same choices, for keyboards and screen readers).
    this.planPrompt.textContent = step ? this.t(`navigation.plan.ask.${step}`) : this.t('navigation.plan.ready');
    const buttons = (options || []).map((_, i) => {
      const b = el('button', 'nav-option', this.t('navigation.plan.option', { n: i + 1 }));
      b.type = 'button';
      b.dataset.option = i;
      return b;
    });
    this.planOptionsBox.replaceChildren(...buttons);
    this.planOptionsBox.hidden = !options;
    this.startButton.hidden = Boolean(step);
  }

  pin(root, p, letter, className, scale = 1) {
    const g = svg('g', { class: className, transform: `translate(${mx(p)} ${my(p)}) scale(${scale * 1.2})` });
    g.append(svg('circle', { r: letter ? 46 : 22 }));
    if (letter) {
      const text = svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      text.textContent = letter;
      g.append(text);
    }
    root.append(g);
  }

  /** The message under the map: 'info', a 'hint' after a wrong pick, or 'right', with a bold lead. */
  planMessage(text, kind, lead = '') {
    this.planFeedback.textContent = '';
    if (lead) {
      const strong = document.createElement('strong');
      strong.textContent = lead;
      this.planFeedback.append(strong, ' ');
    }
    this.planFeedback.append(text);
    this.planFeedback.dataset.kind = kind || '';
  }

  /* ---------- Flight ---------- */

  fitCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * ratio);
    this.canvas.height = Math.round(h * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.sized = true;
  }

  /**
   * Draw one frame of the flight.
   * @param {object} f { flight, run, guides: boolean, fast: boolean }
   */
  drawFlight({ flight, run, guides, fast }) {
    if (!this.sized) this.fitCanvas();
    this.lastFrame = { flight, run, guides };
    this.drawForward(flight, run, guides);
    this.drawMiniMap(flight, run, guides);
    this.drawAltimeter(flight.altFt);
    this.fastBadge.hidden = !fast;
  }

  /**
   * The view from under the canopy, looking forward and down. Like a pilot, the camera looks
   * down more when high (38° at 3,000 ft, to see the drop zone) and more ahead when low (12°
   * near the ground, for the landing).
   */
  drawForward(flight, run, guides) {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    // Altitude sets how far down the student naturally looks; dragging adds to it.
    const basePitch = 12 + (Math.min(Math.max(flight.altFt, 0), 3000) / 3000) * 26;
    const look = this.look || { yaw: 0, pitch: 0 };
    // From straight down (88°) to 50° up, enough to look up into the canopy.
    const pitch = (Math.min(88, Math.max(-50, basePitch + look.pitch)) * Math.PI) / 180;
    const focal = w / (2 * Math.tan((70 * Math.PI) / 360));
    const cx = w / 2;
    const cy = h * 0.42;
    // The altitude is the student's feet above the ground; the eyes are about 1.6 m higher.
    const height = flight.altFt * FT + EYE_ABOVE_FEET_M;
    const fwd = unit(flight.heading + look.yaw);
    const right = unit(flight.heading + look.yaw + 90);
    // A world point (p.e = meters above the ground, 0 if missing) in camera space.
    const camera = (p) => {
      const dx = p.x - flight.x;
      const dy = p.y - flight.y;
      const f = dx * fwd.x + dy * fwd.y;
      const r = dx * right.x + dy * right.y;
      const above = height - (p.e || 0);
      return { x: r, z: f * Math.cos(pitch) + above * Math.sin(pitch), y: -above * Math.cos(pitch) + f * Math.sin(pitch) };
    };
    const project = (c) => ({ x: cx + (focal * c.x) / c.z, y: cy - (focal * c.y) / c.z });
    const near = 1;
    // Clip a ground polygon against the camera's near plane, then project it.
    const polygon = (list) => {
      const cam = list.map(camera);
      const out = [];
      for (let i = 0; i < cam.length; i += 1) {
        const a = cam[i];
        const b = cam[(i + 1) % cam.length];
        if (a.z >= near) out.push(a);
        if ((a.z >= near) !== (b.z >= near)) {
          const k = (near - a.z) / (b.z - a.z);
          out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: near });
        }
      }
      return out.map(project);
    };
    const fill = (pts, style) => {
      if (pts.length < 3) return;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
    };
    const css = getComputedStyle(this.canvas);
    const color = (name) => css.getPropertyValue(name).trim();

    // Sky and ground.
    const horizon = cy - focal * Math.tan(pitch);
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
    sky.addColorStop(0, color('--nav-sky-top'));
    sky.addColorStop(1, color('--nav-sky-low'));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, horizon, w, h - horizon);

    // The drop zone: fields, the property, landing area, runway, buildings, trees. Shapes far
    // away or behind the camera are skipped.
    const reach = Math.min(4200, 900 + height * 3.2);
    for (const sh of DZ.shapes) {
      const dx = sh.cx - flight.x;
      const dy = sh.cy - flight.y;
      if (Math.hypot(dx, dy) > reach + 400) continue;
      if (dx * fwd.x + dy * fwd.y < -400) continue;
      fill(polygon(sh.pts), sh.color);
    }
    // Far trees are flat; near ones (and all buildings in range) are drawn standing up below.
    const NEAR_3D = 900;
    const standing = [];
    for (const t of DZ.trees) {
      const dx = t.x - flight.x;
      const dy = t.y - flight.y;
      const ahead = dx * fwd.x + dy * fwd.y;
      const dist = Math.hypot(dx, dy);
      if (ahead < -30 || dist > Math.min(reach, 2600)) continue;
      if (dist < NEAR_3D) standing.push({ kind: 'tree', obj: t, dist });
      else fill(polygon(circle(t, t.r, 7)), PALETTE.tree);
    }
    for (const b of DZ.structures) {
      const c = b.pts.reduce((acc, q) => ({ x: acc.x + q.x / b.pts.length, y: acc.y + q.y / b.pts.length }), { x: 0, y: 0 });
      const dx = c.x - flight.x;
      const dy = c.y - flight.y;
      const dist = Math.hypot(dx, dy);
      if (dist < reach && dx * fwd.x + dy * fwd.y > -60) standing.push({ kind: 'building', obj: b, dist });
    }
    {
      const dx = FLAG.at.x - flight.x;
      const dy = FLAG.at.y - flight.y;
      if (dx * fwd.x + dy * fwd.y > -5) standing.push({ kind: 'flag', obj: FLAG, dist: Math.hypot(dx, dy) });
    }
    fill(polygon(circle({ x: 0, y: 0 }, TARGET.gravel)), PALETTE.gravel);
    fill(polygon(circle({ x: 0, y: 0 }, TARGET.center, 14)), PALETTE.target);
    // The circle around the seta: a slightly darker disc with a white edge, then the arrow.
    const ring = polygon(circle(SETA.at, SETA.length * SETA.ring, 40));
    fill(ring, 'rgba(17,19,23,.22)');
    if (ring.length > 2) {
      const d = Math.max(1, Math.hypot(SETA.at.x - flight.x, SETA.at.y - flight.y, height));
      ctx.lineWidth = Math.max(1.5, (focal * 3) / d);
      ctx.strokeStyle = color('--nav-seta');
      ctx.stroke();
    }
    fill(polygon(setaShape(setaCenter(run.setaHeading), run.setaHeading, SETA.length)), color('--nav-seta'));

    // Haze toward the horizon, like looking through miles of air.
    const haze = ctx.createLinearGradient(0, horizon, 0, horizon + (h - horizon) * 0.45);
    haze.addColorStop(0, color('--nav-haze'));
    haze.addColorStop(1, 'rgba(200,220,235,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Standing objects, farthest first, so nearer ones cover them; drawn after the haze, so the
    // trees and buildings near the landing stay crisp.
    standing.sort((a, b) => b.dist - a.dist);
    const eye = { x: flight.x, y: flight.y };
    for (const { kind, obj } of standing) {
      if (kind === 'flag') {
        const top = obj.heightFt * FT;
        const base = camera(obj.at);
        const tip = camera({ ...obj.at, e: top });
        if (base.z < near || tip.z < near) continue;
        const b = project(base);
        const t = project(tip);
        ctx.strokeStyle = obj.pole;
        ctx.lineWidth = Math.max(1.2, (focal * 0.05) / base.z);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        // The cloth, streaming downwind from the top of the pole.
        const d = unit(flight.windHeading);
        const at = (along, e) => ({ x: obj.at.x + d.x * along, y: obj.at.y + d.y * along, e });
        const cloth = polygon([at(0, top), at(0.9, top - 0.08), at(0.9, top - 0.42), at(0, top - 0.5)]);
        fill(cloth, obj.cloth);
        if (cloth.length > 2) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.stroke();
        }
        continue;
      }
      if (kind === 'tree') {
        const base = camera(obj);
        const top = camera({ x: obj.x, y: obj.y, e: obj.h });
        if (base.z < near || top.z < near) continue;
        const b = project(base);
        const t = project(top);
        const crown = project(camera({ x: obj.x, y: obj.y, e: obj.h * (obj.h > 16 ? 0.3 : 0.62) }));
        const radius = Math.max(1, (focal * obj.r) / top.z);
        ctx.strokeStyle = PALETTE.trunk;
        ctx.lineWidth = Math.max(1, (focal * 0.7) / base.z);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(crown.x, crown.y);
        ctx.stroke();
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.ellipse(crown.x, (crown.y + t.y) / 2, radius, Math.max(radius * 0.9, Math.abs(crown.y - t.y) * 0.8), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Walls facing the canopy (darker on the sides), then the roof.
        const pts = obj.pts;
        for (let i = 0; i < pts.length; i += 1) {
          const a = pts[i];
          const c = pts[(i + 1) % pts.length];
          const nx = c.y - a.y;
          const ny = -(c.x - a.x);
          if (nx * (eye.x - a.x) + ny * (eye.y - a.y) <= 0) continue;
          const wall = polygon([a, c, { ...c, e: obj.height }, { ...a, e: obj.height }]);
          fill(wall, obj.wall);
          // Walls facing east or west are a little darker, so the building's shape reads.
          if (Math.abs(nx) > Math.abs(ny)) fill(wall, 'rgba(0,0,0,.2)');
        }
        fill(polygon(pts.map((q) => ({ ...q, e: obj.height }))), obj.roof);
      }
    }


    if (guides) {
      const p = flight.points;
      const ring = polygon(holdingShape(p.H, run.setaHeading));
      if (ring.length > 2) {
        ctx.beginPath();
        ring.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = color('--nav-guide');
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Points A, B and C as see-through pillars rising from the ground, so they can be seen
      // looking ahead: as wide as the area that counts as reaching the point, with a brighter band
      // at the ideal height to enter it. Yellow until reached, then green.
      const stroke = (pts, style, width) => {
        if (pts.length < 2) return;
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.stroke();
      };
      const pillars = ['A', 'B', 'C']
        .map((name) => ({ name, at: p[name], dist: Math.hypot(p[name].x - flight.x, p[name].y - flight.y) }))
        .sort((a, b) => b.dist - a.dist);
      for (const { name, at, dist } of pillars) {
        const pass = flight.passes[name];
        const rgb = pass && pass.distM <= PATTERN.reachM ? PILLAR.done : PILLAR.todo;
        const r = PATTERN.reachM;
        const topM = PILLAR[name].topFt * FT;
        const [lowM, highM] = PILLAR[name].entryFt.map((ft) => ft * FT);
        const ringAt = (e) => polygon(circle(at, r, 28).map((q) => ({ ...q, e })));
        fill(ringAt(0), `rgba(${rgb},.45)`);
        // The body, and the entry band filled more strongly: each the outline of the cylinder
        // between two heights (skipped while flying inside the pillar).
        if (dist > r) {
          const slab = (e0, e1) => {
            const cam = [...circle(at, r, 24).map((q) => ({ ...q, e: e0 })), ...circle(at, r, 24).map((q) => ({ ...q, e: e1 }))].map(camera);
            return cam.every((q) => q.z >= near) ? hull(cam.map(project)) : null;
          };
          const body = slab(0, topM);
          if (body) {
            fill(body, `rgba(${rgb},.13)`);
            stroke(body, `rgba(${rgb},.55)`, 1.2);
          }
          const band = slab(lowM, highM);
          if (band) fill(band, `rgba(${rgb},.55)`);
        }
        stroke(ringAt(topM), `rgba(${rgb},.6)`, 1.5);
        stroke(ringAt(lowM), `rgb(${rgb})`, 2.5);
        stroke(ringAt(highM), `rgb(${rgb})`, 2.5);
        // The label above the pillar (kept on screen when the top is above the view).
        const top = camera({ ...at, e: topM });
        if (top.z < near) continue;
        const s = project(top);
        if (s.x < -40 || s.x > w + 40 || s.y > h) continue;
        ctx.font = `800 ${Math.max(12, Math.min(20, 3000 / top.z))}px Archivo, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.strokeStyle = 'rgba(0,0,0,.65)';
        ctx.lineWidth = 3;
        const y = Math.max(18, s.y - 8);
        ctx.strokeText(name, s.x, y);
        ctx.fillText(name, s.x, y);
      }
    }

    this.drawFirstPerson(ctx, w, h, flight, look, { pitchDeg: (pitch * 180) / Math.PI, focal, cy });
  }

  /**
   * First person: the canopy overhead, the lines, the hands on the toggles and the boots.
   * The canopy is placed where it really is, about 30° above the horizon, with the same camera
   * as the scenery: looking up, the horizon comes into view first and the canopy only past it;
   * looking ahead or down it is above the frame, and only its lines show, running up from the
   * hands. Hands and boots follow the look: looking down brings the legs in, looking up moves
   * the hands out of view. A held turn pulls that hand down (and banks the canopy a little);
   * the flare (while held) pulls both down.
   */
  drawFirstPerson(ctx, w, h, flight, look, { pitchDeg, focal, cy }) {
    if (Math.abs(look.yaw) > 75) return; // looking behind: the canopy and body are out of view
    const dx = -look.yaw * (w / 70);
    const dy = look.pitch * (h / 55);
    const flared = Boolean(flight.flaring);
    const pullL = flared ? 0.14 : flight.turning < 0 ? 0.1 : 0;
    const pullR = flared ? 0.14 : flight.turning > 0 ? 0.1 : 0;
    const suit = '#2F5DB8';
    const glove = '#22262D';

    // Boots and legs, coming up from the bottom of the view: barely the boot tips when looking
    // ahead, the legs reaching toward the middle when looking down.
    const down = Math.min(Math.max(look.pitch / 60, 0), 1);
    for (const side of [-1, 1]) {
      const hip = { x: w * (0.5 + side * (0.1 + 0.04 * down)) + dx, y: h * 1.3 };
      const boot = { x: w * (0.5 + side * 0.07) + dx, y: h * (1.06 - 0.5 * down) };
      ctx.strokeStyle = suit;
      ctx.lineCap = 'round';
      ctx.lineWidth = w * 0.11;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(boot.x, boot.y); ctx.stroke();
      ctx.fillStyle = glove;
      ctx.beginPath(); ctx.ellipse(boot.x, boot.y - h * 0.02, w * 0.055, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    }

    // The canopy's leading edge overhead: cells across the top, yellow with a black center.
    const hands = {
      L: { x: w * 0.17 + dx, y: h * (0.86 + pullL) - dy },
      R: { x: w * 0.83 + dx, y: h * (0.86 + pullR) - dy },
    };
    // Where the canopy's leading edge is on screen: 30° above the horizon, seen from the camera
    // that looks pitchDeg below it. Far above the frame when looking ahead or down.
    // The canopy spreads from its leading edge (30° up, in front) to nearly overhead (80° up).
    const screenY = (elevation) => {
      const above = elevation + pitchDeg; // degrees above the middle of the view
      return above >= 85 ? -3 * h : cy - focal * Math.tan((above * Math.PI) / 180);
    };
    const edgeY = screenY(30);
    const topY = screenY(80);
    ctx.save();
    ctx.translate(w / 2 + dx, 0);
    ctx.rotate(((flight.turning || 0) * 5 * Math.PI) / 180);
    const cells = 9;
    const span = w * 1.5;
    const edge = (t) => ({ x: -span / 2 + span * t, y: edgeY - Math.sin(Math.PI * t) * h * 0.05 });
    const top = (t) => ({ x: -span / 2 + span * t, y: topY - Math.sin(Math.PI * t) * h * 0.06 });
    for (let i = 0; i < cells; i += 1) {
      const t0 = i / cells;
      const t1 = (i + 1) / cells;
      const [a, b, c, d] = [edge(t0), edge(t1), top(t1), top(t0)];
      ctx.fillStyle = i >= 3 && i <= 5 ? '#16181C' : '#F5B400';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Lines from the canopy down to the hands.
    ctx.strokeStyle = 'rgba(30,30,30,.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i += 1) {
      const p = edge(i / cells);
      const hand = i <= cells / 2 ? hands.L : hands.R;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(hand.x - (w / 2 + dx), hand.y); ctx.stroke();
    }
    ctx.restore();

    // Arms and hands on the toggles (above the view when looking down).
    if (look.pitch > 30) return;
    for (const [side, hand] of [[-1, hands.L], [1, hands.R]]) {
      const shoulder = { x: w * (0.5 + side * 0.62) + dx, y: h * 1.25 - dy };
      ctx.strokeStyle = suit;
      ctx.lineWidth = w * 0.09;
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
      ctx.fillStyle = '#FF7A1A'; // the toggle
      ctx.fillRect(hand.x - w * 0.012, hand.y - h * 0.075, w * 0.024, h * 0.05);
      ctx.fillStyle = glove;
      ctx.beginPath(); ctx.arc(hand.x, hand.y, w * 0.045, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** The small map: its ground is drawn once per flight (or when guides change); each frame moves the canopy. */
  drawMiniMap(flight, run, guides) {
    const key = `${run.setaHeading}|${guides}|${flight.points.A.x}`;
    if (this.miniKey !== key) {
      this.miniKey = key;
      const root = svg('svg', { viewBox: `${-MINI_RANGE} ${-MINI_RANGE} ${MINI_RANGE * 2} ${MINI_RANGE * 2}`, role: 'img' });
      root.setAttribute('aria-label', this.t('navigation.flight.mapLabel'));
      appendDropzone(root, MINI_RANGE);
      appendTarget(root, 1.6);
      appendSetaRing(root, 1.5);
      root.append(svg('polygon', { class: 'nm-seta', points: toPoints(setaShape(setaCenter(run.setaHeading), run.setaHeading, SETA.length * 1.5)) }));
      if (guides) {
        const p = flight.points;
        root.append(svg('polygon', { class: 'nm-holding', points: toPoints(holdingShape(p.H, run.setaHeading)) }));
        root.append(svg('polyline', { class: 'nm-path', points: toPoints([p.A, p.B, p.C, p.X]) }));
      }
      this.miniTrack = svg('polyline', { class: 'nm-track' });
      this.miniYou = svg('g', { class: 'nm-you' });
      this.miniYou.append(svg('path', { d: 'M0 -80 L50 45 L0 22 L-50 45 Z' }));
      root.append(this.miniTrack, this.miniYou);
      this.miniMap.replaceChildren(root);
    }
    this.miniTrack.setAttribute('points', toPoints([...flight.track, flight]));
    this.miniYou.setAttribute('transform', `translate(${mx(flight).toFixed(1)} ${my(flight).toFixed(1)}) rotate(${flight.heading.toFixed(1)})`);
  }

  /**
   * The altimeter: a student altimeter like the Alti-Master (one turn is 12,000 ft, 0 at the top,
   * 6 at the bottom, a fine 1–9 scale for hundreds, red to 2,500 ft and yellow to 3,000 ft), with
   * the altitude in small numbers below it.
   */
  drawAltimeter(altFt) {
    // To the nearest 10 ft, or the exact foot near the ground (where the flare happens at 6–7 ft).
    const ft = Math.max(0, altFt < 100 ? Math.round(altFt) : Math.round(altFt / 10) * 10);
    this.altimeter.dataset.mode = 'analog';
    this.altimeter.setAttribute('aria-label', `${this.t('navigation.flight.altimeter')}: ${ft} ${this.t('navigation.flight.feet')}`);
    if (!this.dial) {
      const TURN = 12000;
      const angle = (feet) => (feet / TURN) * Math.PI * 2;
      const at = (feet, r) => ({ x: Math.sin(angle(feet)) * r, y: -Math.cos(angle(feet)) * r });
      const sector = (from, to, r) => {
        const a = at(from, r);
        const b = at(to, r);
        return `M0 0 L${a.x.toFixed(2)} ${a.y.toFixed(2)} A${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
      };
      const root = svg('svg', { viewBox: '-50 -50 100 100', class: 'alt-dial' });
      root.append(svg('rect', { class: 'alt-bezel', x: -50, y: -50, width: 100, height: 100, rx: 9 }));
      root.append(svg('circle', { class: 'alt-face', r: 45 }));
      root.append(svg('path', { class: 'alt-red', d: sector(0, 2500, 33) }));
      root.append(svg('path', { class: 'alt-yellow', d: sector(2500, 3000, 33) }));
      // Ticks: long every 1,000 ft, short every 500.
      for (let v = 0; v < TURN; v += 500) {
        const major = v % 1000 === 0;
        const a = at(v, 41.5);
        const b = at(v, major ? 34.5 : 38);
        root.append(svg('line', { class: major ? 'alt-tick is-major' : 'alt-tick', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
        if (major) {
          const p = at(v, 26.5);
          const label = svg('text', { class: 'alt-num', x: p.x, y: p.y + 3.6, 'text-anchor': 'middle' });
          label.textContent = String(v / 1000);
          root.append(label);
        }
      }
      // Fine scale between 0 and 1: hundreds of feet, numbered 1–9.
      for (let v = 100; v < 1000; v += 100) {
        const a = at(v, 41.5);
        const b = at(v, 39);
        root.append(svg('line', { class: 'alt-fine', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
        const p = at(v, 36.6);
        const label = svg('text', { class: 'alt-fine-num', x: p.x, y: p.y + 1.1, 'text-anchor': 'middle' });
        label.textContent = String(v / 100);
        root.append(label);
      }
      const unitLabel = svg('text', { class: 'alt-unit', x: -8, y: -11, 'text-anchor': 'middle' });
      unitLabel.textContent = "x 1000'";
      root.append(unitLabel);
      this.needle = svg('g', { class: 'alt-needle' });
      this.needle.append(svg('path', { class: 'alt-needle-tail', d: 'M-2.2 0 L-1.3 13 L1.3 13 L2.2 0 Z' }));
      this.needle.append(svg('path', { class: 'alt-needle-pointer', d: 'M-1.8 0 L0 -40 L1.8 0 Z' }));
      root.append(this.needle, svg('circle', { class: 'alt-hub', r: 3 }));
      this.dial = root;
    }
    this.needle.setAttribute('transform', `rotate(${((altFt % 12000) / 12000) * 360})`);
    if (!this.dialReadout) this.dialReadout = el('span', 'alt-readout');
    this.dialReadout.textContent = `${ft.toLocaleString(this.t('meta.lang'))} ${this.t('navigation.flight.feet')}`;
    if (this.altimeter.firstChild !== this.dial) this.altimeter.replaceChildren(this.dial, this.dialReadout);
  }

  /** Show which speed is picked: 'regular' (real time) or 'fast'. */
  setSpeed(speed) {
    for (const b of this.speedButtons) b.setAttribute('aria-pressed', String(b.dataset.speed === speed));
  }

  setPaused(paused) {
    this.pauseButton.textContent = this.t(paused ? 'navigation.flight.play' : 'navigation.flight.pause');
    this.pauseButton.setAttribute('aria-pressed', String(paused));
  }

  /* ---------- Report ---------- */

  renderReport(report) {
    const t = (k, p) => this.t(`navigation.report.${k}`, p);
    const n = (v) => (v === null || v === undefined ? v : v.toLocaleString(this.t('meta.lang'))); // 1.010 and 6,5 in Portuguese
    const item = (ok, text, alert = false) => {
      const li = el('li', ok ? 'is-ok' : alert ? 'is-off is-alert' : 'is-off');
      li.append(el('span', 'rep-mark', ok ? '✓' : '!'), el('span', '', text));
      li.firstChild.setAttribute('aria-hidden', 'true');
      return li;
    };
    const rows = report.points.map((p) => {
      const label = t('point', { name: p.name, target: n(p.targetFt) });
      let detail;
      if (p.distM === null) detail = t('notNear', { low: n(p.targetFt - PATTERN.toleranceFt), high: n(p.targetFt + PATTERN.toleranceFt) });
      else detail = t(p.reached ? 'reached' : 'far', { dist: n(p.distM), alt: n(p.altFt) });
      return item(p.reached, `${label}: ${detail}`);
    });
    rows.push(item(report.rightTurns === 0, report.rightTurns === 0 ? t('rightTurns.zero') : t('rightTurns', { count: report.rightTurns }), report.rightTurns > 0));
    rows.push(item(report.lowTurns === 0, report.lowTurns === 0 ? t('lowTurns.zero') : t('lowTurns', { count: report.lowTurns }), report.lowTurns > 0));
    rows.push(item(report.flare === 'good', t(`flare.${report.flare}`, { alt: n(report.flareAltFt) }), report.flare === 'released'));
    rows.push(item(report.landing.grade !== 'missed', t(`landing.${report.landing.grade}`, { dist: n(report.landing.distM) })));
    this.reportList.replaceChildren(...rows);

    const notes = [];
    if (report.clean && report.landing.grade !== 'missed') notes.push(t('clean'));
    else if (!report.clean && report.landing.grade !== 'missed') notes.push(t('praise'));
    if (report.landing.grade !== 'legendary') notes.push(t('tip'));
    this.reportNotes.replaceChildren(...notes.map((n) => el('p', '', n)));
  }
}
