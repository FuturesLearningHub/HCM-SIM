import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * Name tags and status symbols over the 3D office. The tags are ordinary page elements drawn over the canvas;
 * this module only keeps each one pinned to its spot in the scene as the camera moves.
 */
export interface Tag {
  id: string;
  /** Where the tag sits in the scene, in meters. */
  pos: [number, number, number];
}

const els = new Map<string, HTMLElement>();

/** Ref callback for a tag's element, so the scene can move it. */
export const tagRef = (id: string) => (el: HTMLElement | null) => {
  if (el) els.set(id, el); else els.delete(id);
};

const v = new THREE.Vector3();

/** Lives inside the canvas: each frame it works out where every tag falls on screen and moves the element there. */
export function TagPins({ tags }: { tags: Tag[] }) {
  const invalidate = useThree((s) => s.invalidate);
  // A new tag needs a frame to be placed, even when the picture is otherwise still.
  useEffect(() => { invalidate(2); }, [tags, invalidate]);
  useFrame(({ camera, size }) => {
    if (!tags.length) return;
    camera.updateMatrixWorld();
    for (const t of tags) {
      const el = els.get(t.id);
      if (!el) continue;
      v.set(t.pos[0], t.pos[1], t.pos[2]).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.visibility = 'visible';
    }
  });
  return null;
}
