/**
 * Navigation simulator entry point: plan the pattern, fly it, read the report.
 *   plan:   paused at 3000 ft, the student picks the holding area, A, B and C from options;
 *           a wrong pick shows a hint, and the flight only starts when all four are right.
 *   flight: hold left/right to turn, hold the flare; real time, or 4× faster if the student picks it.
 *   report: after landing, what went well and what to work on.
 */
import { CONFIG } from '../config.js';
import { loadMessages, createTranslator } from '../i18n.js';
import { currentLocale } from '../locale.js';
import { applyTranslations } from '../view.js';
import { mountSiteMenu } from '../nav.js';
import { patternPoints, planOptions, newRun, PLAN_STEPS } from './pattern.js';
import { createFlight, step, setTurn, setFlare, setFast, timeScale } from './flight.js';
import { buildReport } from './report.js';
import { NavigationView } from './view.js';

/** Longest simulated step per frame, so a hidden tab doesn't jump the canopy. */
const MAX_DT = 0.05;
const SETTINGS = { guides: ['visible', 'hidden'], speed: ['regular', 'fast'] };
const settingKey = (name) => `qp.nav.${name}`;

function loadSetting(name, fallback) {
  try {
    const v = localStorage.getItem(settingKey(name));
    return SETTINGS[name].includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function saveSetting(name, value) {
  try {
    localStorage.setItem(settingKey(name), value);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

async function init() {
  const locale = currentLocale(CONFIG);
  const t = createTranslator(await loadMessages(CONFIG.i18nPath, locale), locale);
  applyTranslations(document, t, 'navigation.meta.title');
  mountSiteMenu(document.querySelector('[data-site-nav]'), t);

  const view = new NavigationView(document, t);
  const settings = { guides: loadSetting('guides', 'visible'), speed: loadSetting('speed', 'regular') };
  view.setSettings(settings);
  view.setSpeed(settings.speed);
  const redraw = () => view.drawFlight({ flight, run, guides: settings.guides === 'visible', fast: timeScale(flight) > 1 });

  let run;
  let points;
  let plan; // { stepIndex, placed, options }
  let flight = null;
  let paused = false;
  let last = null;

  const renderPlan = () => {
    const stepName = PLAN_STEPS[plan.stepIndex] || null;
    view.renderPlan({ run, points, placed: plan.placed, step: stepName, options: stepName ? plan.options : null });
  };

  function startRun() {
    run = newRun();
    points = patternPoints(run.setaHeading);
    plan = { stepIndex: 0, placed: {}, options: planOptions(points, PLAN_STEPS[0], run.setaHeading) };
    flight = null;
    view.planMessage(t('navigation.plan.seta'), 'info');
    view.showPhase('plan');
    renderPlan();
  }

  function choose(index) {
    const option = plan.options[index];
    const stepName = PLAN_STEPS[plan.stepIndex];
    if (!option || !stepName) return;
    if (!option.correct) {
      view.planMessage(t(`navigation.plan.hints.${option.mistake}`), 'hint');
      return;
    }
    plan.placed[stepName] = option.pos;
    plan.stepIndex += 1;
    const next = PLAN_STEPS[plan.stepIndex];
    plan.options = next ? planOptions(points, next, run.setaHeading) : null;
    // Say why it's right, so the choice is understood and not just guessed.
    view.planMessage(t(`navigation.plan.why.${stepName}`), 'right', t('navigation.plan.right'));
    renderPlan();
  }

  function frame(now) {
    if (!flight || paused) return;
    const real = last === null ? 0 : Math.min((now - last) / 1000, MAX_DT);
    last = now;
    const scale = timeScale(flight);
    step(flight, real * scale);
    view.drawFlight({ flight, run, guides: settings.guides === 'visible', fast: scale > 1 });
    if (flight.landed) {
      view.renderReport(buildReport(flight));
      view.showPhase('report');
      return;
    }
    requestAnimationFrame(frame);
  }

  function startFlight() {
    flight = setFast(createFlight(run, points), settings.speed === 'fast');
    paused = false;
    last = null;
    view.setPaused(false);
    view.resetLook();
    view.showPhase('flight');
    view.sized = false;
    requestAnimationFrame(frame);
  }

  view.bind({
    onChoose: choose,
    onStart: startFlight,
    onTurn: (dir) => flight && setTurn(flight, paused ? 0 : dir),
    onFlare: (on) => flight && setFlare(flight, paused ? false : on),
    onPause: () => {
      if (!flight) return;
      paused = !paused;
      if (paused) { setTurn(flight, 0); setFlare(flight, false); }
      view.setPaused(paused);
      last = null;
      if (!paused) requestAnimationFrame(frame);
    },
    onAgain: startRun,
    onSetting: (input, value) => {
      const name = input.replace('nav-', '');
      settings[name] = value;
      saveSetting(name, value);
      if (flight && paused) redraw();
    },
    onSpeed: (speed) => {
      settings.speed = speed;
      saveSetting('speed', speed);
      view.setSpeed(speed);
      if (flight) setFast(flight, speed === 'fast');
      if (flight && paused) redraw();
    },
  });

  startRun();
}

init().catch((error) => console.error(error));
