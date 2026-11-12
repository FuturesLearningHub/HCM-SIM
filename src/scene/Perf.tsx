import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

export interface PerfStats { calls: number; triangles: number; fps: number; frames: number }
declare global { interface Window { __perf?: PerfStats } }

/** True when the address has ?perf: the scene then reports its draw calls, triangles, and frame rate. */
export const perfOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');
/** True when the address has ?light: start with the lighter picture that slow machines otherwise switch to on their own. */
export const lightOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('light');
/** True when the address has ?full: keep the full picture even on a software renderer (used to measure the budget). */
export const fullOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('full');

/** A browser drawing 3D on the processor, with no graphics hardware behind it: remote desktops, some locked-down laptops, test runners. */
export function softwareRenderer(gl: { getContext(): WebGLRenderingContext | WebGL2RenderingContext }): boolean {
  const ctx = gl.getContext();
  const ext = ctx.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/**
 * Performance probe (SPEC 18.3). Writes the last frame's draw calls and triangles, and a smoothed frame rate,
 * to window.__perf. Counts include the shadow passes, so the 150 draw call budget is checked against the real total.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const last = useRef(performance.now());
  const fps = useRef(60);
  const frames = useRef(0);
  // Count everything drawn in a frame, not only the last pass: the contact shadow passes are part of the cost too.
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);
  // Runs first in each frame (negative priority), so the totals it reads are exactly the frame before.
  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    if (dt > 0) fps.current += (1000 / dt - fps.current) * 0.1;
    frames.current += 1;
    window.__perf = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, fps: Math.round(fps.current), frames: frames.current };
    gl.info.reset();
  }, -100);
  return null;
}
