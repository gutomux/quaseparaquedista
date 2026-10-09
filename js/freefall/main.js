/**
 * Freefall page entry point: detect the locale, load interface text,
 * then run the animation loop. The loop asks sim.js where the jumper is
 * and hands the result to the view.
 */
import { CONFIG } from '../config.js';
import { loadMessages, createTranslator } from '../i18n.js';
import { currentLocale } from '../locale.js';
import { applyTranslations } from '../view.js';
import { CONTROLS, GROUPS, NEUTRAL, SPEED, isOn, toggle, activeControls, comboNote, describe, createState, step } from './sim.js';
import { FreefallView } from './view.js';
import { mountSiteMenu } from '../nav.js';

/** The button the first-visit tip suggests, and where its dismissal is remembered. */
const TIP_CONTROL = 'legsStretch';
const TIP_DONE_KEY = 'qp.freefallTipDone';

function tipDone() {
  try {
    return localStorage.getItem(TIP_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function markTipDone() {
  try {
    localStorage.setItem(TIP_DONE_KEY, '1');
  } catch {
    // Storage blocked: the tip just shows again next visit.
  }
}

/** How quickly the drawn limbs follow a new pose, in seconds. */
const POSE_SECONDS = 0.3;
/** Longest frame step, so a hidden tab doesn't make the jumper jump. */
const MAX_DT = 0.05;

async function init() {
  const locale = currentLocale(CONFIG);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, 'freefall.meta.title');
  mountSiteMenu(document.querySelector('[data-site-nav]'), t);

  const view = new FreefallView(document, t, CONTROLS, GROUPS);
  let pose = { ...NEUTRAL };
  let shown = { ...NEUTRAL };
  let state = createState();
  // With reduced motion requested (on Windows: Animation effects turned off), start paused,
  // say so in the scene, and start on the first position button. A visitor's own Pause wins.
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let waitingForStart = paused;
  let last = null;

  const render = () => view.renderPose(activeControls(pose), describe(pose), comboNote(pose));
  const setPose = (next) => {
    pose = next;
    render();
    if (paused) frame(performance.now(), true);
  };

  function frame(now, settle = false) {
    const dt = settle ? 1 : Math.min(last === null ? 0 : (now - last) / 1000, MAX_DT);
    last = now;
    const k = 1 - Math.exp(-dt / (POSE_SECONDS / 3));
    for (const key of Object.keys(shown)) shown[key] += (pose[key] - shown[key]) * k;
    // A settle frame (on load, or a change while paused) only moves the figure into the pose.
    const moving = !paused && !settle;
    if (moving) state = step(state, pose, dt, SPEED.drift, SPEED.fall);
    view.draw({ pose: shown, state, dt: moving ? dt : 0 });
    if (moving) requestAnimationFrame(frame);
  }

  const setPaused = (next) => {
    paused = next;
    waitingForStart = false;
    view.setPaused(paused);
    view.setMotionNote(false);
    updateTip();
    last = null;
    if (!paused) requestAnimationFrame(frame);
  };

  // First visit: suggest a button to start with (after the reduced-motion notice, if any).
  let showTip = !tipDone();
  const updateTip = () => view.setTip(showTip && !waitingForStart, TIP_CONTROL);
  const finishTip = () => {
    if (!showTip) return;
    showTip = false;
    markTipDone();
    updateTip();
  };

  const pressControl = (id) => {
    if (waitingForStart) setPaused(false);
    finishTip();
    setPose(toggle(pose, id));
    // On phones the full explanation is below the buttons; show it briefly over the scene too.
    if (isOn(pose, id)) view.flashExplanation(t(`freefall.explain.${id}`));
  };

  view.bind({
    onToggle: pressControl,
    onTipTry: () => pressControl(TIP_CONTROL),
    onTipClose: finishTip,
    onReset: () => {
      state = { ...state, x: 0, y: 0, heading: 0 };
      setPose({ ...NEUTRAL });
    },
    onPause: () => setPaused(!paused),
    onStart: () => setPaused(false),
  });

  render();
  view.setPaused(paused);
  view.setMotionNote(waitingForStart);
  updateTip();
  frame(performance.now(), true);
  if (!paused) requestAnimationFrame(frame);
}

init().catch((error) => {
  console.error(error);
  document.querySelector('#caption').textContent = 'The page text could not be loaded. Refresh the page to try again.';
});
