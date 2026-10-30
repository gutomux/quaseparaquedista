/**
 * The landing report as an Instagram story (1080 × 1920), styled like a game's results screen:
 * a drawn sky, "Simulador de navegação" as the game mode, a rank in its tier color (like the
 * rarity tiers of games), the distance to the target, the pattern flown seen from above, a few
 * badges and the site address.
 *
 * `storyContent` and `storyFrame` decide what goes on it (pure, tested); `drawStory` paints it
 * on a canvas, in the page's language. Nothing leaves the browser.
 */
import { buildDropzone, PALETTE } from './dropzone.js';
import { SETA, setaShape } from './view.js';

export const STORY = Object.freeze({ width: 1080, height: 1920 });

/**
 * Where things sit on the story (px), each in its own band so nothing overlaps: the mode label
 * (below Instagram's profile bar at the top), the rank (at most two lines) and its distance line,
 * the map (a square card), up to two rows of badges and the address. Instagram puts its reply bar
 * over the bottom of a story, so the address ends about 160 px above the bottom edge.
 */
const LAYOUT = {
  side: 80,
  modeY: 270,
  rank: { top: 300, maxLines: 2, size: 150, minSize: 64 },
  distanceY: 555,
  map: { x: 170, y: 610, size: 740 },
  badges: { top: 1385, rowH: 112, gap: 18 },
  siteY: 1715,
};
/**
 * The ranks, best first, each in its tier's color (as in games: gold, purple, blue, gray).
 * "wasted" replaces any of them after a mistake that hurts people at landing.
 */
export const RANKS = Object.freeze({
  legendary: '#F5B400',
  epic: '#A65CF2',
  rare: '#3D8BFF',
  almost: '#C3C9D2',
  wasted: '#E5342B',
});
const RANK_BY_GRADE = Object.freeze({ legendary: 'legendary', great: 'epic', goal: 'rare', missed: 'almost' });
const INK = '#111317';
const ACCENT = '#F5B400';
const ALERT = '#D93025';
const REACHED = '#3FBF74';
const DISPLAY = 'Archivo, "Arial Black", sans-serif';
const BODY = '"Atkinson Hyperlegible", Arial, sans-serif';

/**
 * What the story says, from the report: the rank and up to four badges.
 * The rank comes from the landing distance, unless there was a sharp turn below 300 ft or the
 * flare was let go before touchdown: then it's "wasted", whatever the distance, so the story
 * never celebrates a landing that would hurt. Each badge is ok (✓), off (to improve) or alert
 * (a serious mistake, in red).
 * @returns {{rank: string, badges: Array<{kind: 'ok'|'off'|'alert', key: string, params?: object}>}}
 */
export function storyContent(report) {
  const reached = report.points.filter((p) => p.reached).length;
  const badges = [
    reached === 3 ? { kind: 'ok', key: 'points.all' } : { kind: 'off', key: 'points.some', params: { count: reached } },
    report.rightTurns === 0 ? { kind: 'ok', key: 'rightTurns.zero' } : { kind: 'alert', key: 'rightTurns', params: { count: report.rightTurns } },
  ];
  if (report.lowTurns > 0) badges.push({ kind: 'alert', key: 'lowTurns', params: { count: report.lowTurns } });
  const flareKind = report.flare === 'good' ? 'ok' : report.flare === 'released' ? 'alert' : 'off';
  badges.push({ kind: flareKind, key: `flare.${report.flare}` });
  const wasted = report.lowTurns > 0 || report.flare === 'released';
  return { rank: wasted ? 'wasted' : RANK_BY_GRADE[report.landing.grade], badges };
}

/**
 * The square of ground the story map shows: the pattern flown (track, points and landing) and
 * any `extra` spots (the seta), with a margin, centered. @returns {{cx: number, cy: number, half: number}} in meters.
 */
export function storyFrame(track, points, landing, extra = []) {
  const all = [...track, points.A, points.B, points.C, points.X, ...(landing ? [landing] : []), ...extra];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const half = Math.max(x1 - x0, y1 - y0, 400) / 2 * 1.18;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, half };
}

/** Load the site's fonts before drawing, or the canvas would use a fallback. */
async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all(['900 120px Archivo', '800 60px Archivo', '700 40px "Atkinson Hyperlegible"', '400 40px "Atkinson Hyperlegible"']
    .map((font) => document.fonts.load(font).catch(() => null)));
}

/** A tiny repeatable random, so the clouds sit in the same places every time. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawSky(ctx) {
  const { width: w, height: h } = STORY;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1F5FA8');
  sky.addColorStop(0.45, '#4B91D6');
  sky.addColorStop(0.8, '#9CCBF0');
  sky.addColorStop(1, '#D9EEFB');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Soft clouds: clusters of white puffs, denser toward the bottom.
  const random = seeded(1387);
  for (let i = 0; i < 14; i += 1) {
    const cx = random() * w;
    const cy = 200 + random() * (h - 200);
    const size = 70 + random() * 110;
    for (let j = 0; j < 6; j += 1) {
      const x = cx + (random() - 0.5) * size * 2.6;
      const y = cy + (random() - 0.5) * size * 0.5;
      const r = size * (0.5 + random() * 0.6);
      const puff = ctx.createRadialGradient(x, y, 0, x, y, r);
      puff.addColorStop(0, `rgba(255,255,255,${0.32 + (cy / h) * 0.3})`);
      puff.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Text with letter spacing where the browser supports it. */
function setFont(ctx, font, spacing = '0px') {
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing;
  if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
}

/** Split text into lines that fit `maxWidth` with the current font. */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Centered lines from `y` down; returns the y below the last line. */
function centered(ctx, lines, y, lineHeight) {
  lines.forEach((line, i) => ctx.fillText(line, STORY.width / 2, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

/** "SIMULADOR DE NAVEGAÇÃO": the game mode, small and spaced, over the rank. */
function drawMode(ctx, t) {
  setFont(ctx, `800 40px ${DISPLAY}`, '6px');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(17,19,23,.45)';
  ctx.shadowBlur = 12;
  ctx.fillText(t('navigation.story.mode').toLocaleUpperCase(t('meta.lang')), STORY.width / 2, LAYOUT.modeY);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

/** The rank, big, in its tier color with a dark outline; then the distance (not when wasted). */
function drawRank(ctx, t, rank, distM) {
  const { top, maxLines, size: biggest, minSize } = LAYOUT.rank;
  const width = STORY.width - LAYOUT.side * 2;
  const title = t(`navigation.story.rank.${rank}`).toLocaleUpperCase(t('meta.lang'));
  // As big as fits in two lines; a long rank ("Morridinha de leve pra sempre!") gets smaller.
  let size = biggest;
  let lines;
  for (;;) {
    setFont(ctx, `900 ${size}px ${DISPLAY}`);
    lines = wrap(ctx, title, width);
    if ((lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= width)) || size <= minSize) break;
    size -= 4;
  }
  // Centered in its band (lower when there's no distance line under it).
  const lineH = size * 1.02;
  const bottom = rank === 'wasted' ? LAYOUT.distanceY + 20 : LAYOUT.distanceY - 60;
  const y0 = top + (bottom - top - lines.length * lineH) / 2 + size * 0.85;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(8, size * 0.09);
  ctx.strokeStyle = INK;
  ctx.fillStyle = RANKS[rank];
  lines.forEach((line, i) => {
    ctx.strokeText(line, STORY.width / 2, y0 + i * lineH);
    ctx.fillText(line, STORY.width / 2, y0 + i * lineH);
  });
  if (rank === 'wasted') return;
  setFont(ctx, `700 50px ${BODY}`);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(17,19,23,.45)';
  ctx.shadowBlur = 14;
  ctx.fillText(t('navigation.story.landed', { dist: distM.toLocaleString(t('meta.lang')) }), STORY.width / 2, LAYOUT.distanceY, width);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DZ = buildDropzone();

/**
 * The square card in the middle of the story: a white frame with a shadow. What's drawn after
 * this is clipped to the card; call ctx.restore() when done.
 */
function openCard(ctx) {
  const { x, y, size } = LAYOUT.map;
  ctx.save();
  ctx.shadowColor = 'rgba(17,19,23,.35)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x - 14, y - 14, size + 28, size + 28, 48);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, size, size, 36);
  ctx.clip();
}

/**
 * For "Morridinha de leve pra sempre!": in place of the map, an homage to the "coffin dance"
 * meme, drawn here (not the photo): four pallbearers in black suits and sunglasses dancing with
 * a coffin on their shoulders, and a parachute open over the coffin.
 */
function drawCoffinDance(ctx) {
  const { x, y, size } = LAYOUT.map;
  const s = size / 740; // drawn on a 740 × 740 grid
  openCard(ctx);
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Evening sky, and the grass they dance on.
  const sky = ctx.createLinearGradient(0, 0, 0, 740);
  sky.addColorStop(0, '#9FCBEB');
  sky.addColorStop(0.7, '#F6DDB0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 740, 740);
  ctx.fillStyle = PALETTE.landing;
  ctx.fillRect(0, 640, 740, 100);
  ctx.fillStyle = PALETTE.landingStripe;
  for (let i = 0; i < 740; i += 80) ctx.fillRect(i, 640, 40, 100);

  // The parachute: a ram-air canopy, its cells in orange and yellow, lines down to the coffin.
  const canopy = { cx: 370, top: 70, w: 470, h: 96 };
  const cells = 7;
  const left = canopy.cx - canopy.w / 2;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(17,19,23,.7)';
  for (let i = 0; i <= cells; i += 1) {
    const cx = left + (canopy.w * i) / cells;
    const lift = Math.sin((Math.PI * i) / cells) * 26;
    for (const end of [{ x: 190 + (i / cells) * 360, y: 300 }]) {
      ctx.beginPath();
      ctx.moveTo(cx, canopy.top + canopy.h - lift + 6);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }
  for (let i = 0; i < cells; i += 1) {
    const x0 = left + (canopy.w * i) / cells;
    const x1 = left + (canopy.w * (i + 1)) / cells;
    const arc = (xx) => Math.sin((Math.PI * (xx - left)) / canopy.w) * 26;
    ctx.fillStyle = i % 2 ? ACCENT : '#FF6A13';
    ctx.beginPath();
    ctx.moveTo(x0, canopy.top + 30 - arc(x0));
    ctx.lineTo(x1, canopy.top + 30 - arc(x1));
    ctx.lineTo(x1, canopy.top + canopy.h - arc(x1));
    ctx.lineTo(x0, canopy.top + canopy.h - arc(x0));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // The coffin, seen from the side, with its lid and gold handles.
  const coffin = [[100, 330], [140, 292], [600, 292], [640, 330], [610, 372], [130, 372]];
  ctx.fillStyle = '#6B4026';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  coffin.forEach(([cx, cy], i) => (i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8A5634';
  ctx.fillRect(150, 300, 440, 22);
  ctx.fillStyle = ACCENT;
  for (const hx of [190, 330, 470]) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(hx, 342, 70, 12, 6) : ctx.rect(hx, 342, 70, 12);
    ctx.fill();
  }

  // Four pallbearers, each in a different step of the dance.
  const poses = [
    { x: 175, bob: 0, lean: -8, kick: 1 },
    { x: 295, bob: 14, lean: 6, kick: -1 },
    { x: 440, bob: 4, lean: -6, kick: 1 },
    { x: 565, bob: 16, lean: 8, kick: -1 },
  ];
  for (const p of poses) drawPallbearer(ctx, p);

  // Music notes: it's a dance.
  ctx.fillStyle = INK;
  setFont(ctx, `900 54px ${BODY}`);
  ctx.textAlign = 'center';
  ctx.fillText('♪', 80, 250);
  ctx.fillText('♫', 670, 230);
  ctx.fillText('♪', 690, 470);
  ctx.restore();
}

/** One pallbearer: shoulders under the coffin (y ≈ 372), feet on the grass (y ≈ 660). */
function drawPallbearer(ctx, { x, bob, lean, kick }) {
  const suit = '#16181D';
  const skin = '#6B4430';
  const shoulderY = 380 + bob;
  const hipY = 520 + bob;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Legs: knees bent, one foot kicked out.
  ctx.strokeStyle = suit;
  ctx.lineWidth = 30;
  for (const side of [-1, 1]) {
    const kneeX = x + side * 22 + (side === kick ? 26 * kick : 0);
    const footX = x + side * 30 + (side === kick ? 48 * kick : 0);
    const footY = side === kick ? 630 : 655;
    ctx.beginPath();
    ctx.moveTo(x + side * 14 + lean, hipY);
    ctx.lineTo(kneeX + lean / 2, 590);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(footX + 10 * Math.sign(footX - x || 1), footY + 10, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Body: the suit, a white shirt and a black tie.
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(x - 42 + lean, shoulderY);
  ctx.lineTo(x + 42 + lean, shoulderY);
  ctx.lineTo(x + 34, hipY + 10);
  ctx.lineTo(x - 34, hipY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x - 16 + lean, shoulderY);
  ctx.lineTo(x + 16 + lean, shoulderY);
  ctx.lineTo(x + lean * 0.6, shoulderY + 70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(x - 5 + lean * 0.8, shoulderY + 6, 10, 52);
  // Arms: one up holding the coffin, one out, dancing; white gloves.
  ctx.strokeStyle = suit;
  ctx.lineWidth = 22;
  const hands = [
    { from: -1, to: { x: x - 30 + lean, y: 360 } },
    { from: 1, to: { x: x + 70 * -lean / Math.abs(lean || 1), y: shoulderY + 60 } },
  ];
  for (const h of hands) {
    ctx.beginPath();
    ctx.moveTo(x + h.from * 36 + lean, shoulderY + 16);
    ctx.lineTo(h.to.x, h.to.y);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(h.to.x, h.to.y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head beside the coffin, with sunglasses.
  const hx = x + lean * 1.4;
  const hy = shoulderY - 18;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx, hy - 8, 31, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(hx - 28, hy - 2, 56, 14);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillRect(hx - 20, hy, 10, 4);
  ctx.fillRect(hx + 6, hy, 10, 4);
}

/** The pattern flown, from above (north up): ground, target, seta, points, track and landing. */
function drawMap(ctx, { flight, run, report }) {
  const { x, y, size } = LAYOUT.map;
  // The seta's whole ring stays in view.
  const reach = SETA.length * SETA.ring;
  const ring = [-1, 1].flatMap((d) => [{ x: SETA.at.x + d * reach, y: SETA.at.y }, { x: SETA.at.x, y: SETA.at.y + d * reach }]);
  const frame = storyFrame(flight.track, flight.points, flight.landing, ring);
  const scale = size / (frame.half * 2);
  const px = (p) => x + size / 2 + (p.x - frame.cx) * scale;
  const py = (p) => y + size / 2 - (p.y - frame.cy) * scale;
  const poly = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p))));
    ctx.closePath();
  };

  openCard(ctx);
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(x, y, size, size);
  for (const s of DZ.shapes) {
    ctx.fillStyle = s.color;
    poly(s.pts);
    ctx.fill();
  }
  for (const b of DZ.structures) {
    ctx.fillStyle = b.roof;
    poly(b.pts);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.tree;
  for (const tr of DZ.trees) {
    ctx.beginPath();
    ctx.arc(px(tr), py(tr), Math.max(tr.r * scale, 1.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // The seta (the wind arrow on the ground) at its real size, as on the planning map, with its ring.
  ctx.fillStyle = 'rgba(17,19,23,.25)';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(px(SETA.at), py(SETA.at), reach * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  poly(setaShape(SETA.at, run.setaHeading, SETA.length));
  ctx.fill();
  ctx.stroke();

  // The target.
  const target = { x: 0, y: 0 };
  ctx.fillStyle = PALETTE.gravel || '#D8CBB0';
  ctx.strokeStyle = ALERT;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(px(target), py(target), 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ALERT;
  ctx.beginPath();
  ctx.arc(px(target), py(target), 8, 0, Math.PI * 2);
  ctx.fill();

  // The track flown, dotted: dark dots with a white edge, so it reads on any ground.
  const track = [...flight.track, flight.landing || flight];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([0, 22]);
  for (const [color, width] of [['#FFFFFF', 17], [INK, 10]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    track.forEach((p, i) => (i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p))));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Points A, B and C: green when reached, yellow when not.
  setFont(ctx, `800 34px ${DISPLAY}`);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of report.points) {
    const at = flight.points[p.name];
    ctx.fillStyle = p.reached ? REACHED : ACCENT;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(px(at), py(at), 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(p.name, px(at), py(at) + 2);
  }

  // Where the canopy touched down.
  if (flight.landing) {
    const l = flight.landing;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 16;
    for (const pass of [['#FFFFFF', 16], [ALERT, 8]]) {
      ctx.strokeStyle = pass[0];
      ctx.lineWidth = pass[1];
      ctx.beginPath();
      ctx.moveTo(px(l) - 16, py(l) - 16);
      ctx.lineTo(px(l) + 16, py(l) + 16);
      ctx.moveTo(px(l) + 16, py(l) - 16);
      ctx.lineTo(px(l) - 16, py(l) + 16);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/** The badges, two per row (the last alone, full width, if odd), each a pill with ✓ or ! and its text. */
function drawBadges(ctx, t, badges) {
  const { top, rowH, gap } = LAYOUT.badges;
  const colW = (STORY.width - LAYOUT.side * 2 - gap) / 2;
  badges.forEach((badge, i) => {
    const alone = badges.length % 2 === 1 && i === badges.length - 1;
    const w = alone ? STORY.width - LAYOUT.side * 2 : colW;
    const x = alone ? LAYOUT.side : LAYOUT.side + (i % 2) * (colW + gap);
    const y = top + Math.floor(i / 2) * (rowH + gap);
    const alert = badge.kind === 'alert';
    ctx.fillStyle = alert ? ALERT : 'rgba(255,255,255,.94)';
    roundRect(ctx, x, y, w, rowH, rowH / 2);
    ctx.fill();
    // The mark: ✓ in yellow, ! in dark (to improve) or white on red (serious).
    const cx = x + rowH / 2;
    const cy = y + rowH / 2;
    ctx.fillStyle = badge.kind === 'ok' ? ACCENT : alert ? '#FFFFFF' : INK;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = badge.kind === 'ok' ? INK : alert ? ALERT : '#FFFFFF';
    setFont(ctx, `800 36px ${DISPLAY}`);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.kind === 'ok' ? '✓' : '!', cx, cy + 2);
    // The text: one line if it fits, else two, shrinking a little if needed.
    ctx.fillStyle = alert ? '#FFFFFF' : INK;
    ctx.textAlign = 'left';
    const text = t(`navigation.story.badges.${badge.key}`, badge.params);
    const room = w - rowH - 28;
    let size = 34;
    let lines;
    for (;;) {
      setFont(ctx, `700 ${size}px ${BODY}`);
      lines = wrap(ctx, text, room);
      if ((lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= room)) || size <= 24) break;
      size -= 2;
    }
    const lineH = size * 1.15;
    lines.forEach((line, j) => ctx.fillText(line, x + rowH - 2, cy + 2 + (j - (lines.length - 1) / 2) * lineH, room));
  });
  ctx.textBaseline = 'alphabetic';
}

/** The address on a yellow pill, after a ▶ (play) sign: "you can play this too". */
function drawSite(ctx, t) {
  setFont(ctx, `900 52px ${DISPLAY}`);
  const site = t('navigation.story.site');
  const play = 34;
  const textW = ctx.measureText(site).width;
  const w = textW + play + 24 + 88;
  const x = (STORY.width - w) / 2;
  const y = LAYOUT.siteY;
  ctx.fillStyle = ACCENT;
  roundRect(ctx, x, y - 46, w, 92, 46);
  ctx.fill();
  ctx.fillStyle = INK;
  const px = x + 44;
  ctx.beginPath();
  ctx.moveTo(px, y - play / 2);
  ctx.lineTo(px + play * 0.87, y);
  ctx.lineTo(px, y + play / 2);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(site, px + play + 24, y + 3);
  ctx.textBaseline = 'alphabetic';
}

/**
 * Paint the story for a finished flight.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function drawStory({ flight, run, report, t }) {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = STORY.width;
  canvas.height = STORY.height;
  const ctx = canvas.getContext('2d');
  const content = storyContent(report);
  drawSky(ctx);
  drawMode(ctx, t);
  drawRank(ctx, t, content.rank, report.landing.distM);
  // "Morridinha de leve pra sempre!" gets the coffin dance instead of the map.
  if (content.rank === 'wasted') drawCoffinDance(ctx);
  else drawMap(ctx, { flight, run, report });
  drawBadges(ctx, t, content.badges);
  drawSite(ctx, t);
  return canvas;
}
