"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { arcPoint } from "@/lib/arc";
import { CLUSTER_BY_ID } from "@/lib/clusters";
import { hash01 } from "@/lib/galaxy-layout";
import type { GalaxyLayout } from "@/lib/galaxy-layout";
import { isVerified } from "@/lib/graph";
import type { GameGraph } from "@/lib/graph";
import { smoothstep } from "@/lib/journey-state";
import type { Live } from "./scene-types";

interface Props {
  graph: GameGraph;
  layout: GalaxyLayout;
  live: { current: Live };
  reducedMotion: boolean;
}

const WHITE = new THREE.Color("#FFF4FB");
const ARC_SEGMENTS = 10;
const tmp3: [number, number, number] = [0, 0, 0];

/**
 * Cables strung between tower beacons. Two batched line sets: verified relationships are solid,
 * inferred similarity is dashed. Per-vertex alpha is eased toward the targets from lib/scene-targets.
 */
export function BaseLines({ graph, layout, live }: Omit<Props, "reducedMotion">) {
  const built = useMemo(() => {
    const sets = [[] as number[], [] as number[]];
    graph.edges.forEach((e, i) => sets[isVerified(e.kind) ? 0 : 1]!.push(i));
    const make = (list: number[], dashed: boolean) => {
      const verts = ARC_SEGMENTS * 2;
      const pos = new Float32Array(list.length * verts * 3);
      const col = new Float32Array(list.length * verts * 4);
      const ca = new THREE.Color();
      const cb = new THREE.Color();
      const c = new THREE.Color();
      list.forEach((ei, k) => {
        const e = graph.edges[ei]!;
        ca.set(CLUSTER_BY_ID[graph.games[e.a]!.genres[0]!].color);
        cb.set(CLUSTER_BY_ID[graph.games[e.b]!.genres[0]!].color);
        for (let s = 0; s < ARC_SEGMENTS; s++) {
          for (let end = 0; end < 2; end++) {
            const t = (s + end) / ARC_SEGMENTS;
            const v = k * verts + s * 2 + end;
            arcPoint(layout.positions, e.a, e.b, t, pos, v * 3);
            c.copy(ca).lerp(cb, t);
            if (!dashed) c.lerp(WHITE, 0.3);
            col.set([c.r, c.g, c.b, 0.4], v * 4);
          }
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
      const mat = dashed
        ? new THREE.LineDashedMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, dashSize: 0.7, gapSize: 0.5 })
        : new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const line = new THREE.LineSegments(geo, mat);
      if (dashed) line.computeLineDistances();
      line.frustumCulled = false;
      line.renderOrder = 1;
      return { line, geo, mat, cur: new Float32Array(list.length).fill(0.3), list, verts };
    };
    return { verified: make(sets[0]!, false), inferred: make(sets[1]!, true) };
  }, [graph, layout]);

  useEffect(
    () => () => {
      for (const s of [built.verified, built.inferred]) {
        s.geo.dispose();
        s.mat.dispose();
      }
    },
    [built],
  );

  useFrame((_, dt) => {
    const t = live.current.targets;
    if (!t) return;
    const k = 1 - Math.exp(-dt * 7);
    for (const s of [built.verified, built.inferred]) {
      let moving = false;
      const colors = s.geo.attributes.color as THREE.BufferAttribute;
      const arr = colors.array as Float32Array;
      for (let j = 0; j < s.list.length; j++) {
        const target = Math.min(1, t.edgeAlpha[s.list[j]!]!);
        const d = target - s.cur[j]!;
        if (Math.abs(d) > 0.003) {
          s.cur[j] = s.cur[j]! + d * k;
          for (let v = 0; v < s.verts; v++) arr[(j * s.verts + v) * 4 + 3] = s.cur[j]!;
          moving = true;
        }
      }
      if (moving) colors.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={built.verified.line} />
      <primitive object={built.inferred.line} />
    </>
  );
}

const PARTICLE_VERT = /* glsl */ `
  attribute vec3 aColor;
  uniform float uDpr;
  uniform float uBase;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uBase / max(-mv.z, 1.0), 2.0, 9.0) * uDpr;
    vColor = aColor;
  }
`;
const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d));
    gl_FragColor = vec4(vColor * (0.8 + a), a * a);
  }
`;

export function makeParticles(count: number, base: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uDpr: { value: 1 }, uBase: { value: base } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return { pos, col, geo, mat, points };
}

/** Ambient traffic: light packets racing along the cables, dimmed with the cable they ride. */
export function Traffic({ graph, layout, live, reducedMotion }: Props) {
  const COUNT = 150;
  const built = useMemo(() => {
    const p = makeParticles(COUNT, 150);
    const edge = new Int32Array(COUNT);
    const speed = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const color = new Float32Array(COUNT * 3);
    const c = new THREE.Color();
    for (let k = 0; k < COUNT; k++) {
      const ei = Math.floor(hash01(`tr${k}e`) * graph.edges.length);
      edge[k] = ei;
      speed[k] = (0.07 + hash01(`tr${k}s`) * 0.14) * (hash01(`tr${k}d`) > 0.5 ? 1 : -1);
      phase[k] = hash01(`tr${k}p`);
      c.set(CLUSTER_BY_ID[graph.games[graph.edges[ei]!.a]!.genres[0]!].color);
      color.set([c.r, c.g, c.b], k * 3);
    }
    p.geo.setDrawRange(0, COUNT);
    return { ...p, edge, speed, phase, color };
  }, [graph]);

  useEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );

  useFrame((state) => {
    const t = live.current.targets;
    const time = reducedMotion ? 0 : state.clock.elapsedTime;
    built.mat.uniforms.uDpr!.value = state.gl.getPixelRatio();
    for (let k = 0; k < COUNT; k++) {
      const e = graph.edges[built.edge[k]!]!;
      let u = (built.phase[k]! + time * built.speed[k]!) % 1;
      if (u < 0) u += 1;
      arcPoint(layout.positions, e.a, e.b, u, tmp3);
      built.pos[k * 3] = tmp3[0];
      built.pos[k * 3 + 1] = tmp3[1];
      built.pos[k * 3 + 2] = tmp3[2];
      const vis = t ? Math.min(1, t.edgeAlpha[built.edge[k]!]! * 2.4) : 0.5;
      built.col[k * 3] = built.color[k * 3]! * vis;
      built.col[k * 3 + 1] = built.color[k * 3 + 1]! * vis;
      built.col[k * 3 + 2] = built.color[k * 3 + 2]! * vis;
    }
    (built.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (built.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
  });

  return <primitive object={built.points} />;
}

const MAX_HIGHLIGHTS = 96;
const HL_SEGMENTS = 14;
const PARTICLES = 96;

const KIND_COLORS = {
  verified: new THREE.Color("#00F0FF"),
  inferred: new THREE.Color("#FF2D95"),
  path: new THREE.Color("#FFE600"),
  taste: new THREE.Color("#9D4DFF"),
};

/** Bright arcs for the active selection / journey path / taste links, with light pulses travelling along them. */
export function HighlightLines({ layout, live, reducedMotion }: Omit<Props, "graph">) {
  const built = useMemo(() => {
    const pos = new Float32Array(MAX_HIGHLIGHTS * HL_SEGMENTS * 6);
    const col = new Float32Array(MAX_HIGHLIGHTS * HL_SEGMENTS * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.LineSegments(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 3;
    const p = makeParticles(PARTICLES, 190);
    return { line, geo, mat, pos, col, p, ends: [] as [number, number][], colors: [] as THREE.Color[], applied: -1 };
  }, []);

  useEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
      built.p.geo.dispose();
      built.p.mat.dispose();
    },
    [built],
  );

  useFrame((state) => {
    const L = live.current;
    const t = L.targets;
    if (!t) return;
    const P = layout.positions;
    if (built.applied !== L.targetsVersion) {
      built.applied = L.targetsVersion;
      const hs = t.highlights.slice(0, MAX_HIGHLIGHTS);
      built.ends = hs.map((h) => [h.a, h.b]);
      built.colors = hs.map((h, i) =>
        h.kind === "path"
          ? new THREE.Color("#00F0FF").lerp(new THREE.Color("#FF2D95"), hs.length > 1 ? i / (hs.length - 1) : 0)
          : KIND_COLORS[h.kind],
      );
      hs.forEach((h, i) => {
        const c = built.colors[i]!;
        for (let s = 0; s < HL_SEGMENTS; s++) {
          for (let end = 0; end < 2; end++) {
            const v = (i * HL_SEGMENTS + s) * 2 + end;
            arcPoint(P, h.a, h.b, (s + end) / HL_SEGMENTS, built.pos, v * 3);
            built.col.set([c.r, c.g, c.b], v * 3);
          }
        }
      });
      (built.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (built.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      built.geo.setDrawRange(0, hs.length * HL_SEGMENTS * 2);
    }

    const count = built.ends.length;
    if (count === 0) {
      built.p.geo.setDrawRange(0, 0);
      return;
    }
    let revealed = count;
    if (t.progressive) {
      const sub = Math.floor(smoothstep(L.reveal) * count * HL_SEGMENTS);
      built.geo.setDrawRange(0, sub * 2);
      revealed = Math.max(1, Math.ceil(sub / HL_SEGMENTS));
    }
    const time = state.clock.elapsedTime;
    const speed = reducedMotion ? 0 : 0.3;
    const n = Math.min(PARTICLES, Math.max(count * 4, 12));
    for (let k = 0; k < n; k++) {
      const seg = k % revealed;
      const [a, b] = built.ends[seg]!;
      const u = reducedMotion ? k / n : (time * speed + k * 0.37) % 1;
      arcPoint(P, a, b, u, tmp3);
      built.p.pos[k * 3] = tmp3[0];
      built.p.pos[k * 3 + 1] = tmp3[1];
      built.p.pos[k * 3 + 2] = tmp3[2];
      const c = built.colors[seg]!;
      built.p.col[k * 3] = c.r;
      built.p.col[k * 3 + 1] = c.g;
      built.p.col[k * 3 + 2] = c.b;
    }
    built.p.geo.setDrawRange(0, n);
    built.p.mat.uniforms.uDpr!.value = state.gl.getPixelRatio();
    (built.p.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (built.p.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <>
      <primitive object={built.line} />
      <primitive object={built.p.points} />
    </>
  );
}
