"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CLUSTERS } from "@/lib/clusters";
import { GAME_INDEX } from "@/lib/games";
import { journey, JOURNEY_STAGES } from "@/lib/journey-state";
import { computeTargets } from "@/lib/scene-targets";
import { actions, store, useStore } from "@/lib/store";
import type { Mode } from "@/lib/store";
import type { Universe } from "@/lib/universe";
import { Backdrop } from "./Backdrop";
import { CityGround, Rain, Towers } from "./City";
import { BaseLines, HighlightLines, Traffic } from "./ConnectionLines";
import { NodeField } from "./GameNode";
import { Streets } from "./Streets";
import { expansionAt, homePose, keyframes, samplePose, tintAt } from "./camera-poses";
import type { Pose } from "./camera-poses";
import { bus } from "./scene-bus";
import type { Live } from "./scene-types";
import { visuals } from "./scene-visuals";

type Controls = {
  target: THREE.Vector3;
  update: () => boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  addEventListener: (type: "start" | "end", fn: () => void) => void;
  removeEventListener: (type: "start" | "end", fn: () => void) => void;
};

interface Tween {
  t: number;
  dur: number;
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  to: () => Pose;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface SceneProps {
  universe: Universe;
  quality: "high" | "low";
  reducedMotion: boolean;
}

/** Owns camera, targets, expansion and tint. One useFrame, zero React updates while it runs. */
function Director({ universe, live, reducedMotion }: { universe: Universe; live: { current: Live }; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const size = useThree((s) => s.size);
  const frames = useMemo(() => keyframes(universe), [universe]);
  const scratch = useRef<Pose>({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const driftOut = useRef(new THREE.Vector3());
  const tween = useRef<Tween | null>(null);
  const last = useRef({ cmd: 0, version: -1, stage: -2, mode: store.get().mode as Mode, interact: -100 });
  const tmpColor = useRef(new THREE.Color());
  const prevScene = useRef(0);
  const fovKick = useRef(0);
  const aspectRef = useRef(size.width / size.height);
  aspectRef.current = size.width / size.height;

  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      tween.current = null;
      last.current.interact = performance.now() / 1000;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  // Place the camera at the opening keyframe before the first paint of the journey.
  useEffect(() => {
    samplePose(frames, journey.scene, scratch.current, aspectRef.current);
    camera.position.copy(scratch.current.pos);
    camera.lookAt(scratch.current.target);
    controls?.target.copy(scratch.current.target);
  }, [camera, controls, frames]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = store.get();
    const L = live.current;
    const now = state.clock.elapsedTime;

    // 1. journey scene damping
    const dampRate = journey.style === 0 ? 5 : journey.style === 1 ? 3.2 : 0;
    const wanted = journey.style === 0 ? journey.target : Math.round(journey.target);
    journey.scene = dampRate === 0 ? wanted : journey.scene + (wanted - journey.scene) * (1 - Math.exp(-dt * dampRate));
    if (Math.abs(journey.scene - wanted) < 0.0005) journey.scene = wanted;

    const stage = s.mode === "journey" ? Math.min(5, Math.max(0, Math.round(journey.scene))) : -1;
    if (last.current.version !== s.version || last.current.stage !== stage) {
      last.current.version = s.version;
      if (last.current.stage !== stage && stage >= 0) {
        document.documentElement.dataset.stage = JOURNEY_STAGES[stage]?.key ?? "";
      }
      last.current.stage = stage;
      L.targets = computeTargets(s, universe.graph, stage);
      L.targetsVersion++;
    }

    // 2. mode change -> glide back into the journey path
    if (last.current.mode !== s.mode) {
      last.current.mode = s.mode;
      if (s.mode === "journey") {
        tween.current = {
          t: 0,
          dur: reducedMotion ? 0.001 : 1.6,
          fromPos: camera.position.clone(),
          fromTarget: controls ? controls.target.clone() : new THREE.Vector3(),
          to: () => samplePose(frames, journey.scene, scratch.current, aspectRef.current),
        };
      }
    }

    // 3. camera commands
    const cmd = s.camera;
    if (cmd && cmd.n !== last.current.cmd) {
      last.current.cmd = cmd.n;
      const fromPos = camera.position.clone();
      const fromTarget = controls ? controls.target.clone() : new THREE.Vector3();
      const dur = reducedMotion ? 0.001 : 1.5;
      const P = universe.layout.positions;
      if (cmd.kind === "enter") {
        const home = homePose(size.width / size.height);
        tween.current = { t: 0, dur: cmd.instant ? 0.001 : 2.6, fromPos, fromTarget, to: () => home };
      } else if (cmd.kind === "reset") {
        const home = homePose(size.width / size.height);
        tween.current = { t: 0, dur: reducedMotion ? 0.001 : 1.2, fromPos, fromTarget, to: () => home };
      } else if (cmd.kind === "fly") {
        const i = GAME_INDEX.get(cmd.id);
        if (i !== undefined) {
          const target = new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
          const dir = fromPos.clone().sub(fromTarget);
          const dist = Math.min(Math.max(dir.length(), 10), 16);
          // keep the viewer's bearing but make sure we look slightly down on the node
          dir.normalize();
          dir.y = Math.max(dir.y, 0.25);
          dir.normalize();
          const to = { pos: target.clone().addScaledVector(dir, dist * 0.62), target };
          tween.current = { t: 0, dur, fromPos, fromTarget, to: () => to };
        }
      } else if (cmd.kind === "cluster") {
        const c = universe.layout.clusters[cmd.id];
        const target = new THREE.Vector3(...c.position);
        const out = target.clone().setY(0).normalize();
        const to = { pos: target.clone().addScaledVector(out, c.radius * 2.6 + 9).add(new THREE.Vector3(0, c.radius * 1.4 + 4, 0)), target };
        tween.current = { t: 0, dur, fromPos, fromTarget, to: () => to };
      } else if (cmd.kind === "zoom") {
        const offset = fromPos.clone().sub(fromTarget);
        const nextLen = Math.min(150, Math.max(6, offset.length() * cmd.factor));
        const to = { pos: fromTarget.clone().addScaledVector(offset.normalize(), nextLen), target: fromTarget.clone() };
        tween.current = { t: 0, dur: reducedMotion ? 0.001 : 0.45, fromPos, fromTarget, to: () => to };
      }
    }

    // 4. apply tween or journey keyframes
    const tw = tween.current;
    if (tw) {
      tw.t += dt;
      const e = easeInOut(Math.min(1, tw.t / tw.dur));
      const to = tw.to();
      camera.position.lerpVectors(tw.fromPos, to.pos, e);
      const target = controls ? controls.target : scratch.current.target;
      target.lerpVectors(tw.fromTarget, to.target, e);
      camera.lookAt(target);
      if (tw.t >= tw.dur) tween.current = null;
    } else if (s.mode === "journey") {
      samplePose(frames, journey.scene, scratch.current, aspectRef.current);
      const drift = reducedMotion ? 0 : 1;
      driftOut.current.set(Math.sin(now * 0.11) * 0.9 * drift, Math.sin(now * 0.07 + 1) * 0.5 * drift, Math.cos(now * 0.09) * 0.7 * drift);
      camera.position.copy(scratch.current.pos).add(driftOut.current);
      camera.lookAt(scratch.current.target);
      controls?.target.copy(scratch.current.target);
    } else if (controls) {
      controls.autoRotate =
        !reducedMotion && s.selectedId === null && s.hoveredId === null && now - last.current.interact > 6;
      controls.autoRotateSpeed = 0.25;
    }

    // 4b. speed-lines feel: the lens widens while the journey is moving fast, then settles
    const speedNow = s.mode === "journey" && !reducedMotion ? Math.abs(journey.scene - prevScene.current) / Math.max(dt, 0.001) : 0;
    prevScene.current = journey.scene;
    fovKick.current += (Math.min(16, speedNow * 26) - fovKick.current) * (1 - Math.exp(-dt * 4));
    const wantFov = 50 + fovKick.current;
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov = wantFov;
      camera.updateProjectionMatrix();
    }

    // 5. visuals: power-up, tint, path reveal
    const wantExpand = s.mode === "explore" ? 1 : expansionAt(journey.scene);
    visuals.expand += (wantExpand - visuals.expand) * (1 - Math.exp(-dt * (s.mode === "explore" ? 2.4 : 8)));
    if (s.mode === "journey") tintAt(journey.scene, tmpColor.current);
    else tmpColor.current.setRGB(1, 1, 1);
    visuals.tint.lerp(tmpColor.current, 1 - Math.exp(-dt * 3));
    L.reveal = s.mode === "journey" ? Math.min(1, Math.max(0, (journey.scene - 3.55) / 0.75)) : 1;
  });

  return null;
}

/** Projects cluster labels, the hover card and the selection tag to the screen every frame. */
function Labels({ universe, live }: { universe: Universe; live: { current: Live } }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const s = store.get();
    const { width, height } = state.size;
    const cam = state.camera;
    const P = universe.layout.positions;
    const place = (el: HTMLElement | null, x: number, y: number, z: number, opacity: number) => {
      if (!el) return;
      v.set(x, y, z).project(cam);
      const visible = v.z < 1 && opacity > 0.01 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      el.style.opacity = visible ? String(opacity) : "0";
      if (visible) el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * height).toFixed(1)}px, 0)`;
    };
    const stage = Math.round(journey.scene);
    const labelsOn = bus.showClusterLabels && (s.mode === "explore" || stage >= 2);
    for (const c of CLUSTERS) {
      const a = universe.layout.clusters[c.id];
      const dist = cam.position.distanceTo(v.set(a.position[0], a.height, a.position[2]));
      let o = labelsOn ? Math.min(1, Math.max(0, (dist - a.radius * 1.6) / (a.radius * 2.2))) : 0;
      if (s.mode === "journey" && stage === 3 && c.id !== "rpg") o *= 0.25;
      if (s.mode === "journey" && stage >= 4) o *= 0.35;
      if (s.mode === "explore" && s.selectedId) o *= 0.45;
      place(bus.clusterLabels.get(c.id) ?? null, a.position[0], a.height + 3, a.position[2], o);
    }
    const at = (id: string | null) => (id ? GAME_INDEX.get(id) : undefined);
    const sel = s.mode === "explore" ? at(s.selectedId) : undefined;
    const hov = s.mode === "explore" && s.hoveredId !== s.selectedId ? at(s.hoveredId) : undefined;
    if (sel !== undefined) place(bus.selected, P[sel * 3]!, P[sel * 3 + 1]!, P[sel * 3 + 2]!, 1);
    else place(bus.selected, 0, 0, 0, 0);
    if (hov !== undefined) place(bus.hover, P[hov * 3]!, P[hov * 3 + 1]!, P[hov * 3 + 2]!, 1);
    else place(bus.hover, 0, 0, 0, 0);
    void live;
  });
  return null;
}

/** Screen-space nearest-node picking: robust for tiny sprites and generous on touch. */
function Picker({ universe, live }: { universe: Universe; live: { current: Live } }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const el = gl.domElement;
    const v = new THREE.Vector3();
    const P = universe.layout.positions;
    const n = universe.graph.games.length;
    let down: { x: number; y: number; t: number } | null = null;

    const pick = (clientX: number, clientY: number, touch: boolean): number => {
      const { camera, size } = get();
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const reach = touch ? 36 : 22;
      let best = -1;
      let bestScore = Infinity;
      const alpha = live.current.targets?.nodes.alpha;
      for (let i = 0; i < n; i++) {
        if (alpha && alpha[i]! < 0.2) continue;
        v.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!).project(camera);
        if (v.z > 1) continue;
        const dx = (v.x * 0.5 + 0.5) * size.width - px;
        const dy = (-v.y * 0.5 + 0.5) * size.height - py;
        const d = Math.hypot(dx, dy);
        if (d < reach && d + v.z * 6 < bestScore) {
          best = i;
          bestScore = d + v.z * 6;
        }
      }
      return best;
    };

    const onMove = (e: PointerEvent) => {
      if (store.get().mode !== "explore" || e.buttons !== 0 || e.pointerType === "touch") return;
      const i = pick(e.clientX, e.clientY, false);
      actions.hover(i >= 0 ? (universe.graph.games[i]?.id ?? null) : null);
      el.style.cursor = i >= 0 ? "pointer" : "";
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || store.get().mode !== "explore") return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
      const i = pick(e.clientX, e.clientY, e.pointerType === "touch");
      if (i >= 0) actions.select(universe.graph.games[i]?.id ?? null);
      else if (store.get().selectedId) actions.select(null, false);
    };
    const onLeave = () => actions.hover(null);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, get, universe, live]);
  return null;
}

export default function GalaxyScene({ universe, quality, reducedMotion }: SceneProps) {
  const live = useRef<Live>({ targets: null, targetsVersion: 0, group: null, reveal: 0 });
  const mode = useStore((s) => s.mode);

  return (
    <>
      <Director universe={universe} live={live} reducedMotion={reducedMotion} />
      <Backdrop quality={quality} reducedMotion={reducedMotion} />
      <CityGround layout={universe.layout} />
      <Streets layout={universe.layout} quality={quality} reducedMotion={reducedMotion} />
      <Rain count={quality === "low" ? 350 : 900} reducedMotion={reducedMotion} />
      <group
        ref={(g) => {
          live.current.group = g;
        }}
      >
        <Towers graph={universe.graph} layout={universe.layout} live={live} />
        <BaseLines graph={universe.graph} layout={universe.layout} live={live} />
        <Traffic graph={universe.graph} layout={universe.layout} live={live} reducedMotion={reducedMotion} />
        <HighlightLines layout={universe.layout} live={live} reducedMotion={reducedMotion} />
        <NodeField graph={universe.graph} layout={universe.layout} live={live} />
      </group>
      <Labels universe={universe} live={live} />
      <Picker universe={universe} live={live} />
      <OrbitControls
        makeDefault
        enabled={mode === "explore"}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.8}
        panSpeed={0.7}
        minDistance={6}
        maxDistance={150}
        maxPolarAngle={Math.PI * 0.92}
      />
    </>
  );
}
