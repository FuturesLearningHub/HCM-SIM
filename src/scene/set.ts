import type * as THREE from 'three';
import { createRng, pick, type Rng } from '../engine/rng';
import { Kit, type Bucket, type V3 } from './kit';
import { BACK_Z, LEFT_X, OFFICE, OFFICES, PLINTH, POD, PODS, SPOTS, WALL, WINDOW_X, seatFor } from './layout';
import { C } from './palette';

/**
 * The office set: every wall, desk, chair, plant, and lamp, built from primitives and merged by material.
 * Nothing here moves. What does move (people, clock hands, the terminal's screens, the sky) lives in components.
 */
const H = WALL.h;
const T = WALL.t;
const BOOKS = [C.gold, C.cream, C.black, C.oak, C.plant, C.walnut, C.goldDeep, C.wallShade];
const GREENS = [C.plant, C.plantDark, C.plantLight];

/** Where the two terminal screens sit, so the glowing faces can be drawn on top of the merged monitors. */
export const TERMINAL_SCREENS: { pos: V3; ry: number; size: [number, number] }[] = [-1, 1].map((side) => {
  const [x, , z] = SPOTS.terminal;
  const ry = side < 0 ? 0.17 : -0.17;
  return { pos: [x + side * 0.385 + Math.sin(ry) * 0.024, 1.13, z - 0.2 + Math.cos(ry) * 0.024] as V3, ry, size: [0.68, 0.4] as [number, number] };
});
export const BOARD = { pos: [SPOTS.board[0], SPOTS.board[1], BACK_Z + 0.046] as V3, size: [1.86, 1.16] as [number, number] };
export const SIGN = { pos: [LEFT_X + 0.014, 2.3, 3.15] as V3, size: [4.1, 0.52] as [number, number] };
export const CLOCK: V3 = [0.95, 2.0, BACK_Z + 0.03];
/** Window openings, for the sky behind them. Each is [center, width, height, facing]. */
export const WINDOWS = {
  back: { x0: WINDOW_X, x1: PLINTH.w / 2 - 0.15, y0: 0.9, y1: 2.4 },
  left: { z0: OFFICE.front + 0.2, z1: 0.9, y0: 0.9, y1: 2.4 },
};

// ---------- Small furniture ----------

/** A lit screen with a hint of what's on it. Faces +z before the turn. */
function screen(k: Kit, [w, h]: [number, number], [x, y, z]: V3, ry = 0) {
  k.at([x, y, z], ry, () => {
    k.panel('glow', C.screen, [w, h], [0, 0, 0]);
    k.panel('glow', C.screenDim, [w, h * 0.16], [0, h * 0.42, 0.002]);
    k.panel('glow', '#D8C9A4', [w * 0.24, h * 0.62], [-w * 0.34, -h * 0.1, 0.002]);
    k.panel('glow', '#FBF6E8', [w * 0.56, h * 0.2], [w * 0.14, h * 0.1, 0.002]);
  });
}

/** A task chair. The sitter faces +z before the turn. */
function taskChair(k: Kit, pos: V3, ry: number, color = C.black) {
  k.at(pos, ry, () => {
    k.box('matte', color, [0.46, 0.08, 0.46], [0, 0.46, 0]);
    k.box('matte', color, [0.42, 0.5, 0.07], [0, 0.8, -0.24], [-0.12, 0, 0]);
    k.box('matte', C.steel, [0.04, 0.12, 0.04], [0, 0.58, -0.24]);
    k.cyl('metal', C.chrome, [0.03, 0.03, 0.32], [0, 0.27, 0], 6);
    k.box('matte', C.ink, [0.56, 0.035, 0.07], [0, 0.07, 0]);
    k.box('matte', C.ink, [0.07, 0.035, 0.56], [0, 0.07, 0]);
  });
}

/** A visitor chair on a sled base. The sitter faces +z before the turn. */
function sideChair(k: Kit, pos: V3, ry: number, color = C.fabric) {
  k.at(pos, ry, () => {
    k.box('matte', color, [0.44, 0.07, 0.44], [0, 0.45, 0]);
    k.box('matte', color, [0.42, 0.4, 0.06], [0, 0.73, -0.21], [-0.14, 0, 0]);
    for (const dx of [-0.2, 0.2]) {
      k.box('metal', C.gold, [0.025, 0.42, 0.025], [dx, 0.21, -0.19]);
      k.box('metal', C.gold, [0.025, 0.42, 0.025], [dx, 0.21, 0.19]);
    }
  });
}

/** An upholstered armchair. Faces +z before the turn. */
function armchair(k: Kit, pos: V3, ry: number, color = C.cushion) {
  k.at(pos, ry, () => {
    k.rbox('matte', color, [0.78, 0.3, 0.74], 0.07, [0, 0.33, 0.02]);
    k.rbox('matte', color, [0.78, 0.62, 0.2], 0.07, [0, 0.58, -0.3]);
    k.rbox('matte', color, [0.16, 0.24, 0.7], 0.06, [-0.38, 0.52, 0.04]);
    k.rbox('matte', color, [0.16, 0.24, 0.7], 0.06, [0.38, 0.52, 0.04]);
    for (const [dx, dz] of [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.3], [0.3, 0.3]]) k.cyl('matte', C.walnut, [0.025, 0.018, 0.18], [dx, 0.09, dz], 6);
  });
}

/** A sofa `w` wide. Faces +z before the turn. */
function sofa(k: Kit, w: number) {
  k.rbox('matte', C.fabric, [w, 0.26, 0.84], 0.07, [0, 0.29, 0.02]);
  k.rbox('matte', C.fabric, [w, 0.56, 0.22], 0.08, [0, 0.6, -0.32]);
  for (const side of [-1, 1]) k.rbox('matte', C.fabric, [0.2, 0.3, 0.84], 0.07, [side * (w / 2 - 0.1), 0.52, 0.02]);
  const cw = (w - 0.44) / 2;
  for (const side of [-1, 1]) k.rbox('matte', C.cushion, [cw - 0.02, 0.13, 0.6], 0.05, [side * (cw / 2), 0.47, 0.1]);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cyl('metal', C.gold, [0.022, 0.016, 0.16], [dx * (w / 2 - 0.1), 0.08, dz * 0.34], 6);
}

/** Leafy plant in a pot, about 1.2 m tall at scale 1. */
function bush(k: Kit, [x, y, z]: V3, rng: Rng, scale = 1, pot = C.pot) {
  const s = scale;
  k.cyl('matte', pot, [0.22 * s, 0.16 * s, 0.36 * s], [x, y + 0.18 * s, z], 10);
  k.cyl('metal', C.gold, [0.225 * s, 0.225 * s, 0.03 * s], [x, y + 0.34 * s, z], 10);
  k.cyl('matte', C.soil, [0.19 * s, 0.19 * s, 0.02 * s], [x, y + 0.365 * s, z], 10);
  k.ball('matte', pick(rng, GREENS), 0.32 * s, [x, y + 0.82 * s, z], [1, 1.05, 1], 0, [rng() * 3, rng() * 3, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng();
    const r = (0.2 + rng() * 0.08) * s;
    k.ball('matte', GREENS[i % 3], (0.18 + rng() * 0.08) * s, [x + Math.cos(a) * r, y + (0.58 + rng() * 0.42) * s, z + Math.sin(a) * r], 1, 0, [rng() * 3, rng() * 3, rng() * 3]);
  }
}

/** Tall plant with a bare stem and leaves near the top, about 1.9 m at scale 1. */
function tree(k: Kit, [x, y, z]: V3, rng: Rng, scale = 1, pot = C.black) {
  const s = scale;
  k.cyl('matte', pot, [0.24 * s, 0.19 * s, 0.44 * s], [x, y + 0.22 * s, z], 10);
  k.cyl('matte', C.soil, [0.21 * s, 0.21 * s, 0.02 * s], [x, y + 0.445 * s, z], 10);
  k.cyl('matte', C.walnut, [0.025 * s, 0.035 * s, 1.0 * s], [x, y + 0.94 * s, z], 6);
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4 + rng() * 0.5;
    const up = 1.05 + i * 0.1;
    const r = (0.3 - i * 0.022) * s;
    k.ball('matte', GREENS[i % 3], 0.2 * s, [x + Math.cos(a) * r, y + up * s, z + Math.sin(a) * r], [1.15, 0.5, 0.8], 0, [0.3, -a, 0.35]);
  }
  k.ball('matte', C.plantLight, 0.17 * s, [x, y + 1.9 * s, z], [0.9, 0.7, 0.9]);
}

/** Upright sword-shaped leaves, about 0.9 m at scale 1. */
function spikes(k: Kit, [x, y, z]: V3, rng: Rng, scale = 1, pot = C.pot) {
  const s = scale;
  k.cyl('matte', pot, [0.17 * s, 0.14 * s, 0.3 * s], [x, y + 0.15 * s, z], 8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng();
    const lean = 0.1 + rng() * 0.22;
    const h = (0.42 + rng() * 0.3) * s;
    const r = 0.07 * s;
    k.cone('matte', GREENS[i % 3], 0.045 * s, h, [x + Math.cos(a) * r, y + 0.3 * s + h / 2, z + Math.sin(a) * r], 4, [Math.sin(a) * lean, 0, -Math.cos(a) * lean]);
  }
}

/** A little plant for a desk or shelf. */
function sprig(k: Kit, [x, y, z]: V3, rng: Rng, pot = C.pot) {
  k.cyl('matte', pot, [0.055, 0.045, 0.09], [x, y + 0.045, z], 8);
  k.ball('matte', pick(rng, GREENS), 0.085, [x, y + 0.16, z], [1, 0.9, 1], 0, [rng() * 3, rng() * 3, 0]);
  k.ball('matte', pick(rng, GREENS), 0.06, [x + 0.05, y + 0.2, z - 0.03], 1, 0, [rng() * 3, 0, rng() * 3]);
}

/** A lamp on a desk, with its light pooling on the surface at `surface` height. */
function deskLamp(k: Kit, [x, y, z]: V3, lean = 0.4) {
  k.cyl('metal', C.gold, [0.07, 0.08, 0.02], [x, y + 0.01, z], 10);
  k.cyl('metal', C.gold, [0.012, 0.012, 0.36], [x, y + 0.19, z], 5);
  k.cyl('metal', C.gold, [0.012, 0.012, 0.22], [x - 0.07, y + 0.4, z], 5, [0, 0, lean + 0.8]);
  k.cone('metal', C.gold, 0.085, 0.1, [x - 0.17, y + 0.4, z], 10);
  k.cyl('glow', C.lamp, [0.06, 0.06, 0.012], [x - 0.17, y + 0.352, z], 10);
  k.sheet('pool', '#4A3918', [0.8, 0.8], [x - 0.2, y + 0.006, z + 0.05]);
}

/** A standing lamp with a warm shade and light on the floor around it. */
function floorLamp(k: Kit, [x, y, z]: V3) {
  k.cyl('metal', C.gold, [0.17, 0.19, 0.025], [x, y + 0.012, z], 14);
  k.cyl('metal', C.gold, [0.014, 0.014, 1.45], [x, y + 0.74, z], 6);
  k.cyl('glow', C.lamp, [0.17, 0.23, 0.3], [x, y + 1.58, z], 14);
  k.sheet('pool', C.pool, [3.4, 3.4], [x + 0.25, y + 0.012, z + 0.25]);
}

function mug(k: Kit, [x, y, z]: V3, color: string) {
  k.cyl('satin', color, [0.04, 0.035, 0.09], [x, y + 0.045, z], 8);
}

/** Shelves of books against a wall. Faces +z before the turn. */
function bookshelf(k: Kit, pos: V3, ry: number, rng: Rng, w = 0.8, h = 1.86) {
  k.at(pos, ry, () => {
    k.box('matte', C.walnut, [w, h, 0.02], [0, h / 2, -0.14]);
    for (const side of [-1, 1]) k.box('matte', C.walnut, [0.03, h, 0.3], [side * (w / 2 - 0.015), h / 2, 0]);
    const rows = 5;
    for (let r = 0; r <= rows; r++) {
      const y = 0.05 + (r * (h - 0.08)) / rows;
      k.box('matte', C.walnut, [w, 0.03, 0.3], [0, y, 0]);
      if (r === rows) break;
      let x = -w / 2 + 0.06;
      const gapAt = Math.floor(rng() * 5);
      for (let b = 0; x < w / 2 - 0.1; b++) {
        const bw = 0.04 + rng() * 0.045;
        const bh = 0.2 + rng() * 0.08;
        if (b === gapAt && r % 2 === 0) { x += 0.16; continue; }
        k.box('matte', pick(rng, BOOKS), [bw, bh, 0.2], [x + bw / 2, y + 0.015 + bh / 2, 0.01]);
        x += bw + 0.006;
      }
    }
  });
}

// ---------- Rooms ----------

function shell(k: Kit) {
  // The plinth the model stands on, with a gold band at its top edge.
  k.box('matte', C.base, [PLINTH.w + 0.5, PLINTH.h, PLINTH.d + 0.5], [0, -PLINTH.h / 2 - 0.045, 0]);
  k.box('metal', C.gold, [PLINTH.w + 0.56, 0.06, PLINTH.d + 0.56], [0, -0.065, 0]);
  k.box('matte', C.woodLight, [PLINTH.w + 0.02, 0.04, PLINTH.d + 0.02], [0, -0.022, 0]);

  // Walls are cut flat across the top, like an architect's model: cream faces, dark cut.
  const cap = (size: V3, pos: V3) => k.box('matte', C.cut, size, pos);
  const back = (x0: number, x1: number, y0: number, y1: number) => {
    k.box('matte', C.wall, [x1 - x0, y1 - y0, T], [(x0 + x1) / 2, (y0 + y1) / 2, BACK_Z - T / 2]);
    if (y1 >= H) cap([x1 - x0, 0.05, T + 0.02], [(x0 + x1) / 2, H + 0.025, BACK_Z - T / 2]);
  };
  const left = (z0: number, z1: number, y0: number, y1: number) => {
    k.box('matte', C.wall, [T, y1 - y0, z1 - z0], [LEFT_X - T / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
    if (y1 >= H) cap([T + 0.02, 0.05, z1 - z0], [LEFT_X - T / 2, H + 0.025, (z0 + z1) / 2]);
  };
  const wb = WINDOWS.back, wl = WINDOWS.left;
  const right = PLINTH.w / 2;

  // Back wall: solid behind the offices and the notice wall, then windows over the break room.
  back(-right, wb.x0, 0, H);
  back(wb.x0, right, 0, wb.y0);
  back(wb.x0, right, wb.y1, H);
  back(wb.x1, right, wb.y0, wb.y1);
  const paneW = (wb.x1 - wb.x0) / 4;
  for (let i = 0; i <= 4; i++) k.box('metal', C.black, [0.07, wb.y1 - wb.y0, 0.14], [wb.x0 + i * paneW + (i === 0 ? 0.035 : i === 4 ? -0.035 : 0), (wb.y0 + wb.y1) / 2, BACK_Z - T / 2]);
  k.box('metal', C.black, [wb.x1 - wb.x0, 0.05, 0.14], [(wb.x0 + wb.x1) / 2, wb.y1 - 0.025, BACK_Z - T / 2]);
  k.panel('glass', C.glass, [wb.x1 - wb.x0, wb.y1 - wb.y0], [(wb.x0 + wb.x1) / 2, (wb.y0 + wb.y1) / 2, BACK_Z - T / 2]);
  k.box('satin', C.white, [wb.x1 - wb.x0, 0.04, 0.3], [(wb.x0 + wb.x1) / 2, wb.y0 + 0.02, BACK_Z - 0.05]);

  // Left wall: office, a band of windows, the sign wall, and the front door.
  left(BACK_Z, wl.z0 - 0.2, 0, H);
  left(wl.z0 - 0.2, wl.z0, wl.y0, wl.y1);
  left(wl.z0 - 0.2, wl.z1, 0, wl.y0);
  left(wl.z0 - 0.2, wl.z1, wl.y1, H);
  const paneZ = (wl.z1 - wl.z0) / 4;
  for (let i = 0; i <= 4; i++) k.box('metal', C.black, [0.14, wl.y1 - wl.y0, 0.07], [LEFT_X - T / 2, (wl.y0 + wl.y1) / 2, wl.z0 + i * paneZ + (i === 0 ? 0.035 : i === 4 ? -0.035 : 0)]);
  k.box('metal', C.black, [0.14, 0.05, wl.z1 - wl.z0], [LEFT_X - T / 2, wl.y1 - 0.025, (wl.z0 + wl.z1) / 2]);
  k.panel('glass', C.glass, [wl.z1 - wl.z0, wl.y1 - wl.y0], [LEFT_X - T / 2, (wl.y0 + wl.y1) / 2, (wl.z0 + wl.z1) / 2], Math.PI / 2);
  k.box('satin', C.white, [0.3, 0.04, wl.z1 - wl.z0], [LEFT_X - 0.05, wl.y0 + 0.02, (wl.z0 + wl.z1) / 2]);
  left(wl.z1, 5.4, 0, H);
  left(5.4, 6.8, 2.25, H);
  left(6.8, PLINTH.d / 2, 0, H);

  // Front door, standing open into the room.
  for (const z of [5.43, 6.77]) k.box('metal', C.black, [T + 0.04, 2.25, 0.06], [LEFT_X - T / 2, 1.125, z]);
  k.box('metal', C.black, [T + 0.04, 0.06, 1.4], [LEFT_X - T / 2, 2.25, 6.1]);
  k.at([LEFT_X + 0.03, 0, 6.74], -1.15, () => {
    k.box('satin', C.woodDark, [0.05, 2.18, 1.3], [0, 1.1, -0.65]);
    k.box('glass', C.glass, [0.052, 1.1, 0.7], [0, 1.4, -0.65]);
    k.box('metal', C.gold, [0.09, 0.32, 0.035], [0, 1.05, -1.18]);
  });

  // Baseboards where a wall meets open floor.
  k.box('matte', C.wallShade, [right - OFFICES[2].x - OFFICE.w / 2, 0.1, 0.024], [(right + OFFICES[2].x + OFFICE.w / 2) / 2, 0.05, BACK_Z + 0.012]);
  k.box('matte', C.wallShade, [0.024, 0.1, 5.4 - OFFICE.front], [LEFT_X + 0.012, 0.05, (5.4 + OFFICE.front) / 2]);
}

function offices(k: Kit, rng: Rng) {
  const { w, d, h, z, front } = OFFICE;
  const xL = LEFT_X;
  const xR = OFFICES[2].x + w / 2;
  // Oak slats on the back wall, the one stretch of warm wood in the room.
  k.box('matte', C.walnut, [xR - xL, h, 0.02], [(xL + xR) / 2, h / 2, BACK_Z + 0.012]);
  for (let x = xL + 0.09, i = 0; x < xR - 0.05; x += 0.14, i++) k.box('matte', i % 3 === 1 ? C.slatDark : C.slat, [0.085, h - 0.04, 0.045], [x, h / 2, BACK_Z + 0.042]);

  // Black steel frame with a gold top rail.
  k.box('metal', C.gold, [xR - xL, 0.05, 0.07], [(xL + xR) / 2, h, front]);
  k.box('metal', C.black, [0.06, h, 0.06], [xL + 0.03, h / 2, front]);
  OFFICES.forEach(({ x }) => {
    const px = x + w / 2;
    k.box('metal', C.black, [0.06, h, 0.06], [px, h / 2, front]);
    k.box('metal', C.black, [0.06, h, 0.06], [px, h / 2, BACK_Z + 0.09]);
    k.box('metal', C.gold, [0.06, 0.05, d - 0.1], [px, h, z]);
    k.box('metal', C.black, [0.05, 0.05, d - 0.1], [px, 0.025, z]);
    // Side partition, clear above and below a frosted band.
    k.panel('glass', C.glass, [d - 0.12, h - 0.08], [px, h / 2, z], Math.PI / 2);
    k.panel('frost', C.frost, [d - 0.12, 0.55], [px + 0.004, 1.15, z], Math.PI / 2);
    // Front: a fixed pane, then the door.
    const jamb = x + 0.52;
    k.box('metal', C.black, [0.06, h, 0.06], [jamb, h / 2, front]);
    k.box('metal', C.black, [jamb - (x - w / 2), 0.05, 0.05], [(jamb + x - w / 2) / 2, 0.025, front]);
    k.panel('glass', C.glass, [jamb - (x - w / 2) - 0.06, h - 0.08], [(jamb + x - w / 2) / 2, h / 2, front]);
    k.panel('frost', C.frost, [jamb - (x - w / 2) - 0.06, 0.55], [(jamb + x - w / 2) / 2, 1.15, front + 0.004]);
    k.at([px - 0.04, 0, front], -0.95, () => {
      const dw = px - jamb - 0.08;
      k.panel('glass', C.glass, [dw, 2.2], [-dw / 2, 1.13, 0]);
      k.panel('frost', C.frost, [dw, 0.55], [-dw / 2, 1.15, 0.004]);
      k.box('metal', C.black, [dw, 0.05, 0.04], [-dw / 2, 2.24, 0]);
      k.box('metal', C.black, [dw, 0.05, 0.04], [-dw / 2, 0.03, 0]);
      k.box('metal', C.black, [0.04, 2.24, 0.04], [-dw, 1.13, 0]);
      k.box('metal', C.gold, [0.03, 0.36, 0.07], [-dw + 0.1, 1.05, 0]);
    });

    // Inside: desk, laptop, lamp, two visitor chairs, shelves, a plant.
    k.at([x, 0, z], 0, () => {
      k.sheet('matte', C.walnut, [2.76, 2.16], [0.05, 0.002, -0.15]);
      k.sheet('matte', C.rugWarm, [2.6, 2.0], [0.05, 0.004, -0.15]);
      k.box('satin', C.wood, [1.75, 0.05, 0.8], [0.1, 0.755, -0.62]);
      for (const side of [-1, 1]) k.box('matte', C.black, [0.05, 0.73, 0.7], [0.1 + side * 0.82, 0.365, -0.62]);
      k.box('matte', C.walnut, [1.6, 0.42, 0.03], [0.1, 0.5, -0.26]);
      k.box('metal', C.steel, [0.34, 0.016, 0.23], [-0.15, 0.789, -0.7]);
      k.box('metal', C.steel, [0.34, 0.22, 0.012], [-0.15, 0.9, -0.56], [0.28, 0, 0]);
      k.box('matte', C.paper, [0.21, 0.012, 0.3], [0.42, 0.787, -0.56], [0, 0.25, 0]);
      mug(k, [0.62, 0.78, -0.42], pick(rng, [C.gold, C.cream, C.black]));
      deskLamp(k, [0.82, 0.78, -0.82]);
      taskChair(k, [0.1, 0, BACK_Z + 0.48 - z], 0);
      sideChair(k, [-0.42, 0, 0.5], Math.PI + 0.12);
      sideChair(k, [0.56, 0, 0.5], Math.PI - 0.1);
      bookshelf(k, [-1.22, 0, -d / 2 + 0.24], 0, rng);
      tree(k, [1.28, 0, -d / 2 + 0.4], rng, 0.92, C.pot);
    });
  });
}

function pods(k: Kit, rng: Rng) {
  const cx = (POD.xs[0] + POD.xs[3]) / 2;
  const len = POD.xs[3] - POD.xs[0] + POD.w + 0.1;
  k.sheet('matte', C.rugEdge, [len + 1.5, 5.1], [cx, 0.002, POD.spine]);
  k.sheet('matte', C.rug, [len + 1.24, 4.84], [cx, 0.004, POD.spine]);
  // The screen down the middle of the bench, and an oak panel at each end.
  k.box('matte', C.fabric, [len, 0.44, 0.05], [cx, 0.99, POD.spine]);
  k.box('metal', C.gold, [len, 0.014, 0.06], [cx, 1.217, POD.spine]);
  for (const side of [-1, 1]) k.box('satin', C.wood, [0.05, 0.77, POD.d * 2 + 0.1], [cx + side * (len / 2 + 0.025), 0.385, POD.spine]);
  const mugs = [C.gold, C.cream, C.black, C.white];
  Object.entries(PODS).forEach(([id, [x, , z]], i) => {
    const backRow = z < POD.spine;
    // Each desk is modeled with its user on the +z side, then turned for the back row.
    k.at([x, 0, z], backRow ? Math.PI : 0, () => {
      k.box('satin', '#F3EEE4', [POD.w, 0.045, POD.d], [0, 0.745, 0]);
      for (const side of [-1, 1]) k.box('matte', C.black, [0.04, 0.72, 0.04], [side * (POD.w / 2 - 0.05), 0.36, POD.d / 2 - 0.06]);
      k.box('matte', C.wallShade, [0.38, 0.5, 0.5], [(i % 2 ? -1 : 1) * 0.5, 0.29, -0.04]);
      k.box('metal', C.gold, [0.12, 0.016, 0.02], [(i % 2 ? -1 : 1) * 0.5, 0.42, 0.22]);
      k.box('matte', C.ink, [0.22, 0.016, 0.16], [0, 0.776, -0.2]);
      k.box('matte', C.ink, [0.06, 0.2, 0.04], [0, 0.87, -0.24]);
      k.box('matte', C.ink, [0.6, 0.36, 0.03], [0, 1.1, -0.23]);
      screen(k, [0.56, 0.32], [0, 1.1, -0.213]);
      k.box('matte', C.steel, [0.38, 0.014, 0.12], [0, 0.775, 0.18]);
      k.box('matte', C.ink, [0.05, 0.02, 0.08], [0.29, 0.778, 0.2]);
      mug(k, [-0.52, 0.768, 0.02], mugs[i % mugs.length]);
      if (i % 3 === 0) sprig(k, [0.62, 0.768, -0.2], rng);
      if (i % 3 === 1) k.box('matte', C.paper, [0.21, 0.02, 0.3], [0.56, 0.778, 0.02], [0, 0.3, 0]);
      if (i % 3 === 2) { k.box('matte', pick(rng, BOOKS), [0.2, 0.035, 0.27], [0.58, 0.785, -0.05], [0, -0.2, 0]); k.box('matte', pick(rng, BOOKS), [0.18, 0.03, 0.25], [0.58, 0.818, -0.05], [0, 0.15, 0]); }
    });
    const seat = seatFor(id);
    taskChair(k, seat.pos, seat.ry + (rng() - 0.5) * 0.25);
  });
}

function hcmDesk(k: Kit, rng: Rng) {
  const [x, , z] = SPOTS.terminal;
  k.at([x, 0, z], 0, () => {
    k.sheet('matte', C.rugEdge, [3.9, 2.9], [0.15, 0.002, 0.4]);
    k.sheet('matte', C.rug, [3.7, 2.7], [0.15, 0.004, 0.4]);
    // Your desk: black top with a gold edge, two screens, and an inbox tray.
    k.rbox('matte', C.black, [2.4, 0.06, 0.96], 0.02, [0, 0.76, 0]);
    k.box('metal', C.gold, [2.36, 0.014, 0.014], [0, 0.793, 0.468]);
    for (const side of [-1, 1]) k.box('matte', C.walnut, [0.5, 0.71, 0.84], [side * 0.9, 0.365, 0]);
    for (const side of [-1, 1]) for (const y of [0.25, 0.5]) k.box('metal', C.gold, [0.14, 0.016, 0.02], [side * 0.9, y, 0.43]);
    k.box('matte', C.walnut, [1.3, 0.46, 0.03], [0, 0.5, -0.4]);
    for (const side of [-1, 1]) {
      k.at([side * 0.385, 0, -0.2], side < 0 ? 0.17 : -0.17, () => {
        k.box('matte', C.ink, [0.74, 0.46, 0.04], [0, 1.13, 0]);
        k.box('matte', C.ink, [0.07, 0.16, 0.05], [0, 0.87, -0.03]);
        k.box('matte', C.ink, [0.26, 0.016, 0.18], [0, 0.798, 0]);
      });
    }
    k.sheet('pool', '#3A2E14', [1.5, 0.9], [0, 0.798, 0.1]);
    k.box('matte', C.steel, [0.44, 0.016, 0.14], [0, 0.798, 0.22]);
    k.box('matte', C.steel, [0.05, 0.02, 0.08], [0.33, 0.8, 0.24]);
    // Inbox tray, two tiers, with paper waiting.
    for (const y of [0.8, 0.9]) {
      k.box('metal', C.gold, [0.3, 0.012, 0.36], [-0.93, y, 0.12]);
      k.box('matte', C.paper, [0.25, 0.03, 0.31], [-0.93, y + 0.022, 0.12], [0, y > 0.85 ? 0.08 : -0.05, 0]);
    }
    for (const dz of [-0.06, 0.3]) k.box('metal', C.gold, [0.3, 0.11, 0.012], [-0.93, 0.85, dz]);
    deskLamp(k, [1.02, 0.79, -0.28]);
    mug(k, [0.62, 0.79, 0.3], C.gold);
    k.box('metal', C.gold, [0.3, 0.06, 0.05], [0.7, 0.82, 0.4], [0.25, 0, 0]);
    k.box('matte', C.white, [0.19, 0.016, 0.26], [-0.5, 0.798, 0.3], [0, -0.2, 0]);
    sprig(k, [-0.55, 0.79, -0.3], rng, C.black);
  });
  taskChair(k, [x + 0.05, 0, z + 0.78], Math.PI + 0.35);

  // Renee's desk next door, and a cabinet between the two.
  const [mx, , mz] = SPOTS.hcm_2;
  k.at([mx, 0, mz], 0, () => {
    k.box('satin', '#F3EEE4', [1.7, 0.045, 0.8], [0, 0.745, 0]);
    for (const side of [-1, 1]) k.box('matte', C.black, [0.04, 0.72, 0.7], [side * 0.8, 0.36, 0]);
    k.box('matte', C.wood, [1.56, 0.4, 0.03], [0, 0.5, -0.36]);
    k.box('matte', C.ink, [0.22, 0.016, 0.16], [0, 0.776, -0.22]);
    k.box('matte', C.ink, [0.06, 0.2, 0.04], [0, 0.87, -0.26]);
    k.box('matte', C.ink, [0.6, 0.36, 0.03], [0, 1.1, -0.25]);
    screen(k, [0.56, 0.32], [0, 1.1, -0.233]);
    k.box('matte', C.steel, [0.38, 0.014, 0.12], [0, 0.775, 0.1]);
    mug(k, [0.55, 0.768, 0.05], C.cream);
    for (let i = 0; i < 3; i++) k.box('matte', BOOKS[(i * 3) % BOOKS.length], [0.24, 0.035, 0.3], [-0.55, 0.785 + i * 0.036, -0.05], [0, i * 0.2 - 0.2, 0]);
  });
  const seat = seatFor('hcm_2');
  taskChair(k, seat.pos, seat.ry);
  k.box('matte', C.wallShade, [0.5, 0.72, 0.62], [x + 1.62, 0.36, z - 0.05]);
  for (const y of [0.18, 0.4, 0.6]) k.box('metal', C.gold, [0.16, 0.016, 0.02], [x + 1.62, y, z + 0.27]);
  spikes(k, [x + 1.62, 0.72, z - 0.05], rng, 0.75, C.black);
}

function noticeWall(k: Kit, rng: Rng) {
  const [bx, by] = SPOTS.board;
  k.box('matte', C.black, [BOARD.size[0] + 0.12, BOARD.size[1] + 0.12, 0.04], [bx, by, BACK_Z + 0.02]);
  k.box('metal', C.gold, [BOARD.size[0] + 0.16, 0.025, 0.05], [bx, by + BOARD.size[1] / 2 + 0.075, BACK_Z + 0.025]);
  // Clock rim and ticks; the face and hands are drawn live.
  k.torus('metal', C.gold, 0.37, 0.035, CLOCK);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.box('matte', C.black, [0.02, i % 3 === 0 ? 0.08 : 0.05, 0.008], [CLOCK[0] + Math.sin(a) * 0.29, CLOCK[1] + Math.cos(a) * 0.29, CLOCK[2] + 0.024], [0, 0, -a]);
  }
  // A console under the board holds the policy binders.
  k.box('matte', C.walnut, [2.3, 0.72, 0.42], [bx, 0.36, BACK_Z + 0.23]);
  k.box('satin', C.woodLight, [2.36, 0.04, 0.46], [bx, 0.74, BACK_Z + 0.24]);
  for (const dx of [-0.58, 0, 0.58]) k.box('metal', C.gold, [0.02, 0.2, 0.02], [bx + dx + 0.5, 0.42, BACK_Z + 0.445]);
  let x = bx - 1.02;
  for (let i = 0; i < 10; i++) {
    const w = 0.06 + rng() * 0.035;
    k.box('matte', BOOKS[i % BOOKS.length], [w, 0.3 + rng() * 0.04, 0.24], [x + w / 2, 0.92, BACK_Z + 0.2]);
    k.box('matte', C.white, [w * 0.6, 0.07, 0.005], [x + w / 2, 0.96, BACK_Z + 0.323]);
    x += w + 0.008;
  }
  sprig(k, [bx + 0.3, 0.76, BACK_Z + 0.24], rng, C.black);
  deskLamp(k, [bx + 0.95, 0.76, BACK_Z + 0.2]);
  // Copier, with a stack of paper boxes beside it.
  k.box('matte', C.appliance, [0.78, 0.92, 0.62], [4.2, 0.46, BACK_Z + 0.36]);
  k.box('matte', C.steel, [0.8, 0.07, 0.64], [4.2, 0.955, BACK_Z + 0.36]);
  k.box('matte', C.ink, [0.74, 0.012, 0.02], [4.2, 0.62, BACK_Z + 0.675]);
  k.box('matte', C.ink, [0.74, 0.012, 0.02], [4.2, 0.34, BACK_Z + 0.675]);
  k.box('matte', C.paper, [0.44, 0.02, 0.24], [4.2, 0.72, BACK_Z + 0.78]);
  k.panel('glow', '#9CCB8F', [0.05, 0.03], [4.48, 0.86, BACK_Z + 0.672]);
  k.box('matte', C.pot, [0.34, 0.26, 0.44], [3.52, 0.13, BACK_Z + 0.3]);
  k.box('matte', C.pot, [0.34, 0.26, 0.44], [3.5, 0.39, BACK_Z + 0.31], [0, 0.12, 0]);
  tree(k, [0.05, 0, BACK_Z + 0.42], rng, 0.95);
}

function breakRoom(k: Kit, rng: Rng) {
  const z = BACK_Z;
  const cx = 8.5;
  k.box('matte', C.walnut, [3.1, 0.86, 0.6], [cx, 0.43, z + 0.32]);
  k.box('matte', C.ink, [3.1, 0.08, 0.56], [cx, 0.04, z + 0.3]);
  k.box('satin', C.white, [3.2, 0.045, 0.66], [cx, 0.885, z + 0.34]);
  for (let i = 0; i < 5; i++) {
    const dx = cx - 1.55 + (i + 0.5) * 0.62;
    k.box('matte', C.ink, [0.012, 0.72, 0.012], [dx - 0.31, 0.47, z + 0.622]);
    k.box('metal', C.gold, [0.14, 0.018, 0.02], [dx, 0.74, z + 0.63]);
  }
  k.sheet('metal', C.steel, [0.5, 0.34], [cx - 0.95, 0.909, z + 0.36]);
  k.cyl('satin', C.chrome, [0.016, 0.016, 0.24], [cx - 0.95, 1.03, z + 0.14], 6);
  k.box('satin', C.chrome, [0.024, 0.024, 0.17], [cx - 0.95, 1.15, z + 0.21]);
  // Coffee machine, mugs, fruit, microwave.
  k.box('matte', C.ink, [0.3, 0.4, 0.3], [cx + 0.35, 1.108, z + 0.3]);
  k.box('metal', C.gold, [0.3, 0.03, 0.31], [cx + 0.35, 1.29, z + 0.3]);
  k.panel('glow', '#FFA860', [0.035, 0.035], [cx + 0.44, 1.2, z + 0.452]);
  k.cyl('frost', '#5A3A1E', [0.06, 0.07, 0.13], [cx + 0.33, 0.975, z + 0.38], 8);
  [C.gold, C.cream, C.black].forEach((c, i) => mug(k, [cx - 0.1 + i * 0.12, 0.908, z + 0.36 + (i % 2) * 0.08], c));
  k.cyl('satin', C.cream, [0.17, 0.09, 0.07], [cx - 0.42, 0.943, z + 0.38], 12);
  const fruit: [string, number, number][] = [['#D98B3A', -0.05, 0], ['#C9A24A', 0.05, 0.03], ['#8FA65A', 0, -0.06]];
  fruit.forEach(([c, dx, dz]) => k.ball('matte', c, 0.055, [cx - 0.42 + dx, 1.0, z + 0.38 + dz], 1, 1));
  k.box('matte', C.appliance, [0.52, 0.3, 0.38], [cx + 1.1, 1.058, z + 0.3]);
  k.panel('matte', C.ink, [0.34, 0.2], [cx + 1.04, 1.058, z + 0.492]);
  // Fridge at the end of the counter.
  k.box('satin', C.appliance, [0.72, 1.85, 0.68], [10.46, 0.925, z + 0.36]);
  k.box('matte', C.steel, [0.722, 0.012, 0.69], [10.46, 1.22, z + 0.36]);
  k.box('metal', C.chrome, [0.025, 0.38, 0.035], [10.2, 1.5, z + 0.722]);
  k.box('metal', C.chrome, [0.025, 0.5, 0.035], [10.2, 0.85, z + 0.722]);
  // Water cooler.
  k.box('matte', C.white, [0.34, 0.98, 0.34], [6.05, 0.49, z + 0.3]);
  k.cyl('frost', '#BFD8E6', [0.13, 0.15, 0.34], [6.05, 1.15, z + 0.3], 10);
  k.box('matte', C.ink, [0.2, 0.1, 0.02], [6.05, 0.72, z + 0.475]);
  // Table and chairs on a round rug.
  const [tx, , tz] = SPOTS.break;
  k.cyl('matte', C.rugEdge, [1.66, 1.66, 0.006], [tx, 0.003, tz], 44);
  k.cyl('matte', C.rugDark, [1.56, 1.56, 0.006], [tx, 0.007, tz], 44);
  k.cyl('satin', C.white, [0.64, 0.64, 0.04], [tx, 0.74, tz], 28);
  k.cyl('metal', C.gold, [0.05, 0.05, 0.7], [tx, 0.37, tz], 8);
  k.cyl('metal', C.gold, [0.3, 0.33, 0.025], [tx, 0.022, tz], 16);
  [0.5, 2.5, 4.3].forEach((a) => sideChair(k, [tx + Math.sin(a) * 0.98, 0, tz + Math.cos(a) * 0.98], a + Math.PI, C.wood));
  mug(k, [tx + 0.25, 0.76, tz + 0.1], C.gold);
  mug(k, [tx - 0.2, 0.76, tz - 0.22], C.black);
  sprig(k, [tx - 0.05, 0.76, tz + 0.12], rng);
  tree(k, [10.35, 0, tz + 0.3], rng, 1.05);
}

function lounge(k: Kit, rng: Rng) {
  const wl = WINDOWS.left;
  const mid = (wl.z0 + wl.z1) / 2;
  // A planter bench runs under the windows.
  k.box('matte', C.walnut, [0.44, 0.44, wl.z1 - wl.z0 - 0.3], [LEFT_X + 0.22, 0.22, mid]);
  k.box('matte', C.soil, [0.34, 0.02, wl.z1 - wl.z0 - 0.42], [LEFT_X + 0.22, 0.445, mid]);
  [-3.1, -2.2, -1.3, -0.4, 0.4].forEach((pz, i) => (i % 2 ? spikes(k, [LEFT_X + 0.22, 0.3, pz], rng, 0.8, C.walnut) : bush(k, [LEFT_X + 0.22, 0.16, pz], rng, 0.62, C.walnut)));
  k.sheet('matte', C.rugEdge, [3.0, 3.5], [-8.55, 0.002, mid]);
  k.sheet('matte', C.rugDark, [2.84, 3.34], [-8.55, 0.004, mid]);
  armchair(k, [-9.25, 0, mid - 0.95], Math.PI / 2 - 0.45);
  armchair(k, [-9.25, 0, mid + 0.95], Math.PI / 2 + 0.45);
  armchair(k, [-7.75, 0, mid], -Math.PI / 2, C.fabric);
  k.cyl('satin', C.black, [0.44, 0.44, 0.035], [-8.5, 0.4, mid], 22);
  for (let i = 0; i < 3; i++) k.cyl('metal', C.gold, [0.014, 0.014, 0.4], [-8.5 + Math.cos(i * 2.1) * 0.3, 0.2, mid + Math.sin(i * 2.1) * 0.3], 5);
  k.box('matte', C.cream, [0.22, 0.014, 0.3], [-8.42, 0.425, mid + 0.08], [0, 0.4, 0]);
  mug(k, [-8.62, 0.418, mid - 0.14], C.gold);
  floorLamp(k, [-9.95, 0, mid]);
}

function reception(k: Kit, rng: Rng) {
  k.box('metal', C.gold, [0.014, 0.024, SIGN.size[0] * 0.42], [LEFT_X + 0.014, SIGN.pos[1] - 0.38, SIGN.pos[2]]);
  // Waiting area under the sign.
  k.at([LEFT_X + 0.52, 0, 3.15], Math.PI / 2, () => sofa(k, 2.3));
  k.sheet('matte', C.rugEdge, [2.5, 3.2], [-9.5, 0.002, 3.15]);
  k.sheet('matte', C.rugWarm, [2.34, 3.04], [-9.5, 0.004, 3.15]);
  k.box('satin', C.black, [0.52, 0.04, 1.2], [-9.15, 0.38, 3.15]);
  for (const dz of [-0.5, 0.5]) for (const dx of [-0.2, 0.2]) k.cyl('metal', C.gold, [0.014, 0.014, 0.36], [-9.15 + dx, 0.18, 3.15 + dz], 5);
  k.box('matte', C.gold, [0.2, 0.03, 0.28], [-9.15, 0.415, 3.4], [0, 0.3, 0]);
  k.box('matte', C.cream, [0.2, 0.025, 0.28], [-9.14, 0.442, 3.39], [0, 0.1, 0]);
  sprig(k, [-9.15, 0.4, 2.8], rng, C.black);
  floorLamp(k, [LEFT_X + 0.45, 0, 1.45]);
  bush(k, [LEFT_X + 0.5, 0, 4.85], rng, 1.05, C.black);
  // Welcome desk facing the door.
  k.box('matte', C.black, [0.7, 1.05, 2.2], [-7.75, 0.525, 5.75]);
  k.box('metal', C.gold, [0.78, 0.04, 2.3], [-7.75, 1.07, 5.75]);
  k.box('metal', C.gold, [0.012, 0.012, 2.2], [-8.106, 0.3, 5.75]);
  k.box('satin', C.woodLight, [0.5, 0.04, 2.0], [-7.2, 0.76, 5.75]);
  k.box('matte', C.walnut, [0.46, 0.72, 0.04], [-7.2, 0.36, 4.78]);
  k.box('matte', C.walnut, [0.46, 0.72, 0.04], [-7.2, 0.36, 6.72]);
  k.box('metal', C.steel, [0.23, 0.016, 0.34], [-7.2, 0.788, 5.5]);
  k.box('metal', C.steel, [0.012, 0.22, 0.34], [-7.32, 0.9, 5.5], [0, 0, -0.25]);
  k.ball('metal', C.gold, 0.05, [-7.75, 1.1, 5.1], [1, 0.6, 1], 1);
  sprig(k, [-7.75, 1.09, 6.5], rng, C.gold);
  taskChair(k, [-6.7, 0, 5.75], -Math.PI / 2 + 0.3);
  k.sheet('matte', C.rugDark, [1.4, 1.3], [-9.95, 0.004, 6.1]);
}

function teamTable(k: Kit, rng: Rng) {
  k.at([-1.7, 0, 5.65], 0, () => {
    k.sheet('matte', C.rugEdge, [4.3, 3.0], [0, 0.002, 0]);
    k.sheet('matte', C.rugWarm, [4.14, 2.84], [0, 0.004, 0]);
    k.box('satin', C.wood, [2.7, 0.05, 1.05], [0, 0.745, 0]);
    for (const side of [-1, 1]) {
      k.box('matte', C.black, [0.06, 0.72, 0.8], [side * 1.1, 0.36, 0]);
      k.box('matte', C.black, [0.5, 0.04, 0.9], [side * 1.1, 0.02, 0]);
    }
    [-0.9, 0, 0.9].forEach((dx, i) => {
      sideChair(k, [dx + (rng() - 0.5) * 0.08, 0, 0.9], Math.PI + (rng() - 0.5) * 0.3, i === 1 ? C.cushion : C.fabric);
      sideChair(k, [dx + (rng() - 0.5) * 0.08, 0, -0.9], (rng() - 0.5) * 0.3, i === 1 ? C.fabric : C.cushion);
    });
    k.box('metal', C.steel, [0.34, 0.016, 0.23], [-0.5, 0.778, 0.18]);
    k.box('metal', C.steel, [0.34, 0.22, 0.012], [-0.5, 0.89, 0.05], [-0.28, 0, 0]);
    k.box('matte', C.paper, [0.21, 0.012, 0.3], [0.35, 0.777, -0.1], [0, 0.4, 0]);
    k.box('matte', C.paper, [0.21, 0.012, 0.3], [0.62, 0.777, 0.15], [0, -0.2, 0]);
    mug(k, [0.05, 0.77, 0.25], C.black);
    mug(k, [-0.95, 0.77, -0.2], C.gold);
    sprig(k, [1.0, 0.77, 0], rng, C.black);
  });
}

function storage(k: Kit, rng: Rng) {
  // A long cabinet between the bench and the HCM desks.
  const [x, z] = [3.55, 1.5];
  k.box('matte', C.wallShade, [0.5, 0.95, 2.7], [x, 0.475, z]);
  k.box('matte', C.ink, [0.46, 0.06, 2.66], [x, 0.03, z]);
  k.box('satin', C.wood, [0.56, 0.04, 2.76], [x, 0.97, z]);
  for (let i = 0; i < 4; i++) {
    const dz = z - 1.35 + (i + 0.5) * 0.675;
    k.box('matte', C.ink, [0.012, 0.84, 0.012], [x + 0.252, 0.5, dz - 0.3375]);
    k.box('metal', C.gold, [0.02, 0.018, 0.14], [x + 0.26, 0.82, dz]);
  }
  bush(k, [x, 0.99, z - 0.95], rng, 0.5, C.black);
  k.cyl('metal', C.gold, [0.09, 0.11, 0.02], [x, 1.0, z + 0.2], 10);
  k.cyl('metal', C.gold, [0.012, 0.012, 0.14], [x, 1.07, z + 0.2], 5);
  k.ball('satin', '#5E7C86', 0.14, [x, 1.26, z + 0.2], 1, 1);
  k.torus('metal', C.gold, 0.155, 0.008, [x, 1.26, z + 0.2], [0.4, 0, 0], 20);
  for (let i = 0; i < 4; i++) k.box('matte', BOOKS[(i * 2 + 1) % BOOKS.length], [0.26, 0.04, 0.2], [x, 1.01 + i * 0.041, z + 0.95], [0, i * 0.25 - 0.3, 0]);
  tree(k, [10.2, 0, 6.5], rng, 1.1);
  bush(k, [4.0, 0, 6.7], rng, 1.0, C.black);
}

export interface OfficeSet { geometry: Partial<Record<Bucket, THREE.BufferGeometry>>; triangles: number }

export function buildOffice(): OfficeSet {
  const k = new Kit();
  // One seeded stream, so the mugs, books, and leaves land the same way on every run.
  const rng = createRng('office-set');
  shell(k);
  offices(k, rng);
  pods(k, rng);
  hcmDesk(k, rng);
  noticeWall(k, rng);
  breakRoom(k, rng);
  lounge(k, rng);
  reception(k, rng);
  teamTable(k, rng);
  storage(k, rng);
  const triangles = k.triangles();
  return { geometry: k.build(), triangles };
}
