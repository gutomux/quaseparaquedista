/**
 * The drop zone on the ground: a fixed layout around the target, drawn by the forward view and
 * by the maps. Pure data (no page), in meters: x east, y north, target at (0, 0).
 *
 * Real drop zones don't move with the wind, so the layout is the same every run; only the seta
 * changes. The landing area is mowed grass across the whole property, from its north edge down
 * to the hangar, big enough that the whole pattern (A, B, C and X) lies over it for any seta:
 * students learn to plan the pattern inside the landing area.
 */

import { LANDING_AREA } from './pattern.js';

/** Fixed, realistic colors (the same in light and dark mode, like a photo). */
export const PALETTE = Object.freeze({
  ground: '#7E9A5A',
  property: '#8FB067', // the drop zone's own grass
  landing: '#A5C878',
  landingStripe: '#B4D488',
  fields: Object.freeze(['#C9B26B', '#9BB56A', '#6F8F45', '#B9A577', '#88A85B', '#D2C08A', '#7C9C50', '#A99A5F']),
  asphalt: '#4A4E54',
  marking: '#F2F2EC',
  apron: '#8C8F94',
  road: '#9B9486',
  roof: '#D7DADF',
  roofDark: '#6B7480',
  water: '#5F8FB8',
  tree: '#3F6A35',
  trunk: '#5A4632',
  wall: '#B8BDC6',
  wallShade: '#959BA6',
  barn: '#9E3B2E',
  barnRoof: '#6E2A22',
  silo: '#C9CCD1',
  town: '#A8A296', // sidewalks and yards between the town's buildings
  forest: '#2F5228',
  townWalls: Object.freeze(['#E8E2D4', '#D9CBB0', '#F0EBE3', '#CFC6B8', '#E3D3C1']),
  townRoofs: Object.freeze(['#A2452F', '#8E3B2B', '#B85A3C', '#6B7480', '#D7DADF']),
  treeDark: '#335A2B',
  gravel: '#D9C8A4',
  target: '#D9342B',
  plane: '#FFFFFF',
});

/** Small seeded random source, so the layout is the same on every load. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** A straight strip `width` meters wide along each segment of a polyline, as quads. */
export function ribbon(points, width) {
  const quads = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / len) * (width / 2);
    const ny = ((b.x - a.x) / len) * (width / 2);
    quads.push([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]);
  }
  return quads;
}

/** An eight-sided footprint (a silo or tank) of radius r. */
function octagon(cx, cy, r) {
  return Array.from({ length: 8 }, (_, i) => ({ x: cx + Math.cos((i / 8) * Math.PI * 2) * r, y: cy + Math.sin((i / 8) * Math.PI * 2) * r }));
}

/** A simple top-down airplane at (x, y) facing `heading`, as one polygon. */
function airplane(x, y, heading, size = 1) {
  const r = (heading * Math.PI) / 180;
  const pts = [[0, 9], [1.2, 3], [8, 0], [8, -1.5], [1.2, -1], [0.9, -6], [3, -7.5], [3, -8.5], [0, -8], [-3, -8.5], [-3, -7.5], [-0.9, -6], [-1.2, -1], [-8, -1.5], [-8, 0], [-1.2, 3]];
  return pts.map(([px, py]) => ({ x: x + (px * Math.cos(r) + py * Math.sin(r)) * size, y: y + (-px * Math.sin(r) + py * Math.cos(r)) * size }));
}

/**
 * Build the layout once.
 * @returns {{shapes: Array<{pts: {x,y}[], color: string, layer: string}>, trees: Array<{x, y, r, h}>,
 *   structures: Array<{pts: {x,y}[], height: number, wall: string, roof: string}>,
 *   landing: {x0, y0, x1, y1}, extent: number}}
 *   shapes are flat and drawn in order (fields first, airplanes last); trees and structures have
 *   a height (meters), so near the ground they rise up and show how low the canopy is.
 */
export function buildDropzone() {
  const random = seeded(20261011);
  const shapes = [];
  const add = (pts, color, layer) => shapes.push({ pts, color, layer });
  const PLOT = 260;
  const EXTENT = 3200;
  const L = LANDING_AREA.halfSize;
  const PROPERTY = { x0: -L, y0: -L - 300, x1: L, y1: L };
  const inProperty = (x, y, pad = 0) => x > PROPERTY.x0 - pad && x < PROPERTY.x1 + pad && y > PROPERTY.y0 - pad && y < PROPERTY.y1 + pad;
  // Landmarks a student can steer by: a town to the south, a lake to the east, a forest to the
  // north. Fields and field-edge trees are left out where they are.
  const TOWN = { x0: -520, x1: 520, y0: -1600, y1: -880 };
  const LAKE = { cx: 1220, cy: 40, rx: 400, ry: 430 };
  const FOREST = { x0: -900, x1: 900, y0: 820, y1: 1750 };
  const inTown = (x, y) => x > TOWN.x0 - 60 && x < TOWN.x1 + 60 && y > TOWN.y0 - 60 && y < TOWN.y1 + 60;
  const inLake = (x, y) => ((x - LAKE.cx) / (LAKE.rx + 90)) ** 2 + ((y - LAKE.cy) / (LAKE.ry + 90)) ** 2 < 1;
  const inForest = (x, y) => x > FOREST.x0 - 60 && x < FOREST.x1 + 60 && y > FOREST.y0 - 60 && y < FOREST.y1 + 60;
  const inLandmark = (x, y) => inTown(x, y) || inLake(x, y) || inForest(x, y);

  // Farm fields all around: a patchwork, each plot a little irregular.
  for (let gx = -EXTENT; gx < EXTENT; gx += PLOT) {
    for (let gy = -EXTENT; gy < EXTENT; gy += PLOT) {
      if (inProperty(gx + PLOT / 2, gy + PLOT / 2, PLOT / 2) || inLandmark(gx + PLOT / 2, gy + PLOT / 2)) continue;
      const j = () => (random() - 0.5) * 30;
      const m = 6; // a strip of hedge/track between plots
      const color = PALETTE.fields[Math.floor(random() * PALETTE.fields.length)];
      add([{ x: gx + m + j(), y: gy + m + j() }, { x: gx + PLOT - m + j(), y: gy + m + j() }, { x: gx + PLOT - m + j(), y: gy + PLOT - m + j() }, { x: gx + m + j(), y: gy + PLOT - m + j() }], color, 'field');
    }
  }

  // The drop zone property and its landing area: mowed in stripes across the property's full
  // width, from its north edge down to just above the apron and hangar.
  add(rect(PROPERTY.x0, PROPERTY.y0, PROPERTY.x1, PROPERTY.y1), PALETTE.property, 'property');
  const LANDING = { x0: -L, x1: L, y0: -L, y1: L };
  add(rect(LANDING.x0, LANDING.y0, LANDING.x1, LANDING.y1), PALETTE.landing, 'landing');
  for (let x = LANDING.x0; x < LANDING.x1; x += 76) add(rect(x, LANDING.y0, Math.min(x + 38, LANDING.x1), LANDING.y1), PALETTE.landingStripe, 'landing');

  // The lake, east: a big irregular shoreline with a sandy edge.
  const shore = (grow) => Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r = 1 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 5 + 2) + grow;
    return { x: LAKE.cx + Math.cos(a) * LAKE.rx * r, y: LAKE.cy + Math.sin(a) * LAKE.ry * r };
  });
  add(shore(0.05), PALETTE.gravel, 'shore');
  add(shore(0), PALETTE.water, 'water');

  // The forest, north: a dark canopy with a ragged edge (its trees are added below).
  const forestEdge = [];
  const FW = FOREST.x1 - FOREST.x0;
  const FH = FOREST.y1 - FOREST.y0;
  for (let i = 0; i <= 12; i += 1) forestEdge.push({ x: FOREST.x0 + (FW * i) / 12, y: FOREST.y0 + (random() - 0.5) * 70 });
  for (let i = 1; i <= 8; i += 1) forestEdge.push({ x: FOREST.x1 + (random() - 0.5) * 70, y: FOREST.y0 + (FH * i) / 8 });
  for (let i = 11; i >= 0; i -= 1) forestEdge.push({ x: FOREST.x0 + (FW * i) / 12, y: FOREST.y1 + (random() - 0.5) * 70 });
  for (let i = 7; i >= 1; i -= 1) forestEdge.push({ x: FOREST.x0 + (random() - 0.5) * 70, y: FOREST.y0 + (FH * i) / 8 });
  add(forestEdge, PALETTE.forest, 'forest');

  // The town, south: a grid of streets on a paved ground (its buildings are added below).
  add(rect(TOWN.x0, TOWN.y0, TOWN.x1, TOWN.y1), PALETTE.town, 'town');
  const BLOCK = 130;
  const SQUARE_Y = (TOWN.y0 + TOWN.y1) / 2;
  const STREET = 12;
  for (let x = TOWN.x0; x <= TOWN.x1 + 1; x += BLOCK) for (const q of ribbon([{ x, y: TOWN.y0 }, { x, y: TOWN.y1 }], STREET)) add(q, PALETTE.asphalt, 'road');
  for (let y = TOWN.y0; y <= TOWN.y1 + 1; y += (TOWN.y1 - TOWN.y0) / 5) for (const q of ribbon([{ x: TOWN.x0, y }, { x: TOWN.x1, y }], STREET)) add(q, PALETTE.asphalt, 'road');
  // A square in the middle, with grass.
  add(rect(-BLOCK + STREET, SQUARE_Y - 60, BLOCK - STREET, SQUARE_Y + 60), PALETTE.property, 'park');

  // Roads: the main road west of the property, and the access road to the hangar.
  for (const q of ribbon([{ x: -900, y: -EXTENT }, { x: -900, y: -900 }, { x: -820, y: 400 }, { x: -860, y: EXTENT }], 14)) add(q, PALETTE.road, 'road');
  for (const q of ribbon([{ x: -900, y: -630 }, { x: -380, y: -630 }], 9)) add(q, PALETTE.road, 'road');
  for (const q of ribbon([{ x: -900, y: SQUARE_Y }, { x: TOWN.x0, y: SQUARE_Y }], 12)) add(q, PALETTE.road, 'road');
  for (const q of ribbon([{ x: -EXTENT, y: 1150 }, { x: -900, y: 1150 }, { x: EXTENT, y: 1240 }], 12)) add(q, PALETTE.road, 'road');

  // Runway along the south edge, with threshold bars and a dashed centerline.
  const RW = { x0: -470, x1: 470, y: -700, w: 32 };
  add(rect(RW.x0, RW.y - RW.w / 2, RW.x1, RW.y + RW.w / 2), PALETTE.asphalt, 'runway');
  for (const end of [RW.x0 + 12, RW.x1 - 22]) {
    for (let k = -3; k <= 3; k += 1) add(rect(end, RW.y + k * 4 - 1.2, end + 10, RW.y + k * 4 + 1.2), PALETTE.marking, 'marking');
  }
  for (let x = RW.x0 + 50; x < RW.x1 - 50; x += 40) add(rect(x, RW.y - 0.8, x + 22, RW.y + 0.8), PALETTE.marking, 'marking');
  // Taxiway and apron, with the hangar, the clubhouse and parked planes.
  add(rect(-360, -684, -340, -600), PALETTE.asphalt, 'runway');
  add(rect(-470, -600, -250, -530), PALETTE.apron, 'apron');
  add(airplane(-300, -568, 90, 1.6), PALETTE.plane, 'plane');
  add(airplane(-420, -570, 70, 1.4), PALETTE.plane, 'plane');

  // Buildings with height (meters): at the airfield, and a farm and silos beyond the landing
  // area, in sight on final, as references for how low the canopy is.
  const structures = [
    { pts: rect(-460, -528, -390, -480), height: 10, wall: PALETTE.wall, roof: PALETTE.roof }, // hangar
    { pts: rect(-370, -525, -330, -500), height: 5, wall: PALETTE.wall, roof: PALETTE.roofDark }, // clubhouse
    { pts: rect(-310, -524, -285, -506), height: 4, wall: PALETTE.wall, roof: PALETTE.roof }, // manifest
    { pts: rect(60, 600, 100, 625), height: 6, wall: '#E8E2D4', roof: PALETTE.barnRoof }, // farmhouse
    { pts: rect(140, 595, 200, 635), height: 9, wall: PALETTE.barn, roof: PALETTE.barnRoof }, // barn
    { pts: octagon(700, 60, 7), height: 18, wall: PALETTE.silo, roof: PALETTE.roof }, // silos
    { pts: octagon(720, 60, 7), height: 18, wall: PALETTE.silo, roof: PALETTE.roof },
    { pts: rect(-760, 120, -715, 150), height: 7, wall: '#E8E2D4', roof: PALETTE.roofDark }, // house by the road
  ];
  // The town's buildings: houses along each block's edges, a few taller ones near the square,
  // and the church tower beside it.
  const pick = (list) => list[Math.floor(random() * list.length)];
  const rowH = (TOWN.y1 - TOWN.y0) / 5;
  for (let bx = TOWN.x0; bx < TOWN.x1 - 1; bx += BLOCK) {
    for (let by = TOWN.y0; by < TOWN.y1 - 1; by += rowH) {
      const x0 = bx + STREET;
      const x1 = bx + BLOCK - STREET;
      const y0 = by + STREET;
      const y1 = by + rowH - STREET;
      const mid = Math.hypot(bx + BLOCK / 2, by + rowH / 2 - SQUARE_Y);
      if (mid < 80) continue; // the square
      const tall = mid < 300;
      for (let x = x0; x + 14 < x1; x += 22 + random() * 8) {
        for (const [ya, yb] of [[y0, y0 + 14 + random() * 6], [y1 - 14 - random() * 6, y1]]) {
          const height = tall && random() < 0.35 ? 12 + random() * 18 : 4 + random() * 4;
          structures.push({ pts: rect(x, ya, Math.min(x + 14 + random() * 6, x1), yb), height, wall: pick(PALETTE.townWalls), roof: height > 10 ? PALETTE.roofDark : pick(PALETTE.townRoofs) });
        }
      }
    }
  }
  structures.push({ pts: rect(-110, SQUARE_Y - 35, -84, SQUARE_Y + 5), height: 12, wall: '#F0EBE3', roof: PALETTE.barnRoof }); // church
  structures.push({ pts: rect(-105, SQUARE_Y + 5, -89, SQUARE_Y + 21), height: 32, wall: '#F0EBE3', roof: PALETTE.barnRoof }); // its tower

  // Trees: lines along some field edges, the forest, the lake shore, rows around the property.
  const trees = [];
  const tree = (x, y, r, h = r * 1.6 + 2) => trees.push({ x, y, r, h });
  for (let gx = -EXTENT; gx < EXTENT; gx += PLOT) {
    for (let gy = -EXTENT; gy < EXTENT; gy += PLOT) {
      if (random() > 0.18 || inProperty(gx, gy, 120) || inLandmark(gx + PLOT / 2, gy + PLOT / 2)) continue;
      const vertical = random() > 0.5;
      for (let k = 0; k < PLOT; k += 14) {
        tree(gx + (vertical ? 0 : k) + (random() - 0.5) * 6, gy + (vertical ? k : 0) + (random() - 0.5) * 6, 6 + random() * 4);
      }
    }
  }
  // The forest: dense trees along its edge (where they show from the side) and through it.
  for (let x = FOREST.x0; x < FOREST.x1; x += 12) {
    tree(x + (random() - 0.5) * 8, FOREST.y0 + (random() - 0.5) * 20, 6 + random() * 3, 18 + random() * 8);
    tree(x + (random() - 0.5) * 8, FOREST.y1 + (random() - 0.5) * 20, 6 + random() * 3, 18 + random() * 8);
  }
  for (let y = FOREST.y0; y < FOREST.y1; y += 12) {
    tree(FOREST.x0 + (random() - 0.5) * 20, y, 6 + random() * 3, 18 + random() * 8);
    tree(FOREST.x1 + (random() - 0.5) * 20, y, 6 + random() * 3, 18 + random() * 8);
  }
  // The road crossing the forest stays clear.
  const onRoad = (x, y) => Math.abs(y - (1150 + ((x + 900) / (EXTENT + 900)) * 90)) < 14;
  for (let i = 0; i < 500; i += 1) {
    const x = FOREST.x0 + random() * FW;
    const y = FOREST.y0 + random() * FH;
    if (!onRoad(x, y)) tree(x, y, 7 + random() * 4, 18 + random() * 8);
  }
  // Trees along the lake shore.
  for (let i = 0; i < 70; i += 1) {
    const a = random() * Math.PI * 2;
    const r = 1.18 + random() * 0.08;
    tree(LAKE.cx + Math.cos(a) * LAKE.rx * r, LAKE.cy + Math.sin(a) * LAKE.ry * r, 5 + random() * 3);
  }
  // Tall eucalyptus rows around the outside of the landing area (north, east and west), 20–25 m:
  // taller than a canopy's last 65 ft, so near the ground their tops rise above the horizon,
  // the cue that the landing is close.
  for (let x = PROPERTY.x0; x < PROPERTY.x1; x += 14) tree(x, PROPERTY.y1 + 10, 4 + random() * 2, 20 + random() * 5);
  for (let y = LANDING.y0 + 40; y < PROPERTY.y1; y += 14) {
    tree(PROPERTY.x1 + 12, y, 4 + random() * 2, 20 + random() * 5);
    tree(PROPERTY.x0 - 12, y, 4 + random() * 2, 20 + random() * 5);
  }
  return { shapes, trees, structures, landing: LANDING, extent: EXTENT };
}
