import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGame } from '../store/game';
import { FOCUS } from './layout';

const BASE_AZ = Math.PI / 4;
/** On an upright phone the camera swings round to look down the length of the office, which fills a tall screen far better. */
const TALL_AZ = 1.4;
const POLAR = 0.96;
const RADIUS = 40;
export const ZOOM_STEPS = [1, 1.4, 2];
const right = new THREE.Vector3();

/** Orthographic isometric camera. Orbit limited to 45 degrees each side, three zoom levels, eased focus. */
export function CameraRig({ cinematic, reduced, zoomStep }: { cinematic: boolean; reduced: boolean; zoomStep: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const cam = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();
  const pan = useRef(new THREE.Vector3());
  const goal = useRef(new THREE.Vector3());
  const tall = size.width < size.height * 0.8;
  const az = tall ? TALL_AZ : BASE_AZ;
  const baseZoom = tall ? Math.min(size.width / 20.5, size.height / 25) : Math.min(size.width / 25, size.height / 17.5);
  // Rings and light pools live on layer 1 (see FX in Office.tsx); this camera draws them, the contact shadow pass doesn't.
  useEffect(() => { cam.current?.layers.enable(1); }, []);

  // Start from the right side for this screen shape, and again if the screen is turned.
  useEffect(() => {
    const c = cam.current;
    const ctl = controls.current;
    if (!c || !ctl) return;
    c.position.setFromSphericalCoords(RADIUS, POLAR, az).add(ctl.target);
    c.lookAt(ctl.target);
    ctl.update();
  }, [az]);

  // On a phone the top of the screen is all HUD, so the picture is drawn a little lower to sit in the open space.
  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    if (tall && !cinematic) c.setViewOffset(size.width, size.height, 0, -Math.round(size.height * 0.085), size.width, size.height);
    else c.clearViewOffset();
  }, [tall, cinematic, size.width, size.height]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (cinematic || t.closest('input, textarea, select, [role="dialog"], .panel')) return;
      const step = 1;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, step], ArrowRight: [step, -step], ArrowUp: [-step, -step], ArrowDown: [step, step] };
      const m = moves[e.key];
      if (m && e.altKey === false && (t === document.body || t.closest('.scene'))) {
        e.preventDefault();
        pan.current.x = THREE.MathUtils.clamp(pan.current.x + m[0], -8, 8);
        pan.current.z = THREE.MathUtils.clamp(pan.current.z + m[1], -6, 6);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cinematic]);

  useFrame(({ clock }, dt) => {
    const c = cam.current;
    const ctl = controls.current;
    if (!c || !ctl) return;
    const st = useGame.getState();
    const focus = st.focus;
    goal.current.set(...(FOCUS[focus ?? 'overview'] ?? FOCUS.overview)).add(pan.current);
    // Keep the subject in the visible part of the screen: slide right of a right drawer, left of the inbox, right of the title copy.
    const slide = cinematic ? (size.width > 980 ? -5.5 : 0) : st.openStepId ? (size.width > 980 ? 4.2 : 0) : st.inboxOpen && size.width > 980 ? -2.6 : 0;
    // World direction that reads as screen-right from wherever the camera is now.
    right.setFromMatrixColumn(c.matrixWorld, 0).setY(0).normalize();
    goal.current.addScaledVector(right, slide);
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    ctl.target.lerp(goal.current, k);
    const zoomGoal = baseZoom * (cinematic ? 0.86 : ZOOM_STEPS[zoomStep] * (focus ? 1.25 : 1));
    c.zoom = reduced ? zoomGoal : THREE.MathUtils.lerp(c.zoom, zoomGoal, k);
    c.updateProjectionMatrix();
    if (cinematic) {
      const swing = az + (reduced ? 0 : Math.sin(clock.elapsedTime * 0.12) * (tall ? 0.16 : 0.42));
      c.position.setFromSphericalCoords(RADIUS, POLAR, swing).add(ctl.target);
      c.lookAt(ctl.target);
    }
    ctl.update();
  });

  return (
    <>
      <OrthographicCamera ref={cam} makeDefault position={new THREE.Vector3().setFromSphericalCoords(RADIUS, POLAR, az)} zoom={baseZoom} near={0.1} far={200} />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!cinematic}
        enablePan={false}
        enableZoom={false}
        enableDamping={!reduced}
        minAzimuthAngle={az - Math.PI / 4}
        maxAzimuthAngle={Math.min(az + Math.PI / 4, Math.PI / 2)}
        minPolarAngle={0.7}
        maxPolarAngle={1.1}
      />
    </>
  );
}
