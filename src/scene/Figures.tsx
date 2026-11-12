import { createInstances } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PersonStatus, PersonStatusKind } from '../status';
import { seatFor, TOWARD_CAMERA } from './layout';
import { FX } from './Office';
import { C, OUTFIT, SKIN } from './palette';
import { voicePlayer } from '../audio/voice';
import type { LookT, PersonT } from '../../content/schemas';

/**
 * Everyone in the office is drawn from six shared shapes (torso, head, hair cap, hair puff, limb, ball), each one
 * instanced across all the figures. Thirteen people cost a dozen draw calls instead of a hundred and fifty.
 */
const [Torsos, Torso] = createInstances();
const [Heads, Head] = createInstances();
const [Caps, Cap] = createInstances();
const [Puffs, Puff] = createInstances();
const [Limbs, Limb] = createInstances();
const [Balls, Ball] = createInstances();

const INK = new THREE.Color('#191614');
const SHOE = new THREE.Color('#201D1B');

/** Shared shapes and materials, wrapped around all the figures. */
function Parts({ children }: { children: ReactNode }) {
  const cloth = { roughness: 0.82, metalness: 0 };
  return (
    <Torsos limit={32} castShadow receiveShadow frustumCulled={false}>
      <capsuleGeometry args={[0.165, 0.26, 3, 10]} />
      <meshStandardMaterial {...cloth} />
      <Heads limit={32} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial roughness={0.68} />
        <Caps limit={32} castShadow frustumCulled={false}>
          <sphereGeometry args={[0.169, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
          <meshStandardMaterial roughness={0.78} side={THREE.DoubleSide} />
          <Puffs limit={48} castShadow frustumCulled={false}>
            <icosahedronGeometry args={[0.1, 1]} />
            <meshStandardMaterial roughness={0.85} flatShading />
            <Limbs limit={160} castShadow frustumCulled={false}>
              <capsuleGeometry args={[0.05, 0.26, 2, 7]} />
              <meshStandardMaterial {...cloth} />
              <Balls limit={260} castShadow frustumCulled={false}>
                <sphereGeometry args={[0.05, 8, 6]} />
                <meshStandardMaterial roughness={0.7} />
                {children}
              </Balls>
            </Limbs>
          </Puffs>
        </Caps>
      </Heads>
    </Torsos>
  );
}

/** Someone without a look in content still gets a figure: a default haircut and their outfit color. */
function fallbackLook(p: PersonT, index: number): LookT {
  return { skin: SKIN[index % SKIN.length], hair: '#2A1D17', hairStyle: 'short', top: OUTFIT[p.outfit] };
}

interface Tones { skin: THREE.Color; hair: THREE.Color; top: THREE.Color; bottom: THREE.Color; accent: THREE.Color | null; beard: THREE.Color | null }

function Hair({ look, t }: { look: LookT; t: Tones }) {
  const beard = t.beard && <Puff color={t.beard} position={[0, -0.078, 0.066]} scale={[1.32, 0.78, 0.98]} />;
  switch (look.hairStyle) {
    case 'bald': return <>{beard}</>;
    case 'crop': return <><Cap color={t.hair} position={[0, 0.004, -0.004]} rotation={[-0.62, 0, 0]} scale={[1, 0.96, 1]} />{beard}</>;
    case 'short': return <>
      <Cap color={t.hair} rotation={[-0.64, 0, 0]} scale={[1.03, 1, 1.04]} />
      <Puff color={t.hair} position={[0, 0.122, -0.012]} scale={[1.3, 0.6, 1.36]} />
      {beard}
    </>;
    case 'bob': return <>
      <Cap color={t.hair} rotation={[-0.52, 0, 0]} scale={[1.08, 1.06, 1.09]} />
      <Ball color={t.hair} position={[0, -0.05, -0.06]} scale={[3.4, 2.9, 2.6]} />
    </>;
    case 'long': return <>
      <Cap color={t.hair} rotation={[-0.58, 0, 0]} scale={[1.08, 1.05, 1.09]} />
      <Ball color={t.hair} position={[0, -0.15, -0.085]} scale={[3.3, 5.1, 2.2]} />
    </>;
    case 'ponytail': return <>
      <Cap color={t.hair} rotation={[-0.66, 0, 0]} scale={[1.03, 1, 1.04]} />
      <Puff color={t.hair} position={[0, 0.02, -0.2]} rotation={[0.55, 0, 0]} scale={[0.62, 1.35, 0.62]} />
    </>;
    case 'afro': return <Puff color={t.hair} position={[0, 0.062, -0.022]} scale={[2.3, 2.12, 2.24]} />;
  }
}

/** Round glasses: two rims and a bridge, one small mesh for the one person who wears them. */
function Glasses() {
  const geo = useMemo(() => {
    const rim = (x: number) => new THREE.TorusGeometry(0.036, 0.006, 5, 16).translate(x, 0, 0);
    const bridge = new THREE.BoxGeometry(0.04, 0.008, 0.008);
    return mergeGeometries([rim(-0.056), rim(0.056), bridge]);
  }, []);
  return <mesh geometry={geo ?? undefined} position={[0, 0.014, 0.158]}><meshStandardMaterial color="#1C1C1C" roughness={0.4} metalness={0.5} /></mesh>;
}

function Figure({ person, index, status, speaking, reduced, onActivate, onHover }: {
  person: PersonT; index: number; status: PersonStatusKind; speaking: boolean; reduced: boolean; onActivate: (personId: string) => void; onHover: (personId: string | null) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const [hover, setHoverState] = useState(false);
  const setHover = (on: boolean) => { setHoverState(on); onHover(on ? person.id : null); };
  const standing = status === 'talk' || speaking;
  const seat = seatFor(person.desk);
  const look = person.look ?? fallbackLook(person, index);
  const t = useMemo<Tones>(() => ({
    skin: new THREE.Color(look.skin), hair: new THREE.Color(look.hair), top: new THREE.Color(look.top),
    bottom: new THREE.Color(look.bottom ?? '#34322F'), accent: look.accent ? new THREE.Color(look.accent) : null, beard: look.beard ? new THREE.Color(look.beard) : null,
  }), [look]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  useFrame(({ clock }) => {
    if (reduced) return;
    const time = clock.elapsedTime + index * 1.7;
    if (torso.current) torso.current.rotation.z = Math.sin(time * 0.8) * 0.02;
    if (!standing && seat.lounge) {
      // Waiting: hands in the lap, looking around the room.
      if (head.current) { head.current.rotation.x = 0.05; head.current.rotation.y = Math.sin(time * 0.3) * 0.5; }
    } else if (!standing) {
      // At work: typing comes in bursts, with a glance away from the screen now and then.
      const burst = THREE.MathUtils.smoothstep(Math.sin(time * 0.42 + index), -0.35, 0.15);
      if (armL.current) armL.current.rotation.x = -1.15 + Math.sin(time * 9) * 0.06 * burst;
      if (armR.current) armR.current.rotation.x = -1.15 + Math.cos(time * 9) * 0.06 * burst;
      if (head.current) {
        head.current.rotation.x = 0.14 - (1 - burst) * 0.1;
        head.current.rotation.y = Math.sin(time * 0.23 + index * 2.1) * 0.22 * (1 - burst * 0.7);
      }
    } else {
      // Talking: the gesture and a small nod follow the loudness of the recorded line.
      const lv = speaking ? voicePlayer.level() : 0;
      if (armR.current) armR.current.rotation.x = speaking ? -0.4 - lv * 0.5 + Math.sin(time * 3) * 0.08 : -0.12 + Math.sin(time * 1.1) * 0.03;
      if (armL.current) armL.current.rotation.x = -0.1 - lv * 0.18;
      if (head.current) { head.current.rotation.x = lv * 0.16; head.current.rotation.y = Math.sin(time * 0.5) * 0.08; }
    }
    if (root.current) root.current.position.y = standing ? Math.abs(Math.sin(time * 1.2)) * 0.012 : 0;
  });

  const hipY = standing ? 0.84 : 0.5;
  const [x, , z] = standing ? seat.stand : seat.pos;
  return (
    <group position={[x, 0, z]} rotation-y={standing ? TOWARD_CAMERA : seat.ry}>
      <group ref={root}>
        {[-1, 1].map((side) => (
          <group key={`${side}${standing}`} position={[side * 0.09, hipY, 0]}>
            {standing ? <>
              <Limb color={t.bottom} position={[0, -0.39, 0]} scale={[1.55, 2.08, 1.55]} />
              <Ball color={SHOE} position={[0, -0.8, 0.045]} scale={[1.3, 0.74, 2.2]} />
            </> : <>
              <Limb color={t.bottom} position={[0, 0, 0.19]} rotation={[Math.PI / 2, 0, 0]} scale={[1.55, 1.16, 1.55]} />
              <Limb color={t.bottom} position={[0, -0.22, 0.4]} scale={[1.35, 1.16, 1.35]} />
              <Ball color={SHOE} position={[0, -0.462, 0.445]} scale={[1.3, 0.74, 2.2]} />
            </>}
          </group>
        ))}
        <group ref={torso} position={[0, hipY, 0]} rotation-x={standing ? 0 : 0.07}>
          <Torso color={t.top} position={[0, 0.3, 0]} scale={[1, 1, 0.8]} />
          {t.accent && <Ball color={t.accent} position={[0, 0.5, 0.082]} scale={[1.5, 1.05, 0.8]} />}
          <group ref={head} position={[0, 0.735, 0]}>
            <Head color={t.skin} />
            <Ball color={INK} position={[-0.058, -0.002, 0.148]} scale={0.4} />
            <Ball color={INK} position={[0.058, -0.002, 0.148]} scale={0.4} />
            <Hair look={look} t={t} />
            {look.glasses && <Glasses />}
          </group>
          {[-1, 1].map((side) => (
            <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.215, 0.5, 0]} rotation-x={standing ? -0.1 : seat.lounge ? -0.55 : -1.15}>
              <Limb color={t.top} position={[0, -0.17, 0]} scale={[1.15, 1, 1.15]} />
              <Ball color={t.skin} position={[0, -0.385, 0]} scale={1.04} />
            </group>
          ))}
        </group>
      </group>
      {/* One click target per person, so pointing never has to test every instanced part. */}
      <mesh
        visible={false}
        userData={{ person: person.id }}
        position={[0, standing ? 0.85 : 0.72, standing ? 0 : 0.12]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onActivate(person.id); }}
      >
        <boxGeometry args={[0.62, standing ? 1.7 : 1.44, 0.8]} />
        <meshBasicMaterial />
      </mesh>
      {(hover || speaking) && (
        <mesh position={[0, 0.017, 0]} rotation-x={-Math.PI / 2} layers={FX}>
          <ringGeometry args={[0.42, 0.5, 36]} />
          <meshBasicMaterial color={C.goldHi} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export function Figures({ cast, reduced, onActivate, onHover, speaker }: { cast: { person: PersonT; status: PersonStatus }[]; reduced: boolean; onActivate: (personId: string) => void; onHover: (personId: string | null) => void; speaker: string | null }) {
  return (
    <Parts>
      {cast.map(({ person, status }, i) => (
        <Figure key={person.id} person={person} index={i} status={status.kind} speaking={speaker === person.id} reduced={reduced} onActivate={onActivate} onHover={onHover} />
      ))}
    </Parts>
  );
}

/** How high a person's status symbol floats, standing or seated. */
export const tagHeight = (standing: boolean) => (standing ? 0.84 : 0.5) + 1.24;
