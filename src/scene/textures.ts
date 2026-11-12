import * as THREE from 'three';
import { createRng } from '../engine/rng';

/** Every texture here is drawn in the browser: no image downloads, and the same picture on every run. */
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Pale oak planks running the length of the room. One tile covers 4 m by 4 m. */
export function plankTexture(repeat: [number, number]): THREE.CanvasTexture {
  const S = 1024, ROWS = 20;
  const [c, g] = canvas(S, S);
  const rng = createRng('floor-planks');
  const rowH = S / ROWS;
  for (let r = 0; r < ROWS; r++) {
    let x = -rng() * 300;
    while (x < S) {
      const len = 230 + rng() * 260;
      const tone = 0.94 + rng() * 0.1;
      const warm = rng() * 7;
      g.fillStyle = `rgb(${Math.round(214 * tone + warm)}, ${Math.round(197 * tone + warm * 0.5)}, ${Math.round(168 * tone)})`;
      // Draw twice so a plank that runs off the right edge continues on the left: the tile repeats without a seam.
      for (const dx of [0, -S]) g.fillRect(x + dx, r * rowH, len, rowH);
      g.fillStyle = 'rgba(92, 66, 30, 0.34)';
      for (const dx of [0, -S]) g.fillRect(x + len - 1.5 + dx, r * rowH, 1.5, rowH);
      x += len;
    }
    g.fillStyle = 'rgba(92, 66, 30, 0.3)';
    g.fillRect(0, r * rowH, S, 1.5);
  }
  // Faint grain along the planks.
  for (let i = 0; i < 520; i++) {
    const y = rng() * S, x = rng() * S, len = 60 + rng() * 240;
    g.fillStyle = `rgba(${rng() < 0.5 ? '255, 244, 220' : '110, 80, 40'}, ${0.03 + rng() * 0.05})`;
    for (const dx of [0, -S]) g.fillRect(x + dx, y, len, 1);
  }
  return finish(c, repeat);
}

/** Soft round falloff, white to black: the shape of lamplight pooling on a surface (drawn with additive blending). */
export function poolTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [stop, v] of [[0, 1], [0.18, 0.78], [0.4, 0.4], [0.65, 0.13], [0.85, 0.03], [1, 0]] as const) {
    const n = Math.round(v * 255);
    grad.addColorStop(stop, `rgb(${n}, ${n}, ${n})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return finish(c);
}

/** The table the model stands on: a warm pool of light with the plinth's shadow in the middle. */
export function groundTexture(size: number, plinth: { w: number; d: number }): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = canvas(S, S);
  const glow = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  glow.addColorStop(0, 'rgba(226, 199, 143, 0.30)');
  glow.addColorStop(0.35, 'rgba(207, 174, 112, 0.13)');
  glow.addColorStop(0.7, 'rgba(207, 174, 112, 0.03)');
  glow.addColorStop(1, 'rgba(207, 174, 112, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);
  // A blurred dark footprint, a little larger than the plinth. The rectangle itself is drawn off canvas; only its shadow lands here.
  const px = S / size;
  const w = plinth.w * px, h = plinth.d * px;
  g.shadowColor = 'rgba(0, 0, 0, 0.8)';
  g.shadowBlur = 26;
  g.shadowOffsetX = S * 2;
  g.fillStyle = '#000';
  g.fillRect(S / 2 - w / 2 - S * 2, S / 2 - h / 2, w, h);
  return finish(c);
}

export interface BoardSheet { month: string; firstWeekday: number; days: number; marks: number[]; today?: number }

/**
 * The bulletin board: cork, a payroll calendar with this run's deadlines marked, and a few pinned notes.
 * Redrawn once the brand fonts have loaded, so the lettering matches the rest of the game.
 */
export function boardTexture(sheet: BoardSheet): THREE.CanvasTexture {
  const W = 720, H = 440;
  const [c, g] = canvas(W, H);
  const tex = finish(c);
  const draw = () => {
    const rng = createRng('board');
    g.shadowColor = 'transparent';
    g.fillStyle = '#B58A52';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? '90, 60, 25' : '236, 205, 150'}, ${0.08 + rng() * 0.14})`;
      g.fillRect(rng() * W, rng() * H, 1 + rng() * 2.5, 1 + rng() * 2.5);
    }
    const paper = (x: number, y: number, w: number, h: number, rot: number, fill: string, body: () => void) => {
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate(rot);
      g.translate(-w / 2, -h / 2);
      g.shadowColor = 'rgba(40, 25, 5, 0.45)';
      g.shadowBlur = 10;
      g.shadowOffsetY = 4;
      g.fillStyle = fill;
      g.fillRect(0, 0, w, h);
      g.shadowColor = 'transparent';
      body();
      // Pin
      g.fillStyle = '#946E24';
      g.beginPath(); g.arc(w / 2, 12, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#E2C78F';
      g.beginPath(); g.arc(w / 2 - 1.5, 10.5, 2.2, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    const lines = (x: number, y: number, w: number, n: number, gap: number) => {
      g.fillStyle = 'rgba(28, 28, 28, 0.32)';
      for (let i = 0; i < n; i++) g.fillRect(x, y + i * gap, w * (i === n - 1 ? 0.55 : 0.82 + rng() * 0.18), 4);
    };
    // The calendar sheet.
    paper(34, 30, 330, 380, -0.012, '#FBF8F1', () => {
      g.fillStyle = '#1C1C1C';
      g.fillRect(0, 0, 330, 58);
      g.fillStyle = '#CFAE70';
      g.font = '700 30px Antonio, "Arial Narrow", sans-serif';
      g.textBaseline = 'middle';
      g.fillText(sheet.month.toUpperCase(), 18, 31);
      const cw = 294 / 7, ch = 44, x0 = 18, y0 = 100;
      g.font = '700 15px Antonio, "Arial Narrow", sans-serif';
      g.fillStyle = '#946E24';
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => g.fillText(d, x0 + i * cw + cw / 2 - 5, 80));
      g.font = '500 18px Inter, Arial, sans-serif';
      for (let d = 1; d <= sheet.days; d++) {
        const i = sheet.firstWeekday + d - 1;
        const x = x0 + (i % 7) * cw, y = y0 + Math.floor(i / 7) * ch;
        if (sheet.marks.includes(d)) { g.fillStyle = '#CFAE70'; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); }
        if (sheet.today === d) { g.strokeStyle = '#1C1C1C'; g.lineWidth = 3; g.strokeRect(x + 3.5, y + 3.5, cw - 7, ch - 7); }
        g.fillStyle = '#1C1C1C';
        g.fillText(String(d), x + 9, y + ch / 2 + 1);
      }
      g.strokeStyle = 'rgba(28, 28, 28, 0.16)';
      g.lineWidth = 1;
      for (let r = 0; r <= 6; r++) { g.beginPath(); g.moveTo(x0, y0 + r * ch); g.lineTo(x0 + 294, y0 + r * ch); g.stroke(); }
    });
    paper(400, 36, 130, 160, 0.05, '#FFFFFF', () => { g.fillStyle = '#946E24'; g.fillRect(14, 30, 70, 7); lines(14, 52, 100, 6, 16); });
    paper(556, 50, 132, 132, -0.06, '#F1DFB8', () => lines(14, 36, 104, 5, 17));
    paper(404, 232, 150, 176, -0.03, '#F5F3EF', () => { g.fillStyle = '#1C1C1C'; g.fillRect(14, 30, 86, 7); lines(14, 54, 120, 7, 16); });
    paper(580, 218, 110, 150, 0.07, '#CFAE70', () => { g.fillStyle = 'rgba(28, 28, 28, 0.5)'; g.fillRect(14, 32, 60, 6); lines(14, 52, 82, 5, 16); });
    tex.needsUpdate = true;
  };
  draw();
  if (typeof document !== 'undefined' && document.fonts) void document.fonts.load('700 30px Antonio').then(draw).catch(() => undefined);
  return tex;
}

/** Lettering for the wall behind reception, drawn in the headline face: black on the cream wall. Transparent around the letters. */
export function signTexture(text: string): THREE.CanvasTexture {
  const W = 1024, H = 128;
  const [c, g] = canvas(W, H);
  const tex = finish(c);
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#1C1C1C';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    let px = 84;
    do { g.font = `400 ${px}px "Libre Caslon Display", Georgia, serif`; px -= 4; } while (g.measureText(text).width > W - 40 && px > 20);
    g.fillText(text, W / 2, H / 2 + 4);
    tex.needsUpdate = true;
  };
  draw();
  if (typeof document !== 'undefined' && document.fonts) void document.fonts.load('400 76px "Libre Caslon Display"').then(draw).catch(() => undefined);
  return tex;
}

/** What glows on your two screens: a work queue in outline. Shapes only, so it stands in for the system without copying it. */
export function terminalTexture(): THREE.CanvasTexture {
  const W = 512, H = 300;
  const [c, g] = canvas(W, H);
  const rng = createRng('terminal');
  g.fillStyle = '#17130C';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#CFAE70';
  g.fillRect(0, 0, W, 38);
  g.fillStyle = '#1C1C1C';
  g.fillRect(16, 13, 120, 12);
  g.fillStyle = '#2A2317';
  g.fillRect(0, 38, 118, H - 38);
  for (let i = 0; i < 6; i++) { g.fillStyle = i === 1 ? '#CFAE70' : '#6E5F3F'; g.fillRect(16, 60 + i * 34, 60 + rng() * 30, 9); }
  for (let i = 0; i < 6; i++) {
    const y = 56 + i * 39;
    g.fillStyle = i === 0 ? '#3B3020' : '#211B11';
    g.fillRect(134, y, W - 150, 30);
    g.fillStyle = i === 0 ? '#F3E7CC' : '#B9A679';
    g.fillRect(148, y + 10, 120 + rng() * 120, 9);
    g.fillStyle = i < 2 ? '#CFAE70' : '#5E5137';
    g.fillRect(W - 86, y + 9, 54, 12);
  }
  return finish(c);
}
