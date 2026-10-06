"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CLUSTER_BY_ID, CLUSTERS } from "@/lib/clusters";
import { hash01, towerHeight, towerWidth } from "@/lib/galaxy-layout";
import type { GalaxyLayout } from "@/lib/galaxy-layout";
import type { GameGraph } from "@/lib/graph";
import type { Live } from "./scene-types";
import { visuals } from "./scene-visuals";

interface Props {
  graph: GameGraph;
  layout: GalaxyLayout;
  live: { current: Live };
}

export const TOWER_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aState;
  attribute float aSeed;
  attribute float aNew;
  uniform float uMirror;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vState;
  varying float vSeed;
  varying float vNew;
  varying float vY;
  varying float vH;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vLocal;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vLocal = position * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    if (uMirror > 0.5) wp.y = -wp.y;
    vWorld = wp.xyz;
    vY = position.y;
    vH = instanceMatrix[1][1];
    vUv = uv;
    vN = normal;
    vColor = aColor;
    vAlpha = aAlpha;
    vState = aState;
    vSeed = aSeed;
    vNew = aNew;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const TOWER_FRAG = /* glsl */ `
  uniform float uMirror;
  uniform float uPower;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vState;
  varying float vSeed;
  varying float vNew;
  varying float vY;
  varying float vH;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vLocal;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float yy = vLocal.y;
    bool top = vN.y > 0.3;
    vec3 col = vec3(0.016, 0.012, 0.04);
    if (top) {
      col += vColor * (0.9 + 0.5 * vAlpha);
    } else {
      float u = abs(vN.x) > 0.5 ? vLocal.z : vLocal.x;
      vec2 cell = vec2(floor(u * 2.2), floor(yy * 1.7));
      vec2 f = vec2(fract(u * 2.2), fract(yy * 1.7));
      float win = step(0.2, f.x) * step(f.x, 0.82) * step(0.24, f.y) * step(f.y, 0.78);
      // Announced titles are still building sites: few lit windows, hazard banding, a blinking crane light.
      float lit = step(mix(0.93, 0.42, uPower * mix(1.0, 0.25, vNew)), hash(cell + vSeed * 91.0));
      vec3 wc = mix(vColor, vec3(1.0, 0.86, 0.55), step(0.72, hash(cell.yx + 7.0)) * 0.8);
      col += wc * win * lit * 1.25;
      float edge = max(smoothstep(0.07, 0.0, vUv.x), smoothstep(0.93, 1.0, vUv.x));
      col += vColor * edge * (0.5 + 1.3 * uPower);
      col += vColor * smoothstep(0.9, 1.0, vY) * 1.8;
      if (vNew > 0.5) {
        float band = step(0.5, fract((yy - uTime * 0.25) * 0.55));
        col += vec3(1.0, 0.9, 0.0) * band * smoothstep(0.82, 1.0, vY) * (0.6 + 0.4 * sin(uTime * 3.0 + vSeed * 6.28));
      }
    }
    if (vState > 1.5) col *= 1.25 + 0.45 * sin(uTime * 4.0 + vSeed * 6.28);
    col *= vAlpha;
    float d = distance(cameraPosition, vWorld);
    float fog = exp(-d * 0.0085);
    col = mix(vec3(0.03, 0.012, 0.06), col, fog);
    if (uMirror > 0.5) {
      float depth = 1.0 - smoothstep(0.0, 14.0, -vWorld.y);
      gl_FragColor = vec4(col * 0.32 * depth, 1.0);
    } else {
      gl_FragColor = vec4(col, 1.0);
    }
  }
`;

/**
 * Every game as a lit tower, batched into ONE instanced draw (plus one mirrored draw for the wet street).
 * Alpha/state are eased toward the same targets that drive the beacons and cables.
 */
export function Towers({ graph, layout, live }: Props) {
  const built = useMemo(() => {
    const n = graph.games.length;
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const color = new Float32Array(n * 3);
    const alpha = new Float32Array(n).fill(0.9);
    const state = new Float32Array(n);
    const seed = new Float32Array(n);
    const isNew = new Float32Array(n);
    const tmp = new THREE.Color();
    graph.games.forEach((g, i) => {
      tmp.set(CLUSTER_BY_ID[g.genres[0]!].color);
      color.set([tmp.r, tmp.g, tmp.b], i * 3);
      seed[i] = hash01(`${g.id}:tower`);
      isNew[i] = g.status === "upcoming" ? 1 : 0;
    });
    const attrs = {
      aColor: new THREE.InstancedBufferAttribute(color, 3),
      aAlpha: new THREE.InstancedBufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage),
      aState: new THREE.InstancedBufferAttribute(state, 1).setUsage(THREE.DynamicDrawUsage),
      aSeed: new THREE.InstancedBufferAttribute(seed, 1),
      aNew: new THREE.InstancedBufferAttribute(isNew, 1),
    };
    for (const [k, v] of Object.entries(attrs)) box.setAttribute(k, v);

    const mkMat = (mirror: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: TOWER_VERT,
        fragmentShader: TOWER_FRAG,
        side: mirror ? THREE.DoubleSide : THREE.FrontSide,
        transparent: mirror,
        depthWrite: !mirror,
        blending: mirror ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uMirror: { value: mirror ? 1 : 0 }, uPower: { value: 0.5 }, uTime: { value: 0 } },
      });
    const matMain = mkMat(false);
    const matMirror = mkMat(true);
    const mkMesh = (m: THREE.ShaderMaterial) => {
      const mesh = new THREE.InstancedMesh(box, m, n);
      const mat4 = new THREE.Matrix4();
      graph.games.forEach((_, i) => {
        const deg = graph.degree[i] ?? 0;
        const w = towerWidth(deg);
        mat4.compose(
          new THREE.Vector3(layout.positions[i * 3], 0, layout.positions[i * 3 + 2]),
          new THREE.Quaternion(),
          new THREE.Vector3(w, towerHeight(deg), w),
        );
        mesh.setMatrixAt(i, mat4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      return mesh;
    };
    const main = mkMesh(matMain);
    const mirror = mkMesh(matMirror);
    mirror.renderOrder = 0;
    main.renderOrder = -1;
    return { box, main, mirror, matMain, matMirror, alpha, state };
  }, [graph, layout]);

  useEffect(
    () => () => {
      built.box.dispose();
      built.matMain.dispose();
      built.matMirror.dispose();
      built.main.dispose();
      built.mirror.dispose();
    },
    [built],
  );

  useFrame((state, dt) => {
    for (const m of [built.matMain, built.matMirror]) {
      m.uniforms.uTime!.value = state.clock.elapsedTime;
      m.uniforms.uPower!.value = visuals.expand;
    }
    const t = live.current.targets;
    if (!t) return;
    const k = 1 - Math.exp(-dt * 8);
    let moving = false;
    for (let i = 0; i < built.alpha.length; i++) {
      const target = Math.max(0.12, t.nodes.alpha[i]!);
      const d = target - built.alpha[i]!;
      if (Math.abs(d) > 0.003) {
        built.alpha[i] = built.alpha[i]! + d * k;
        moving = true;
      }
      built.state[i] = t.nodes.state[i]!;
    }
    const a = built.box.attributes;
    (a.aState as THREE.BufferAttribute).needsUpdate = true;
    if (moving) (a.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <>
      <primitive object={built.main} />
      <primitive object={built.mirror} />
    </>
  );
}

const GROUND_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const GROUND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec3 vW;
  float grid(vec2 p, float s, float w) {
    vec2 q = p / s;
    vec2 g = abs(fract(q - 0.5) - 0.5) / (fwidth(q) * w);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    float d = distance(cameraPosition, vW);
    float fade = exp(-d * 0.011);
    float r = length(vW.xz);
    vec3 pink = vec3(1.0, 0.18, 0.58);
    vec3 cyan = vec3(0.0, 0.94, 1.0);
    vec3 col = pink * grid(vW.xz, 4.0, 1.1) * 0.26 + cyan * grid(vW.xz, 20.0, 1.6) * 0.34;
    float wave = mod(uTime * 22.0, 340.0);
    float pulse = smoothstep(4.0, 0.0, abs(r - wave)) * (1.0 - r / 340.0);
    col += cyan * pulse * 0.9 * (0.4 + uPower);
    col *= fade;
    gl_FragColor = vec4(col + vec3(0.012, 0.006, 0.03), 0.9);
  }
`;

/** Wet neon street: grid, district glow pools, district boundary rings and a radar pulse sweeping outward. */
export function CityGround({ layout }: { layout: GalaxyLayout }) {
  const built = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1400, 1400);
    plane.rotateX(-Math.PI / 2);
    const groundMat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0.5 } },
    });
    const ground = new THREE.Mesh(plane, groundMat);
    ground.renderOrder = -5;
    ground.position.y = 0;

    // pools + rings, merged into two buffers
    const SEG = 48;
    const poolPos: number[] = [];
    const poolCol: number[] = [];
    const ringPos: number[] = [];
    const ringCol: number[] = [];
    const c = new THREE.Color();
    for (const cl of CLUSTERS) {
      const a = layout.clusters[cl.id];
      const R = a.radius * 1.55;
      c.set(cl.color);
      for (let s = 0; s < SEG; s++) {
        const t0 = (s / SEG) * Math.PI * 2;
        const t1 = ((s + 1) / SEG) * Math.PI * 2;
        poolPos.push(a.position[0], 0.04, a.position[2]);
        poolPos.push(a.position[0] + Math.cos(t0) * R, 0.04, a.position[2] + Math.sin(t0) * R);
        poolPos.push(a.position[0] + Math.cos(t1) * R, 0.04, a.position[2] + Math.sin(t1) * R);
        poolCol.push(c.r, c.g, c.b, 0.3, c.r, c.g, c.b, 0.0, c.r, c.g, c.b, 0.0);
        ringPos.push(a.position[0] + Math.cos(t0) * R, 0.08, a.position[2] + Math.sin(t0) * R, a.position[0] + Math.cos(t1) * R, 0.08, a.position[2] + Math.sin(t1) * R);
        ringCol.push(c.r, c.g, c.b, 0.9, c.r, c.g, c.b, 0.9);
      }
    }
    const poolGeo = new THREE.BufferGeometry();
    poolGeo.setAttribute("position", new THREE.Float32BufferAttribute(poolPos, 3));
    poolGeo.setAttribute("color", new THREE.Float32BufferAttribute(poolCol, 4));
    const poolMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const pools = new THREE.Mesh(poolGeo, poolMat);
    pools.renderOrder = -4;
    pools.frustumCulled = false;

    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(ringPos, 3));
    ringGeo.setAttribute("color", new THREE.Float32BufferAttribute(ringCol, 4));
    const ringMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const rings = new THREE.LineSegments(ringGeo, ringMat);
    rings.renderOrder = -3;
    rings.frustumCulled = false;
    return { plane, groundMat, ground, poolGeo, poolMat, pools, ringGeo, ringMat, rings };
  }, [layout]);

  useEffect(
    () => () => {
      built.plane.dispose();
      built.groundMat.dispose();
      built.poolGeo.dispose();
      built.poolMat.dispose();
      built.ringGeo.dispose();
      built.ringMat.dispose();
    },
    [built],
  );

  useFrame((state) => {
    built.groundMat.uniforms.uTime!.value = state.clock.elapsedTime;
    built.groundMat.uniforms.uPower!.value = visuals.expand;
  });

  return (
    <>
      <primitive object={built.ground} />
      <primitive object={built.pools} />
      <primitive object={built.rings} />
    </>
  );
}

const RAIN_VERT = /* glsl */ `
  attribute float aEnd;
  attribute vec2 aRain; // x: speed, y: phase
  uniform float uTime;
  uniform float uHeight;
  varying float vA;
  void main() {
    vec3 p = position;
    float fall = mod(aRain.y * uHeight - uTime * aRain.x, uHeight);
    p.y = fall + aEnd * 1.6;
    vA = (1.0 - aEnd) * 0.55 + aEnd * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RAIN_FRAG = /* glsl */ `
  varying float vA;
  void main() { gl_FragColor = vec4(0.65, 0.9, 1.0, vA * 0.5); }
`;

/** Streaks of rain falling through the city: a pure vertex-shader animation, zero per-frame JS. */
export function Rain({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const built = useMemo(() => {
    const pos = new Float32Array(count * 6);
    const end = new Float32Array(count * 2);
    const rain = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const x = (hash01(`r${i}x`) - 0.5) * 150;
      const z = (hash01(`r${i}z`) - 0.5) * 150;
      pos.set([x, 0, z, x, 0, z], i * 6);
      end.set([0, 1], i * 2);
      const sp = 22 + hash01(`r${i}s`) * 20;
      const ph = hash01(`r${i}p`);
      rain.set([sp, ph, sp, ph], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    geo.setAttribute("aRain", new THREE.BufferAttribute(rain, 2));
    const mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uHeight: { value: 70 } },
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 6;
    return { geo, mat, lines };
  }, [count]);

  useEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );
  useFrame((state) => {
    built.mat.uniforms.uTime!.value = reducedMotion ? 0 : state.clock.elapsedTime;
  });
  return <primitive object={built.lines} />;
}
