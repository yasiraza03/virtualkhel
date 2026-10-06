"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { hash01 } from "@/lib/galaxy-layout";
import { NEBULA_FRAG, NEBULA_VERT, STAR_FRAG, STAR_VERT } from "./shaders";
import { visuals } from "./scene-visuals";

const STAR_COLORS = ["#F5F0FF", "#F5F0FF", "#00F0FF", "#FF2D95", "#FFE600", "#9D4DFF"].map((c) => new THREE.Color(c));
const NEBULA_COLORS = ["#FF2D95", "#00F0FF", "#9D4DFF", "#FF6A00", "#FF2D95", "#00F0FF"].map((c) => new THREE.Color(c));

interface Props {
  quality: "high" | "low";
  reducedMotion: boolean;
}

/** Procedural background: thousands of batched stars plus soft nebula sprites. Seeded, so identical every load. */
export function Backdrop({ quality, reducedMotion }: Props) {
  const starCount = quality === "low" ? 2600 : 7000;
  const nebulaCount = quality === "low" ? 160 : 420;

  const stars = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const size = new Float32Array(starCount);
    const tw = new Float32Array(starCount * 2);
    for (let i = 0; i < starCount; i++) {
      const u = hash01(`s${i}u`) * 0.92 + 0.02;
      const th = hash01(`s${i}t`) * Math.PI * 2;
      const r = 70 + Math.pow(hash01(`s${i}r`), 0.8) * 380;
      const rr = Math.sqrt(1 - u * u);
      pos.set([rr * Math.cos(th) * r, u * r * 0.85, rr * Math.sin(th) * r], i * 3);
      const c = STAR_COLORS[Math.floor(hash01(`s${i}c`) * STAR_COLORS.length)]!;
      const b = 0.35 + hash01(`s${i}b`) * 0.65;
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = 1.1 + Math.pow(hash01(`s${i}z`), 4) * 4.2;
      tw.set([hash01(`s${i}p`) * 6.28, 0.6 + hash01(`s${i}q`) * 2.2], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aTwinkle", new THREE.BufferAttribute(tw, 2));
    const mat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDpr: { value: 1 },
        uTwinkle: { value: reducedMotion ? 0 : 1 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
    });
    return { geo, mat };
  }, [starCount, reducedMotion]);

  const nebula = useMemo(() => {
    const pos = new Float32Array(nebulaCount * 3);
    const col = new Float32Array(nebulaCount * 3);
    const size = new Float32Array(nebulaCount);
    const alpha = new Float32Array(nebulaCount);
    for (let i = 0; i < nebulaCount; i++) {
      // clouds hug the spiral arms of the ring layout with generous scatter
      const a = hash01(`n${i}a`) * Math.PI * 2;
      const r = 8 + Math.pow(hash01(`n${i}r`), 0.7) * 62;
      const swirl = a + r * 0.045;
      pos.set([Math.cos(swirl) * r, (hash01(`n${i}y`) - 0.5) * 22, Math.sin(swirl) * r], i * 3);
      const c = NEBULA_COLORS[Math.floor(hash01(`n${i}c`) * NEBULA_COLORS.length)]!;
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = 16 + hash01(`n${i}s`) * 36;
      alpha[i] = 0.012 + hash01(`n${i}l`) * 0.03;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPx: { value: 800 },
        uDpr: { value: 1 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
    });
    return { geo, mat };
  }, [nebulaCount]);

  // A far-off neon skyline: hundreds of thin lit towers ringing the void, like a night city seen from orbit.
  const skyline = useMemo(() => {
    const count = quality === "low" ? 140 : 340;
    const pos = new Float32Array(count * 6);
    const col = new Float32Array(count * 6);
    const palette = ["#FF2D95", "#00F0FF", "#FFE600", "#9D4DFF", "#FF3B30"].map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      const a = hash01(`k${i}a`) * Math.PI * 2;
      const r = 150 + hash01(`k${i}r`) * 130;
      const h = 8 + Math.pow(hash01(`k${i}h`), 2) * 70;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const base = 0;
      pos.set([x, base, z, x, base + h, z], i * 6);
      const c = palette[Math.floor(hash01(`k${i}c`) * palette.length)]!;
      col.set([c.r * 0.12, c.g * 0.12, c.b * 0.12, c.r, c.g, c.b], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    return { geo, mat };
  }, [quality]);

  useEffect(
    () => () => {
      skyline.geo.dispose();
      skyline.mat.dispose();
    },
    [skyline],
  );

  useEffect(
    () => () => {
      stars.geo.dispose();
      stars.mat.dispose();
    },
    [stars],
  );
  useEffect(
    () => () => {
      nebula.geo.dispose();
      nebula.mat.dispose();
    },
    [nebula],
  );

  const starRef = useRef<THREE.Points>(null);
  const nebRef = useRef<THREE.Points>(null);
  useFrame((state, dt) => {
    const dpr = state.gl.getPixelRatio();
    const cam = state.camera as THREE.PerspectiveCamera;
    const px = (state.size.height * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    stars.mat.uniforms.uTime!.value = state.clock.elapsedTime;
    stars.mat.uniforms.uDpr!.value = dpr;
    (stars.mat.uniforms.uTint!.value as THREE.Color).copy(visuals.tint);
    nebula.mat.uniforms.uPx!.value = px;
    nebula.mat.uniforms.uDpr!.value = dpr;
    (nebula.mat.uniforms.uTint!.value as THREE.Color).copy(visuals.tint);
    if (!reducedMotion) {
      if (starRef.current) starRef.current.rotation.y += dt * 0.0035;
      if (nebRef.current) nebRef.current.rotation.y += dt * 0.012;
    }
  });

  return (
    <>
      <points ref={starRef} geometry={stars.geo} material={stars.mat} frustumCulled={false} renderOrder={-3} />
      <lineSegments geometry={skyline.geo} material={skyline.mat} frustumCulled={false} renderOrder={-4} />
      <points ref={nebRef} geometry={nebula.geo} material={nebula.mat} frustumCulled={false} renderOrder={-2} />
    </>
  );
}
