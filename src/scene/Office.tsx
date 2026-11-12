import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { department, payday, week } from '../content';
import { at } from '../engine/clock';
import { createRng } from '../engine/rng';
import { useGame } from '../store/game';
import { BUCKETS, type Bucket } from './kit';
import { BACK_Z, LEFT_X, OFFICE, OFFICES, PLINTH, RING, WALL, type Vec3 } from './layout';
import { dayProgress, skyColors } from './Lighting';
import { C } from './palette';
import { BOARD, CLOCK, SIGN, TERMINAL_SCREENS, WINDOWS, buildOffice } from './set';
import { boardTexture, groundTexture, plankTexture, poolTexture, signTexture, terminalTexture, type BoardSheet } from './textures';
import { WallClock } from './WallClock';

/** Rings, light pools, and other flat effects sit on their own layer, so the contact shadow pass leaves them out. */
export const FX = new THREE.Layers();
FX.set(1);

const SOLID: Bucket[] = ['matte', 'satin', 'metal'];
const ORDER: Partial<Record<Bucket, number>> = { pool: 2, glass: 3, frost: 4 };

function materials(): Record<Bucket, THREE.Material> {
  return {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true }),
    satin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.02, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.88, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.25, depthWrite: false, side: THREE.DoubleSide }),
    frost: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.6, roughness: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ vertexColors: true, map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  };
}

/** Where a click counts for each place. Invisible, so the merged set needs no per-object click targets. */
export const VOLUMES: Record<string, { pos: Vec3; size: Vec3 }> = {
  terminal: { pos: [6.2, 0.75, 4.65], size: [2.9, 1.5, 2.3] },
  board: { pos: [2.6, 1.3, BACK_Z + 0.5], size: [2.9, 2.6, 1] },
  break: { pos: [8.5, 0.9, -5.7], size: [4.6, 1.8, 3.2] },
  reception: { pos: [LEFT_X + 1.4, 0.7, 3.2], size: [2.8, 1.4, 3.2] },
  ...Object.fromEntries(OFFICES.map((o) => [o.id, { pos: [o.x, OFFICE.h / 2, OFFICE.z] as Vec3, size: [OFFICE.w - 0.1, OFFICE.h, OFFICE.d - 0.1] as Vec3 }])),
};

/** A person inside a place wins the click: pointing at Dana in her office opens Dana's request, not the room's. */
const overPerson = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.intersections.some((i) => typeof i.object.userData.person === 'string');

/** Clickable zone. Hover shows a ring and the place's name; click opens the waiting task, or just focuses the camera. */
export function Hotspot({ id, onActivate, onHover }: { id: string; onActivate: (id: string) => void; onHover: (id: string | null) => void }) {
  const [hover, setHoverState] = useState(false);
  const v = VOLUMES[id];
  const setHover = (on: boolean) => { setHoverState(on); onHover(on ? id : null); };
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  return (
    <>
      <mesh
        position={v.pos}
        visible={false}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => { const on = !overPerson(e); if (on !== hover) setHover(on); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { if (hover) setHover(false); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { if (overPerson(e)) return; e.stopPropagation(); onActivate(id); }}
      >
        <boxGeometry args={v.size} />
        <meshBasicMaterial />
      </mesh>
      {hover && (
        <mesh position={[RING[id][0], 0.016, RING[id][2]]} rotation-x={-Math.PI / 2} layers={FX}>
          <ringGeometry args={[1.05, 1.17, 56]} />
          <meshBasicMaterial color={C.goldHi} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </>
  );
}

/** Gold pulse on the floor where a task is waiting. With reduced motion it is a still ring. */
export function PendingPulse({ pos, reduced }: { pos: Vec3; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !mat.current || reduced) return;
    const t = (clock.elapsedTime % 1.8) / 1.8;
    ref.current.scale.setScalar(0.7 + t * 0.7);
    mat.current.opacity = 0.85 * (1 - t);
  });
  return (
    <group position={[pos[0], 0.018, pos[2]]} rotation-x={-Math.PI / 2}>
      <mesh layers={FX}>
        <ringGeometry args={[0.5, 0.56, 48]} />
        <meshBasicMaterial color={C.goldHi} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ref} layers={FX}>
        <ringGeometry args={[0.8, 0.94, 48]} />
        <meshBasicMaterial ref={mat} color={C.goldHi} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The sky behind both window walls, with a hazy skyline. Follows the sim clock from morning to evening. */
function Sky() {
  const { geometry, split } = useMemo(() => {
    const quads: number[][] = [];
    const rng = createRng('skyline');
    const zb = BACK_Z - WALL.t + 0.03, xl = LEFT_X - WALL.t + 0.03;
    const b = WINDOWS.back, l = WINDOWS.left;
    quads.push([b.x0, b.y0, zb, b.x1, b.y0, zb, b.x1, b.y1, zb, b.x0, b.y1, zb]);
    quads.push([xl, l.y0, l.z1, xl, l.y0, l.z0, xl, l.y1, l.z0, xl, l.y1, l.z1]);
    const sky = quads.length;
    for (let x = b.x0; x < b.x1 - 0.2;) {
      const w = 0.35 + rng() * 0.6, h = 0.18 + rng() * 0.62;
      const x1 = Math.min(b.x1, x + w);
      quads.push([x, b.y0, zb + 0.004, x1, b.y0, zb + 0.004, x1, b.y0 + h, zb + 0.004, x, b.y0 + h, zb + 0.004]);
      x = x1 + rng() * 0.12;
    }
    for (let z = l.z0; z < l.z1 - 0.2;) {
      const w = 0.35 + rng() * 0.6, h = 0.16 + rng() * 0.5;
      const z1 = Math.min(l.z1, z + w);
      quads.push([xl + 0.004, l.y0, z1, xl + 0.004, l.y0, z, xl + 0.004, l.y0 + h, z, xl + 0.004, l.y0 + h, z1]);
      z = z1 + rng() * 0.12;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(quads.flat(), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(quads.length * 12), 3));
    g.setIndex(quads.flatMap((_, i) => [i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3]));
    return { geometry: g, split: sky };
  }, []);
  const colors = useRef({ top: new THREE.Color(), horizon: new THREE.Color(), haze: new THREE.Color(), slate: new THREE.Color('#5F6F86'), last: -1 });
  useFrame(() => {
    const p = dayProgress(useGame.getState().snap?.time);
    const c = colors.current;
    if (Math.abs(p - c.last) < 0.002) return;
    c.last = p;
    skyColors(p, c.top, c.horizon);
    c.haze.copy(c.horizon).lerp(c.slate, 0.42);
    const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let q = 0; q < attr.count / 4; q++) {
      // Sky quads fade from horizon to zenith; skyline quads are one hazy tone.
      const low = q < split ? c.horizon : c.haze;
      const high = q < split ? c.top : c.haze;
      [low, low, high, high].forEach((col, i) => attr.setXYZ(q * 4 + i, col.r, col.g, col.b));
    }
    attr.needsUpdate = true;
  });
  return <mesh geometry={geometry}><meshBasicMaterial vertexColors toneMapped={false} /></mesh>;
}

/** Your two screens. They breathe gold while something is waiting at your desk. */
function TerminalScreens({ pending, reduced }: { pending: boolean; reduced: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const map = useMemo(terminalTexture, []);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const v = !pending ? 0.78 : reduced ? 1.1 : 1 + Math.sin(clock.elapsedTime * 3) * 0.16;
    mat.current.color.setScalar(v);
  });
  return (
    <>
      {TERMINAL_SCREENS.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-y={s.ry}>
          <planeGeometry args={s.size} />
          <meshBasicMaterial ref={i === 0 ? mat : undefined} map={map} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

/** The payroll calendar on the bulletin board: this run's month, with its deadlines and pay day marked. */
function useBoardSheet(): BoardSheet {
  const time = useGame((s) => s.snap?.time);
  const start = at(week.start);
  const first = new Date(start * 60000);
  const y = first.getUTCFullYear(), m = first.getUTCMonth();
  const inMonth = (t: number) => { const d = new Date(t * 60000); return d.getUTCFullYear() === y && d.getUTCMonth() === m ? d.getUTCDate() : null; };
  const marks = [...week.deadlines.map((d) => inMonth(at(d))), inMonth(payday)].filter((d): d is number => d !== null);
  const today = inMonth(time ?? start) ?? undefined;
  const month = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return useMemo(
    () => ({ month, firstWeekday: new Date(Date.UTC(y, m, 1)).getUTCDay(), days: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), marks, today }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, today, marks.join(',')],
  );
}

export function Office({ onActivate, onHover, pendingAt, reduced, light = false }: { onActivate: (id: string) => void; onHover: (id: string | null) => void; pendingAt: Set<string>; reduced: boolean; light?: boolean }) {
  const set = useMemo(buildOffice, []);
  const mats = useMemo(materials, []);
  const planks = useMemo(() => plankTexture([PLINTH.w / 4, PLINTH.d / 4]), []);
  const ground = useMemo(() => groundTexture(64, { w: PLINTH.w + 1.4, d: PLINTH.d + 1.4 }), []);
  const sign = useMemo(() => signTexture(department.name), []);
  // Sharp planks at a slant cost a lot without graphics hardware; the lighter picture does without.
  useEffect(() => { planks.anisotropy = light ? 1 : 8; planks.needsUpdate = true; }, [planks, light]);
  const sheet = useBoardSheet();
  const board = useMemo(() => boardTexture(sheet), [sheet]);
  useEffect(() => () => board.dispose(), [board]);
  useEffect(() => {
    if (import.meta.env.DEV) console.info(`Office set: ${Math.round(set.triangles)} triangles`);
  }, [set]);

  return (
    <group>
      {/* The table under the model: a pool of light and the plinth's shadow. */}
      <mesh position={[0, -PLINTH.h - 0.06, 0]} rotation-x={-Math.PI / 2} layers={FX} renderOrder={-1}>
        <planeGeometry args={[64, 64]} />
        <meshBasicMaterial map={ground} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[PLINTH.w, PLINTH.d]} />
        <meshStandardMaterial map={planks} roughness={0.82} metalness={0} />
      </mesh>
      {BUCKETS.map((b) => set.geometry[b] && (
        <mesh key={b} geometry={set.geometry[b]} material={mats[b]} castShadow={SOLID.includes(b)} receiveShadow={SOLID.includes(b)} renderOrder={ORDER[b] ?? 0} {...(b === 'pool' ? { layers: FX } : {})} />
      ))}
      <Sky />
      <mesh position={BOARD.pos}>
        <planeGeometry args={BOARD.size} />
        <meshStandardMaterial map={board} roughness={0.95} />
      </mesh>
      <mesh position={SIGN.pos} rotation-y={Math.PI / 2}>
        <planeGeometry args={SIGN.size} />
        <meshBasicMaterial map={sign} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <WallClock position={CLOCK} />
      <TerminalScreens pending={pendingAt.has('terminal')} reduced={reduced} />
      {Object.keys(VOLUMES).map((id) => <Hotspot key={id} id={id} onActivate={onActivate} onHover={onHover} />)}
      {[...pendingAt].map((id) => RING[id] && <PendingPulse key={id} pos={RING[id]} reduced={reduced} />)}
    </group>
  );
}
