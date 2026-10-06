"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildCityPlan } from "@/lib/city-plan";
import type { Box } from "@/lib/city-plan";
import type { GalaxyLayout } from "@/lib/galaxy-layout";
import { hash01 } from "@/lib/galaxy-layout";
import { makeParticles } from "./ConnectionLines";
import { TOWER_FRAG, TOWER_VERT } from "./City";
import { visuals } from "./scene-visuals";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** One instanced mesh of lit boxes/cones, reusing the tower shader (lit windows, neon edges, fog). */
function makeBlocks(geometry: THREE.BufferGeometry, items: Box[], alpha = 0.85) {
  const n = items.length;
  const geo = geometry.clone();
  const color = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const c = new THREE.Color();
  items.forEach((b, i) => {
    c.set(b.color);
    color.set([c.r, c.g, c.b], i * 3);
    seed[i] = b.seed;
  });
  geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
  geo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(n).fill(alpha), 1));
  geo.setAttribute("aState", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute("aNew", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: TOWER_VERT,
    fragmentShader: TOWER_FRAG,
    uniforms: { uMirror: { value: 0 }, uPower: { value: 0.5 }, uTime: { value: 0 } },
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  items.forEach((b, i) => {
    q.setFromAxisAngle(Y_AXIS, b.rot);
    m.compose(new THREE.Vector3(b.x, b.y ?? 0, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, geo, mat };
}

const LAMP_VERT = /* glsl */ `
  attribute vec3 aColor;
  uniform float uPx;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(1.1 * uPx / max(-mv.z, 1.0), 2.0, 46.0) * uDpr;
    vColor = aColor;
    vFade = exp(-max(-mv.z, 0.0) * 0.011);
  }
`;
const LAMP_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.28, 0.0, d);
    float halo = exp(-d * d * 4.0) * 0.6;
    gl_FragColor = vec4(vColor * (halo + core * 1.4) + core * 0.5, (core + halo) * vFade);
  }
`;

/**
 * Roads, street lamps, houses, parks, trees, ponds and the central pagoda: the city around the games.
 * All geometry is static and merged into a handful of draw calls; only the road traffic moves.
 */
export function Streets({ layout, quality, reducedMotion }: { layout: GalaxyLayout; quality: "high" | "low"; reducedMotion: boolean }) {
  const plan = useMemo(() => buildCityPlan(layout), [layout]);

  const built = useMemo(() => {
    const disposables: { dispose: () => void }[] = [];
    const objects: THREE.Object3D[] = [];
    const track = <T extends { dispose: () => void }>(d: T) => (disposables.push(d), d);

    // ---- roads: dark asphalt strips + lit kerbs + dashed centre line
    const asphalt: number[] = [];
    const kerb: number[] = [];
    const dash: number[] = [];
    for (const r of plan.roads) {
      const half = r.width / 2;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i]!;
        const [bx, bz] = r.pts[i + 1]!;
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (-(bz - az) / len) * half;
        const nz = ((bx - ax) / len) * half;
        const y = 0.035;
        asphalt.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx + nx, y, bz + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz);
        kerb.push(ax + nx, 0.06, az + nz, bx + nx, 0.06, bz + nz, ax - nx, 0.06, az - nz, bx - nx, 0.06, bz - nz);
        if (r.marked && i % 2 === 0) dash.push(ax, 0.07, az, bx, 0.07, bz);
      }
    }
    const roadGeo = track(new THREE.BufferGeometry());
    roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(asphalt, 3));
    const roadMat = track(new THREE.MeshBasicMaterial({ color: "#090611", transparent: true, opacity: 0.96, depthWrite: false, side: THREE.DoubleSide }));
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.renderOrder = -3.9;
    roadMesh.frustumCulled = false;
    objects.push(roadMesh);

    const mkLines = (arr: number[], color: string, opacity: number, order: number) => {
      const g = track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      const m = track(new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      const l = new THREE.LineSegments(g, m);
      l.renderOrder = order;
      l.frustumCulled = false;
      objects.push(l);
    };
    mkLines(kerb, "#FF2D95", 0.55, -3.8);
    mkLines(dash, "#FFE600", 0.8, -3.8);

    // ---- parks: lawns, ponds, rims
    const lawnPos: number[] = [];
    const lawnCol: number[] = [];
    const pondPos: number[] = [];
    const rim: number[] = [];
    const fan = (pos: number[], col: number[] | null, cx: number, cz: number, r: number, y: number, c0: number[], c1: number[]) => {
      const SEG = 40;
      for (let s = 0; s < SEG; s++) {
        const t0 = (s / SEG) * Math.PI * 2;
        const t1 = ((s + 1) / SEG) * Math.PI * 2;
        pos.push(cx, y, cz, cx + Math.cos(t0) * r, y, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, y, cz + Math.sin(t1) * r);
        col?.push(...c0, ...c1, ...c1);
      }
    };
    for (const p of plan.parks) {
      fan(lawnPos, lawnCol, p.x, p.z, p.r, 0.045, [0.1, 1, 0.3, 0.22], [0.1, 1, 0.3, 0.05]);
      for (let s = 0; s < 48; s++) {
        const t0 = (s / 48) * Math.PI * 2;
        const t1 = ((s + 1) / 48) * Math.PI * 2;
        rim.push(p.x + Math.cos(t0) * p.r, 0.08, p.z + Math.sin(t0) * p.r, p.x + Math.cos(t1) * p.r, 0.08, p.z + Math.sin(t1) * p.r);
      }
      if (p.pond > 0) fan(pondPos, null, p.x, p.z, p.pond, 0.07, [], []);
    }
    const lawnGeo = track(new THREE.BufferGeometry());
    lawnGeo.setAttribute("position", new THREE.Float32BufferAttribute(lawnPos, 3));
    lawnGeo.setAttribute("color", new THREE.Float32BufferAttribute(lawnCol, 4));
    const lawnMesh = new THREE.Mesh(lawnGeo, track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    lawnMesh.renderOrder = -3.7;
    lawnMesh.frustumCulled = false;
    objects.push(lawnMesh);
    const pondGeo = track(new THREE.BufferGeometry());
    pondGeo.setAttribute("position", new THREE.Float32BufferAttribute(pondPos, 3));
    const pondMesh = new THREE.Mesh(pondGeo, track(new THREE.MeshBasicMaterial({ color: "#00F0FF", transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    pondMesh.renderOrder = -3.6;
    pondMesh.frustumCulled = false;
    objects.push(pondMesh);
    mkLines(rim, "#39FF14", 0.6, -3.6);

    // ---- lamps: poles (instanced), glowing heads (points), light pools on the asphalt (instanced discs)
    const lampCount = quality === "low" ? Math.floor(plan.lamps.length * 0.55) : plan.lamps.length;
    const lamps = plan.lamps.filter((_, i) => i % (quality === "low" ? 2 : 1) === 0).slice(0, lampCount);
    const poleGeo = track(new THREE.BoxGeometry(0.07, 2.4, 0.07));
    poleGeo.translate(0, 1.2, 0);
    const poles = new THREE.InstancedMesh(poleGeo, track(new THREE.MeshBasicMaterial({ color: "#2b2342" })), lamps.length);
    const discGeo = track(new THREE.CircleGeometry(1.9, 18));
    discGeo.rotateX(-Math.PI / 2);
    const dc = new Float32Array((discGeo.attributes.position!.count) * 4);
    for (let i = 0; i < discGeo.attributes.position!.count; i++) dc.set(i === 0 ? [1, 1, 1, 0.3] : [1, 1, 1, 0], i * 4);
    discGeo.setAttribute("color", new THREE.BufferAttribute(dc, 4));
    const pools = new THREE.InstancedMesh(discGeo, track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), lamps.length);
    const headPos = new Float32Array(lamps.length * 3);
    const headCol = new Float32Array(lamps.length * 3);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    lamps.forEach((l, i) => {
      m.makeTranslation(l.x, 0, l.z);
      poles.setMatrixAt(i, m);
      m.makeTranslation(l.x, 0.09, l.z);
      pools.setMatrixAt(i, m);
      c.set(l.color);
      pools.setColorAt(i, c);
      headPos.set([l.x, 2.45, l.z], i * 3);
      headCol.set([c.r, c.g, c.b], i * 3);
    });
    poles.frustumCulled = false;
    pools.frustumCulled = false;
    pools.renderOrder = -3.5;
    objects.push(poles, pools);
    const headGeo = track(new THREE.BufferGeometry());
    headGeo.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
    headGeo.setAttribute("aColor", new THREE.BufferAttribute(headCol, 3));
    const headMat = track(
      new THREE.ShaderMaterial({ vertexShader: LAMP_VERT, fragmentShader: LAMP_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 800 }, uDpr: { value: 1 } } }),
    );
    const heads = new THREE.Points(headGeo, headMat);
    heads.frustumCulled = false;
    heads.renderOrder = 3;
    objects.push(heads);

    // ---- houses, roofs, trees, pagoda
    const box = track(new THREE.BoxGeometry(1, 1, 1));
    box.translate(0, 0.5, 0);
    const pyramid = track(new THREE.ConeGeometry(0.5 * Math.SQRT2, 1, 4));
    pyramid.translate(0, 0.5, 0);
    const treeCone = track(new THREE.ConeGeometry(0.5, 1, 7));
    treeCone.translate(0, 0.5, 0);
    const mats: THREE.ShaderMaterial[] = [];
    const addBlocks = (g: THREE.BufferGeometry, items: Box[], alpha = 0.85) => {
      if (!items.length) return;
      const b = makeBlocks(g, items, alpha);
      disposables.push(b.geo, b.mat, b.mesh);
      mats.push(b.mat);
      objects.push(b.mesh);
    };
    const keep = quality === "low" ? 2 : 1;
    addBlocks(box, plan.houses.filter((_, i) => i % keep === 0), 0.7);
    addBlocks(pyramid, plan.roofs.filter((_, i) => i % keep === 0), 0.38);
    addBlocks(
      treeCone,
      plan.trees.map((t, i) => ({ x: t.x, z: t.z, w: 1.1 * t.s, h: 2.6 * t.s, d: 1.1 * t.s, rot: 0, color: t.color, seed: hash01(`tr${i}`), y: 0.5 })),
      0.55,
    );
    addBlocks(box, plan.pagoda.tiers);
    addBlocks(pyramid, plan.pagoda.roofs, 0.6);

    // ---- road traffic (head/tail lights), updated per frame
    const CARS = quality === "low" ? 50 : 110;
    const traffic = makeParticles(CARS, 120);
    traffic.geo.setDrawRange(0, CARS);
    objects.push(traffic.points);
    disposables.push(traffic.geo, traffic.mat);
    const cars = Array.from({ length: CARS }, (_, i) => {
      const ring = i % 5 !== 0;
      const dir = hash01(`car${i}d`) > 0.5 ? 1 : -1;
      return {
        ring,
        dir,
        r: ring ? (hash01(`car${i}l`) > 0.5 ? 27 + 17 : 13) + dir * 0.75 : 0,
        angle: hash01(`car${i}a`) * Math.PI * 2,
        speed: 0.5 + hash01(`car${i}s`) * 0.7,
        spoke: Math.floor(hash01(`car${i}k`) * 13),
        t: hash01(`car${i}t`),
      };
    });
    cars.forEach((car, i) => {
      // forward-travelling cars show white headlights, the rest red tail lights
      traffic.col.set(car.dir > 0 ? [1, 0.95, 0.75] : [1, 0.15, 0.1], i * 3);
    });
    (traffic.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;

    return { objects, disposables, mats, headMat, traffic, cars };
  }, [plan, quality]);

  useEffect(
    () => () => {
      built.disposables.forEach((d) => d.dispose());
    },
    [built],
  );

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    for (const m of built.mats) {
      m.uniforms.uTime!.value = state.clock.elapsedTime;
      m.uniforms.uPower!.value = visuals.expand;
    }
    const cam = state.camera as THREE.PerspectiveCamera;
    const dpr = state.gl.getPixelRatio();
    built.headMat.uniforms.uPx!.value = (state.size.height * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    built.headMat.uniforms.uDpr!.value = dpr;
    built.traffic.mat.uniforms.uDpr!.value = dpr;
    const pos = built.traffic.pos;
    built.cars.forEach((car, i) => {
      if (car.ring) {
        const a = car.angle + car.dir * car.speed * t * (1 / car.r) * 6;
        pos[i * 3] = Math.cos(a) * car.r;
        pos[i * 3 + 1] = 0.35;
        pos[i * 3 + 2] = Math.sin(a) * car.r;
      } else {
        const spokeAng = (car.spoke / 13) * Math.PI * 2 + 0.35 + Math.PI / 13; // avenues run between districts
        const u = (car.t + car.dir * car.speed * t * 0.02 + 10) % 1;
        const r = 14 + u * 56;
        const off = car.dir * 0.7;
        pos[i * 3] = Math.cos(spokeAng) * r - Math.sin(spokeAng) * off;
        pos[i * 3 + 1] = 0.35;
        pos[i * 3 + 2] = Math.sin(spokeAng) * r + Math.cos(spokeAng) * off;
      }
    });
    (built.traffic.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <>
      {built.objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </>
  );
}
