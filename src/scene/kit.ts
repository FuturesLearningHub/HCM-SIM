import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The office is built from primitives, then merged into one mesh per material. Hundreds of parts cost a handful of
 * draw calls, which is how the diorama stays under the 150 draw call budget in SPEC 9.6.
 */
export type Bucket = 'matte' | 'satin' | 'metal' | 'glass' | 'frost' | 'glow' | 'pool';
export type V3 = [number, number, number];
export const BUCKETS: Bucket[] = ['matte', 'satin', 'metal', 'glass', 'frost', 'glow', 'pool'];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export class Kit {
  private parts: Record<Bucket, THREE.BufferGeometry[]> = { matte: [], satin: [], metal: [], glass: [], frost: [], glow: [], pool: [] };
  private origin: V3 = [0, 0, 0];
  private turn = 0;

  /** Everything added inside `fn` is placed relative to `pos`, turned `ry` radians about the vertical axis. */
  at(pos: V3, ry: number, fn: () => void): this {
    const [o, t] = [this.origin, this.turn];
    this.origin = this.place(pos);
    this.turn = t + ry;
    fn();
    this.origin = o;
    this.turn = t;
    return this;
  }

  private place([x, y, z]: V3): V3 {
    const c = Math.cos(this.turn), s = Math.sin(this.turn);
    return [this.origin[0] + x * c + z * s, this.origin[1] + y, this.origin[2] - x * s + z * c];
  }

  /** Bake a transform into a geometry, paint every vertex one color, and file it under a material. */
  add(bucket: Bucket, geo: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 | number = 1): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    _p.set(...this.place(pos));
    _q.setFromEuler(_e.set(rot[0], rot[1] + this.turn, rot[2], 'YXZ'));
    if (typeof scale === 'number') _s.setScalar(scale); else _s.set(...scale);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) _c.toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (bucket !== 'pool') g.deleteAttribute('uv');
    this.parts[bucket].push(g);
    return this;
  }

  box(bucket: Bucket, color: string, size: V3, pos: V3, rot?: V3) { return this.add(bucket, new THREE.BoxGeometry(...size), color, pos, rot); }
  /** A box with softened edges, for the furniture the camera gets close to. */
  rbox(bucket: Bucket, color: string, size: V3, radius: number, pos: V3, rot?: V3) { return this.add(bucket, new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius), color, pos, rot); }
  cyl(bucket: Bucket, color: string, [top, bottom, h]: V3, pos: V3, segs = 10, rot?: V3) { return this.add(bucket, new THREE.CylinderGeometry(top, bottom, h, segs), color, pos, rot); }
  cone(bucket: Bucket, color: string, r: number, h: number, pos: V3, segs = 8, rot?: V3) { return this.add(bucket, new THREE.ConeGeometry(r, h, segs), color, pos, rot); }
  ball(bucket: Bucket, color: string, r: number, pos: V3, scale: V3 | number = 1, detail = 0, rot?: V3) { return this.add(bucket, new THREE.IcosahedronGeometry(r, detail), color, pos, rot, scale); }
  torus(bucket: Bucket, color: string, r: number, tube: number, pos: V3, rot?: V3, segs = 28) { return this.add(bucket, new THREE.TorusGeometry(r, tube, 6, segs), color, pos, rot); }
  /** A flat sheet facing up: rugs, paper, light pooling on a surface. */
  sheet(bucket: Bucket, color: string, [w, d]: [number, number], pos: V3, ry = 0) { return this.add(bucket, new THREE.PlaneGeometry(w, d), color, pos, [-Math.PI / 2, ry, 0]); }
  /** A flat sheet standing up, facing +z before rotation: screens, pictures, signs. */
  panel(bucket: Bucket, color: string, [w, h]: [number, number], pos: V3, ry = 0) { return this.add(bucket, new THREE.PlaneGeometry(w, h), color, pos, [0, ry, 0]); }

  /** One merged geometry per material that has parts. */
  build(): Partial<Record<Bucket, THREE.BufferGeometry>> {
    const out: Partial<Record<Bucket, THREE.BufferGeometry>> = {};
    for (const b of BUCKETS) {
      if (!this.parts[b].length) continue;
      const merged = mergeGeometries(this.parts[b], false);
      this.parts[b].forEach((g) => g.dispose());
      if (merged) { merged.computeBoundingSphere(); out[b] = merged; }
    }
    return out;
  }

  /** How many triangles the set holds, for the performance budget. */
  triangles(): number {
    return BUCKETS.reduce((n, b) => n + this.parts[b].reduce((m, g) => m + g.attributes.position.count / 3, 0), 0);
  }
}
