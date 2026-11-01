/**
 * The landing report as an Instagram story (1080 × 1920), styled like a game's results screen:
 * a sky photo, the site address and "Simulador de navegação", a rank in its tier color (like the
 * rarity tiers of games) with the distance to the target, the pattern flown seen from above and
 * a few badges. "Morridinha de leve pra sempre!" (a serious mistake) shows the mistake above the
 * rank and a picture in place of the map.
 *
 * `storyContent` and `storyFrame` decide what goes on it (pure, tested); `drawStory` paints it
 * on a canvas, in the page's language. Nothing leaves the browser.
 */
import { buildDropzone, PALETTE } from './dropzone.js';
import { SETA, setaShape } from './view.js';

export const STORY = Object.freeze({ width: 1080, height: 1920 });

/**
 * Where things sit on the story (px), top to bottom: the address and "Simulador de navegação"
 * (below Instagram's profile bar), a blank line, the serious mistake(s) if any, the rank (at
 * most two lines, `rankH` tall) with its distance line, the card (the map or the picture, as big
 * as fits) and the badges, which end at `bottom`, above Instagram's reply bar.
 */
const LAYOUT = {
  side: 80,
  siteY: 250,
  modeY: 318,
  contentTop: 415, // a blank line after "Simulador de navegação" (one line of its 50 px text)
  rank: { maxLines: 2, size: 150, minSize: 64 },
  rankH: 200,
  badges: { rowH: 112, gap: 18 },
  bottom: 1750,
};
/**
 * The ranks, best first, each in its tier's color (as in games: gold, purple, blue, gray).
 * "wasted" replaces any of them after a mistake that hurts people at landing; it's white, as the
 * red mistake above it already carries the alarm.
 */
export const RANKS = Object.freeze({
  legendary: '#F5B400',
  epic: '#A65CF2',
  rare: '#3D8BFF',
  almost: '#C3C9D2',
  wasted: '#FFFFFF',
});
const RANK_BY_GRADE = Object.freeze({ legendary: 'legendary', great: 'epic', goal: 'rare', missed: 'almost' });
const INK = '#111317';
const ACCENT = '#F5B400';
const ALERT = '#D93025';
const REACHED = '#3FBF74';
const DISPLAY = 'Archivo, "Arial Black", sans-serif';
const BODY = '"Atkinson Hyperlegible", Arial, sans-serif';
/** The address and "Simulador de navegação" on the "wasted" story (loaded by navigation.html). */
const MONO = '"Space Mono", "Courier New", monospace';

/**
 * What the story says, from the report: the rank and up to four badges.
 * The rank comes from the landing distance, unless there was a sharp turn below 300 ft or the
 * flare was let go before touchdown: then it's "wasted", whatever the distance, so the story
 * never celebrates a landing that would hurt. Each badge is ok (✓), off (to improve) or alert
 * (a serious mistake, in red).
 * When it's "wasted", the badges that caused it (the sharp turns, letting go of the flare) move
 * to `causes`, shown at the top of the story, and leave the list.
 * @returns {{rank: string, badges: Array<{kind: 'ok'|'off'|'alert', key: string, params?: object}>, causes: Array<object>}}
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
  if (!wasted) return { rank: RANK_BY_GRADE[report.landing.grade], badges, causes: [] };
  const isCause = (b) => b.key === 'lowTurns' || b.key === 'flare.released';
  return { rank: 'wasted', badges: badges.filter((b) => !isCause(b)), causes: badges.filter(isCause) };
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

/**
 * Load the site's fonts before drawing, or the canvas would use a fallback. On a bad connection
 * the fonts may never arrive: after FONT_WAIT_MS the story is drawn anyway, with the fallbacks.
 */
const FONT_WAIT_MS = 3000;
async function loadFonts() {
  if (!document.fonts) return;
  const giveUp = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  await Promise.race([giveUp, Promise.all(['900 120px Archivo', '800 60px Archivo', '700 40px "Atkinson Hyperlegible"', '400 40px "Atkinson Hyperlegible"', '400 40px "Space Mono"']
    .map((font) => document.fonts.load(font).catch(() => null)))]);
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

/**
 * The rank, big, in its tier color with a dark outline, centered in `band` (top and bottom,
 * px); then the distance just below it (not when wasted).
 */
function drawRank(ctx, t, rank, distM, band) {
  const { maxLines, size: biggest, minSize } = LAYOUT.rank;
  const { top, bottom } = band;
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
  // Centered in its band.
  const lineH = size * 1.02;
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
  ctx.fillText(t('navigation.story.landed', { dist: distM.toLocaleString(t('meta.lang')) }), STORY.width / 2, bottom + 50, width);
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
function openCard(ctx, card) {
  const { x, y, size } = card;
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

/** Load an image from the site, to draw on the story (onload: decode() can stall in Chrome). */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${src} did not load`));
    image.src = src;
  });
}

/** An image filling the card (cropped to a square from its center). */
function drawPhoto(ctx, image, card) {
  openCard(ctx, card);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - side) / 2;
  const sy = (image.naturalHeight - side) / 2;
  ctx.drawImage(image, sx, sy, side, side, card.x, card.y, card.size, card.size);
  ctx.restore();
}

/** The pattern flown, from above (north up): ground, target, seta, points, track and landing. */
function drawMap(ctx, { flight, run, report }, card) {
  const { x, y, size } = card;
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

  openCard(ctx, card);
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
function drawBadges(ctx, t, badges, top) {
  const { rowH, gap } = LAYOUT.badges;
  const colW = (STORY.width - LAYOUT.side * 2 - gap) / 2;
  badges.forEach((badge, i) => {
    const alone = badges.length % 2 === 1 && i === badges.length - 1;
    const w = alone ? STORY.width - LAYOUT.side * 2 : colW;
    const x = alone ? LAYOUT.side : LAYOUT.side + (i % 2) * (colW + gap);
    drawPill(ctx, t, badge, x, top + Math.floor(i / 2) * (rowH + gap), w);
  });
}

/** The width a badge needs for its text on one line (at most the full width), to center it. */
function pillWidth(ctx, t, badge) {
  const { rowH } = LAYOUT.badges;
  setFont(ctx, `700 34px ${BODY}`);
  const text = ctx.measureText(t(`navigation.story.badges.${badge.key}`, badge.params)).width;
  return Math.min(rowH - 2 + text + 36, STORY.width - LAYOUT.side * 2);
}

/** One badge: a pill with ✓ or ! and its text, `w` wide, at (x, y). */
function drawPill(ctx, t, badge, x, y, w) {
  const { rowH } = LAYOUT.badges;
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
  const wasted = content.rank === 'wasted';
  const { rowH, gap } = LAYOUT.badges;
  await drawBackground(ctx);
  drawHeader(ctx, t);

  // The serious mistake(s) behind "Morridinha", one per row, each only as wide as its text.
  let y = LAYOUT.contentTop;
  content.causes.forEach((cause) => {
    const w = pillWidth(ctx, t, cause);
    drawPill(ctx, t, cause, (STORY.width - w) / 2, y, w);
    y += rowH + gap;
  });

  const rankBottom = y + LAYOUT.rankH;
  drawRank(ctx, t, content.rank, report.landing.distM, { top: y, bottom: rankBottom });

  // The card as big as fits between the rank (and its distance line) and the badges (at most 740 px).
  const rows = Math.ceil(content.badges.length / 2);
  const badgesH = rows * rowH + (rows - 1) * gap;
  const cardY = rankBottom + (wasted ? 34 : 100);
  const size = Math.min(740, LAYOUT.bottom - badgesH - 44 - cardY);
  const card = { x: (STORY.width - size) / 2, y: cardY, size };
  if (wasted) await drawWastedPicture(ctx, card);
  else drawMap(ctx, { flight, run, report }, card);
  drawBadges(ctx, t, content.badges, cardY + size + 44);
  return canvas;
}

/** The address ("Quaseparaquedista.com.br") and "Simulador de navegação", plain white, in Space Mono. */
function drawHeader(ctx, t) {
  const plain = (text, size, y) => {
    setFont(ctx, `400 ${size}px ${MONO}`);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(17,19,23,.45)';
    ctx.shadowBlur = 10;
    ctx.fillText(text, STORY.width / 2, y);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  };
  const site = t('navigation.story.site');
  plain(site.charAt(0).toLocaleUpperCase(t('meta.lang')) + site.slice(1), 30, LAYOUT.siteY);
  plain(t('navigation.story.mode'), 50, LAYOUT.modeY);
}

/** The picture shown for "Morridinha de leve pra sempre!", in place of the map. */
const WASTED_IMAGE = 'images/instagram/morridinhadeleve.jpeg';
/**
 * The story's background: a sky photo at the story's size (a smaller JPEG copy of
 * images/instagram/backgroundImage.png). If it doesn't load, the drawn sky stands in.
 */
const BACKGROUND_IMAGE = 'images/instagram/backgroundImage-web.jpg';

async function drawBackground(ctx) {
  try {
    ctx.drawImage(await loadImage(BACKGROUND_IMAGE), 0, 0, STORY.width, STORY.height);
  } catch {
    drawSky(ctx);
  }
}

/** For "Morridinha de leve pra sempre!": the picture in place of the map. */
async function drawWastedPicture(ctx, card) {
  try {
    drawPhoto(ctx, await loadImage(WASTED_IMAGE), card);
  } catch {
    // The picture didn't load: the card stays empty, the rest still reads.
    openCard(ctx, card);
    ctx.restore();
  }
}
