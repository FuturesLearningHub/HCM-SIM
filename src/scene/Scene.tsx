import { ContactShadows, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGame, paydayBeats } from '../store/game';
import { useVoice } from '../audio/voice';
import { onsite, personStatus } from '../status';
import { activateHotspot, activatePerson } from './actions';
import { placeLabel } from '../places';
import { Icon, StatusGlyph } from '../ui/icons';
import { CameraRig } from './CameraRig';
import { Figures, tagHeight } from './Figures';
import { PLINTH, seatFor } from './layout';
import { Lighting } from './Lighting';
import { Office, VOLUMES } from './Office';
import { TagPins, tagRef, type Tag } from './Tags';
import { fullOn, lightOn, PerfProbe, perfOn, softwareRenderer } from './Perf';

/** The model sits 2 cm below the origin (see the contact shadows below). */
const MODEL_Y = -0.02;

/**
 * With reduced motion nothing in the office moves by itself, so it is drawn only when something changes:
 * the clock, a panel, the camera, who is standing. A still picture costs nothing to keep on screen.
 */
function DrawOnChange({ signal }: { signal: string }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate(4);
    void document.fonts?.ready.then(() => invalidate(2));
    return useGame.subscribe((now, was) => {
      if (now.snap !== was.snap) invalidate(1);
      if (now.focus !== was.focus || now.openStepId !== was.openStepId || now.inboxOpen !== was.inboxOpen || now.phase !== was.phase || now.beat !== was.beat) invalidate(3);
    });
  }, [invalidate]);
  useEffect(() => { invalidate(3); }, [invalidate, signal]);
  return null;
}

/** On a machine that can't keep up, the lighter picture is drawn 20 times a second, not as fast as possible. */
function SteadyPace() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = window.setInterval(() => invalidate(), 50);
    return () => window.clearInterval(id);
  }, [invalidate]);
  return null;
}

export default function Scene({ zoomStep }: { zoomStep: number }) {
  const phase = useGame((s) => s.phase);
  const beat = useGame((s) => s.beat);
  const snap = useGame((s) => s.snap);
  const game = useGame((s) => s.game);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const cinematic = phase === 'title';
  // Sharp on good hardware, lighter on slow hardware: the pixel ratio follows the measured frame rate.
  const maxDpr = useMemo(() => Math.min(window.devicePixelRatio || 1, 2), []);
  const [dpr, setDpr] = useState(() => Math.min(maxDpr, 1.5));
  // Still too slow at the lowest pixel ratio, or no graphics hardware at all: drop the sun's shadows and the reflections,
  // draw at three quarters of the resolution, and hold a steady 20 frames a second.
  const [light, setLight] = useState(lightOn);

  const pendingAt = useMemo(() => {
    const set = new Set<string>();
    if (game && snap && phase === 'playing') snap.steps.forEach((st) => game.status(st) === 'open' && set.add(st.location));
    return set;
  }, [game, snap, phase]);

  const voice = useVoice();
  const talking = voice.status === 'playing' ? voice.speaker : null;
  const speaker = talking ?? (phase === 'payday' && snap ? paydayBeats(snap)[beat]?.speaker ?? null : null);
  const cast = useMemo(() => onsite(snap?.time).map((person) => ({ person, status: personStatus(person.id, game, snap) })), [game, snap]);
  // Contact shadows are drawn once, then again only when someone sits down, stands up, or arrives.
  const posture = cast.map((c) => `${c.person.id}:${c.status.kind === 'talk' || speaker === c.person.id ? 1 : 0}`).join(' ');

  // What the pointer is over. A person inside a place wins, so the two are tracked apart.
  const [overPerson, setOverPerson] = useState<string | null>(null);
  const [overPlace, setOverPlace] = useState<string | null>(null);
  // Status symbols over people, and a name tag over the place under the pointer.
  const tags = useMemo(() => {
    const list: (Tag & { kind: 'talk' | 'issue' | 'done' | 'place'; label: string; open: boolean })[] = [];
    for (const c of cast) {
      if (c.status.kind === 'none') continue;
      const standing = c.status.kind === 'talk' || speaker === c.person.id;
      const seat = seatFor(c.person.desk);
      const [x, , z] = standing ? seat.stand : seat.pos;
      list.push({ id: c.person.id, pos: [x, tagHeight(standing) + MODEL_Y, z], kind: c.status.kind, label: c.status.label, open: overPerson === c.person.id });
    }
    if (overPlace && !overPerson && VOLUMES[overPlace]) {
      const v = VOLUMES[overPlace];
      list.push({ id: `place:${overPlace}`, pos: [v.pos[0], v.pos[1] + v.size[1] / 2 + 0.35 + MODEL_Y, v.pos[2]], kind: 'place', label: placeLabel(overPlace), open: pendingAt.has(overPlace) });
    }
    return list;
  }, [cast, speaker, overPerson, overPlace, pendingAt]);

  return (
    <div className="scene" role="img" aria-label="3D office diorama of the Office of Learning Operations. Every place and person here is also reachable from the Places bar and the List view.">
      <Canvas shadows="percentage" dpr={light ? 0.75 : dpr} frameloop={reduced || light ? 'demand' : 'always'} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onPointerMissed={() => useGame.getState().setPanel({ focus: null })}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 0.95; if (!fullOn() && softwareRenderer(gl)) setLight(true); }}>
        {reduced ? <DrawOnChange signal={`${zoomStep} ${speaker} ${posture} ${pendingAt.size}`} /> : light ? <SteadyPace /> : (
          <PerformanceMonitor flipflops={3} onChange={({ factor }) => setDpr(Math.round((1 + (maxDpr - 1) * factor) * 4) / 4)} onDecline={({ factor }) => { if (factor <= 0.05) setLight(true); }} onFallback={() => setLight(true)} />
        )}
        <Suspense fallback={null}>
          <CameraRig cinematic={cinematic} reduced={reduced} zoomStep={zoomStep} />
          <Lighting light={light} />
          {/* The model sits 2 cm below the origin. drei blurs contact shadows on a sheet at height zero, and that sheet has to be
              in front of the shadow camera, which looks up from just above the floor. */}
          <group position-y={MODEL_Y}>
            <Office onActivate={activateHotspot} onHover={setOverPlace} pendingAt={pendingAt} reduced={reduced} light={light} />
            <Figures cast={cast} reduced={reduced} onActivate={activatePerson} onHover={setOverPerson} speaker={speaker} />
            <ContactShadows key={posture} position={[0, 0.0095, 0]} scale={[PLINTH.w, PLINTH.d]} resolution={light ? 512 : 1024} far={1.4} blur={1.3} opacity={0.6} frames={3} color="#1E1408" renderOrder={1} />
          </group>
          <TagPins tags={tags} />
          {perfOn() && <PerfProbe />}
        </Suspense>
      </Canvas>
      {/* Symbols and name tags are page elements over the canvas; TagPins keeps each one on its spot. */}
      <div className="tags" aria-hidden="true">
        {tags.map((t) => (t.kind === 'place' ? (
          <div key={t.id} ref={tagRef(t.id)} className={`chip chip--place ${t.open ? 'chip--talk' : ''}`}>{t.open && <Icon.pin />}<span>{t.label}{t.open ? ': something is waiting' : ''}</span></div>
        ) : (
          <div key={t.id} ref={tagRef(t.id)} className={`chip chip--${t.kind}`}><StatusGlyph kind={t.kind} /><span>{t.open ? t.label : ''}</span></div>
        )))}
      </div>
    </div>
  );
}
