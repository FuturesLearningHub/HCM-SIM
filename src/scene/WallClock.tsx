import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { useGame } from '../store/game';
import { minuteOfDay } from '../engine/clock';
import { C } from './palette';

/**
 * Wall clock by the bulletin board, driven by sim time. The rim and ticks are part of the merged office set;
 * only the face and hands are drawn here. The face turns red in the last four hours.
 */
export function WallClock({ position }: { position: [number, number, number] }) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  const face = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const s = useGame.getState().snap;
    const m = s ? minuteOfDay(s.time) : 600;
    if (hour.current) hour.current.rotation.z = -((m / 60) % 12) / 12 * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -(m % 60) / 60 * Math.PI * 2;
    if (face.current && s) face.current.color.set(s.deadline - s.time <= 240 ? '#F3CFC2' : C.cream);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0, 0.012]}><circleGeometry args={[0.345, 36]} /><meshBasicMaterial ref={face} color={C.cream} /></mesh>
      <group ref={hour} position={[0, 0, 0.03]}><mesh position={[0, 0.09, 0]}><boxGeometry args={[0.032, 0.19, 0.01]} /><meshBasicMaterial color={C.black} /></mesh></group>
      <group ref={minute} position={[0, 0, 0.036]}><mesh position={[0, 0.125, 0]}><boxGeometry args={[0.02, 0.26, 0.01]} /><meshBasicMaterial color={C.oak} /></mesh></group>
    </group>
  );
}
