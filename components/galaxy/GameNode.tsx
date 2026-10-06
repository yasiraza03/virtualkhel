"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CLUSTER_BY_ID } from "@/lib/clusters";
import type { GalaxyLayout } from "@/lib/galaxy-layout";
import type { GameGraph } from "@/lib/graph";
import { nodeBaseSize } from "@/lib/scene-targets";
import { NODE_FRAG, NODE_VERT } from "./shaders";
import type { Live } from "./scene-types";

interface Props {
  graph: GameGraph;
  layout: GalaxyLayout;
  live: { current: Live };
}

/**
 * Every game node in ONE draw call: a point sprite with per-node colour/size/alpha/state attributes.
 * Attribute buffers are eased toward the targets computed by lib/scene-targets, directly in the render loop.
 */
export function NodeField({ graph, layout, live }: Props) {
  const built = useMemo(() => {
    const n = graph.games.length;
    const color = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n).fill(0.9);
    const state = new Float32Array(n);
    const tmp = new THREE.Color();
    graph.games.forEach((g, i) => {
      tmp.set(CLUSTER_BY_ID[g.genres[0]!].color);
      color.set([tmp.r, tmp.g, tmp.b], i * 3);
      size[i] = nodeBaseSize(graph.degree[i] ?? 0);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(layout.positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aState", new THREE.BufferAttribute(state, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: 800 }, uSizeMul: { value: 1 }, uDpr: { value: 1 }, uTime: { value: 0 } },
    });
    return { geo, mat, size, alpha, state };
  }, [graph, layout]);

  useEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
    },
    [built],
  );

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const dpr = state.gl.getPixelRatio();
    const u = built.mat.uniforms;
    u.uPx!.value = (state.size.height * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    u.uDpr!.value = dpr;
    u.uTime!.value = state.clock.elapsedTime;
    u.uSizeMul!.value = 1;

    const t = live.current.targets;
    if (!t) return;
    const k = 1 - Math.exp(-dt * 9);
    let moving = false;
    const sz = built.size;
    const al = built.alpha;
    const st = built.state;
    for (let i = 0; i < sz.length; i++) {
      const ds = t.nodes.size[i]! - sz[i]!;
      const da = t.nodes.alpha[i]! - al[i]!;
      if (Math.abs(ds) > 0.002 || Math.abs(da) > 0.002) {
        sz[i] = sz[i]! + ds * k;
        al[i] = al[i]! + da * k;
        moving = true;
      }
      st[i] = t.nodes.state[i]!;
    }
    const a = built.geo.attributes;
    (a.aState as THREE.BufferAttribute).needsUpdate = true;
    if (moving) {
      (a.aSize as THREE.BufferAttribute).needsUpdate = true;
      (a.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return <points geometry={built.geo} material={built.mat} frustumCulled={false} renderOrder={2} />;
}
