/**
 * Freefall page view: builds the scene and controls, draws each frame,
 * and reports button presses through callbacks. It holds no flight logic;
 * main.js asks sim.js what happens and passes the results in here.
 * All text is inserted with textContent, never innerHTML.
 */
import { JumperFigure } from './figure.js';
import { createDot, stepDots, isDeflected } from './air.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Scene size in SVG units, centered on the jumper's starting point. */
export const SCENE = Object.freeze({ width: 400, height: 260 });
const DOT_COUNT = 110;
/** Air speed past the jumper at the neutral fall rate, in scene units per second. */
const AIR_SPEED = 240;

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

export class FreefallView {
  /**
   * @param {Document|HTMLElement} root
   * @param {Function} t Translator from createTranslator().
   * @param {Array<{id: string, group: string}>} controls From sim.js.
   * @param {string[]} groups Group order for the button sets.
   */
  constructor(root, t, controls, groups) {
    this.root = root;
    this.t = t;
    this.scene = root.querySelector('#scene');
    this.controlsBox = root.querySelector('#controls');
    this.caption = root.querySelector('#caption');
    this.status = root.querySelector('#movement');
    this.pauseButton = root.querySelector('#pause');
    this.resetButton = root.querySelector('#reset');
    this.motionNote = root.querySelector('#motion-note');
    this.startButton = root.querySelector('#motion-start');
    this.buttons = new Map();

    this.buildScene();
    this.buildControls(controls, groups);
  }

  buildScene() {
    const { width: w, height: h } = SCENE;
    const root = svg('svg', { viewBox: `${-w / 2} ${-h / 2} ${w} ${h}`, role: 'img' });
    root.setAttribute('aria-label', this.t('freefall.sceneLabel'));

    // Air dots flow around the jumper (see air.js); dots the body has just turned are highlighted.
    this.bounds = { left: -w / 2, top: -h / 2, width: w, height: h };
    this.dotLayer = svg('g', { class: 'ff-air' });
    this.dots = Array.from({ length: DOT_COUNT }, () => createDot(this.bounds));
    this.dotNodes = this.dots.map(() => {
      const node = svg('circle');
      this.dotLayer.append(node);
      return node;
    });

    this.figure = new JumperFigure('side', 1.9);

    // Heading compass: the same jumper seen from above, in the corner.
    const r = 34;
    this.compass = svg('g', { class: 'ff-compass', transform: `translate(${w / 2 - r - 10} ${-h / 2 + r + 10})` });
    this.topFigure = new JumperFigure('top', 0.62);
    const label = svg('text', { class: 'ff-compass-label', y: r + 13, 'text-anchor': 'middle' });
    label.textContent = this.t('freefall.topView');
    this.compass.append(svg('circle', { class: 'ff-compass-ring', r }), this.topFigure.node, label);

    root.append(this.dotLayer, this.figure.node, this.compass);
    this.scene.replaceChildren(root);
  }

  buildControls(controls, groups) {
    const sets = groups.map((group) => {
      const set = el('fieldset', 'ff-group');
      set.append(el('legend', '', this.t(`freefall.groups.${group}`)));
      for (const control of controls.filter((c) => c.group === group)) {
        const button = el('button', 'ff-toggle', this.t(`freefall.controls.${control.id}`));
        button.type = 'button';
        button.dataset.control = control.id;
        button.setAttribute('aria-pressed', 'false');
        this.buttons.set(control.id, button);
        set.append(button);
      }
      return set;
    });
    this.controlsBox.replaceChildren(...sets);
  }

  /**
   * @param {object} handlers
   * @param {(id: string) => void} handlers.onToggle
   * @param {() => void} handlers.onReset
   * @param {() => void} handlers.onPause
   * @param {() => void} handlers.onStart The reduced-motion notice's start button.
   */
  bind({ onToggle, onReset, onPause, onStart }) {
    this.controlsBox.addEventListener('click', (e) => {
      const button = e.target.closest('[data-control]');
      if (button) onToggle(button.dataset.control);
    });
    this.resetButton.addEventListener('click', onReset);
    this.pauseButton.addEventListener('click', onPause);
    this.startButton.addEventListener('click', onStart);
  }

  /**
   * Show which buttons are on, and explain the current position.
   * @param {string[]} activeIds
   * @param {{move: string, fall: string|null, turn: string|null}} description From sim.describe().
   * @param {string|null} combo From sim.comboNote(): an extra note for a combination.
   */
  renderPose(activeIds, description, combo = null) {
    for (const [id, button] of this.buttons) button.setAttribute('aria-pressed', String(activeIds.includes(id)));

    const lines = activeIds.length
      ? activeIds.map((id) => this.t(`freefall.explain.${id}`))
      : [this.t('freefall.explain.neutral')];
    const paragraphs = lines.map((text) => el('p', '', text));
    if (combo) paragraphs.push(el('p', 'ff-combo', this.t(`freefall.combos.${combo}`)));
    this.caption.replaceChildren(...paragraphs);

    // e.g. "Neutro, com maior razão de queda, curva para a direita"
    this.status.textContent = [
      this.t(`freefall.status.move.${description.move}`),
      description.fall && this.t(`freefall.status.fall.${description.fall}`),
      description.turn && this.t(`freefall.status.turn.${description.turn}`),
    ].filter(Boolean).join(', ');
  }

  /** Show or hide the notice that the animation waits because the system asks for reduced motion. */
  setMotionNote(visible) {
    this.motionNote.hidden = !visible;
  }

  setPaused(paused) {
    this.pauseButton.textContent = this.t(paused ? 'freefall.play' : 'freefall.pause');
    this.pauseButton.setAttribute('aria-pressed', String(paused));
  }

  /**
   * Draw one frame.
   * @param {object} frame
   * @param {object} frame.pose Eased pose for the figure.
   * @param {object} frame.state From sim.step(); x and y are in scene units.
   * @param {number} frame.dt Seconds since the last frame.
   */
  draw({ pose, state, dt }) {
    const { width: w, height: h } = SCENE;
    const { flight } = state;

    // Off one edge, back in at the other, sideways and up/down alike.
    const wrap = (value, span) => ((((value + span / 2) % span) + span) % span) - span / 2;
    const x = wrap(state.x, w + 80);
    const y = wrap(state.y, h + 90);
    const rock = flight.wobble * 9 * Math.sin(state.time * 2 * Math.PI * 1.1);
    const view = { heading: state.heading, tilt: flight.drift * 6, rock };
    this.figure.update(pose, { ...view, x, y });
    this.topFigure.update(pose, view);

    // Move the air after the body, so the dots meet the body where it is drawn this frame.
    stepDots(this.dots, {
      dt,
      time: state.time,
      speed: AIR_SPEED * flight.fallRate,
      body: this.figure.capsules(),
      center: { x, y },
      bounds: this.bounds,
    });
    this.dots.forEach((dot, i) => {
      const node = this.dotNodes[i];
      if (node.dot !== dot) {
        // A new dot (at the start, or recycled at the bottom): size and fade by depth.
        node.dot = dot;
        node.setAttribute('r', (0.8 + dot.depth * 1.6).toFixed(2));
        node.setAttribute('opacity', (0.25 + dot.depth * 0.5).toFixed(2));
      }
      node.setAttribute('cx', dot.x.toFixed(1));
      node.setAttribute('cy', dot.y.toFixed(1));
      node.classList.toggle('is-deflected', isDeflected(dot, state.time));
    });
  }
}
