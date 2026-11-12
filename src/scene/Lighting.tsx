import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { minuteOfDay } from '../engine/clock';

/** Sun arcs across the window wall from 8:00 to 18:00: warm low morning, white noon, amber evening. */
const MORNING = new THREE.Color('#FFE2BE');
const NOON = new THREE.Color('#FFF5E6');
const EVENING = new THREE.Color('#FDC48A');

/** The sky seen through the windows at 8:00, 13:00, and 18:00: [top, horizon]. */
const SKY: [THREE.Color, THREE.Color][] = [
  [new THREE.Color('#A9C9E8'), new THREE.Color('#FBE3C4')],
  [new THREE.Color('#8FBEEA'), new THREE.Color('#DDEBF5')],
  [new THREE.Color('#7E8FB8'), new THREE.Color('#F6B77E')],
];

export function dayProgress(time: number | undefined): number {
  if (time === undefined) return 0.42;
  return Math.min(1, Math.max(0, (minuteOfDay(time) - 480) / 600));
}

export function sunColor(p: number, out = new THREE.Color()): THREE.Color {
  return p < 0.5 ? out.copy(MORNING).lerp(NOON, p * 2) : out.copy(NOON).lerp(EVENING, (p - 0.5) * 2);
}

/** Sky colors for a moment in the day. Writes into `top` and `horizon`. */
export function skyColors(p: number, top: THREE.Color, horizon: THREE.Color) {
  const [a, b, t] = p < 0.5 ? [SKY[0], SKY[1], p * 2] : [SKY[1], SKY[2], (p - 0.5) * 2];
  top.copy(a[0]).lerp(b[0], t);
  horizon.copy(a[1]).lerp(b[1], t);
}

/** `light` is the picture for slow machines: no sun shadows and no reflections, with the fill raised to match. */
export function Lighting({ light = false }: { light?: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const tmp = useRef(new THREE.Color());
  useFrame(() => {
    const p = dayProgress(useGame.getState().snap?.time);
    const l = sun.current;
    if (!l) return;
    const angle = Math.PI * (0.14 + 0.72 * p);
    l.position.set(Math.cos(angle) * -18, 7 + Math.sin(angle) * 12, -13);
    l.color.copy(sunColor(p, tmp.current));
    l.intensity = 2.9 + Math.sin(angle) * 1.3;
  });
  return (
    <>
      {/* A tiny studio drawn in code stands in for a photographed sky: soft light from the windows, cool fill from the front. */}
      {!light && (
        <Environment resolution={64} frames={1} environmentIntensity={0.2}>
          <color attach="background" args={['#5A534A']} />
          <Lightformer form="rect" intensity={3.2} color="#FFEFD6" position={[0, 6, -12]} scale={[26, 9, 1]} />
          <Lightformer form="rect" intensity={1.6} color="#FFE7C2" position={[-14, 5, 0]} rotation-y={Math.PI / 2} scale={[18, 7, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#CFE0F2" position={[12, 6, 12]} rotation-y={-Math.PI * 0.75} scale={[20, 8, 1]} />
          <Lightformer form="circle" intensity={1.5} color="#FFF3DD" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={14} />
        </Environment>
      )}
      <hemisphereLight args={['#F6F4EE', '#9A8A72', light ? 0.95 : 0.5]} />
      <directionalLight
        ref={sun}
        castShadow={!light}
        position={[-10, 14, -13]}
        intensity={3.6}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={2.6}
        shadow-bias={-0.0005}
        shadow-normalBias={0.035}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      {/* Warm key from the front so faces read in the iso view */}
      <directionalLight position={[12, 10, 14]} intensity={0.5} color="#FFF0DC" />
    </>
  );
}
