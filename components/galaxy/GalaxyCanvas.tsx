"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLUSTERS, CLUSTER_BY_ID } from "@/lib/clusters";
import { GAME_INDEX, GAMES } from "@/lib/games";
import { getMatches, actions, store, useStore } from "@/lib/store";
import type { Universe } from "@/lib/universe";
import { bus } from "./scene-bus";
import GalaxyScene from "./GalaxyScene";

interface Props {
  universe: Universe;
  quality: "high" | "low";
}

/**
 * The only component that owns a <canvas>. Everything readable (labels, tooltip, announcements) is
 * plain HTML positioned imperatively by the render loop.
 */
export default function GalaxyCanvas({ universe, quality }: Props) {
  const mode = useStore((s) => s.mode);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const announcement = useStore((s) => s.announcement);
  const [dpr, setDpr] = useState<number>(quality === "low" ? 1.25 : 1.75);
  const hoverTitle = useRef<HTMLSpanElement>(null);
  const hoverMeta = useRef<HTMLSpanElement>(null);
  const selectedTitle = useRef<HTMLSpanElement>(null);
  const history = useRef<string[]>([]);

  const registerCluster = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) bus.clusterLabels.set(id, el);
    else bus.clusterLabels.delete(id);
  }, []);

  // Imperative text for the hover card / selection tag so React never re-renders on hover.
  useEffect(() => {
    const paint = () => {
      const s = store.get();
      const h = s.hoveredId ? GAMES[GAME_INDEX.get(s.hoveredId) ?? -1] : undefined;
      if (h && hoverTitle.current && hoverMeta.current) {
        const i = GAME_INDEX.get(h.id)!;
        hoverTitle.current.textContent = h.title;
        hoverMeta.current.textContent = `${h.year} · ${CLUSTER_BY_ID[h.genres[0]!].label} · ${universe.graph.degree[i]} links`;
        hoverTitle.current.style.color = CLUSTER_BY_ID[h.genres[0]!].color;
      }
      const sel = s.selectedId ? GAMES[GAME_INDEX.get(s.selectedId) ?? -1] : undefined;
      if (selectedTitle.current) selectedTitle.current.textContent = sel?.title ?? "";
    };
    paint();
    return store.subscribe(paint);
  }, [universe]);

  useEffect(() => {
    document.body.dataset.galaxy = "ready";
    return () => {
      delete document.body.dataset.galaxy;
    };
  }, []);

  const visibleList = useCallback(() => {
    const m = getMatches();
    return GAMES.filter((g) => !m || m.has(g.id));
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = store.get();
    if (s.mode !== "explore") return;
    const list = visibleList();
    const idx = list.findIndex((g) => g.id === s.selectedId);
    const pick = (id: string | undefined) => {
      if (!id) return;
      if (s.selectedId) history.current.push(s.selectedId);
      actions.select(id);
    };
    switch (e.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        if (!list.length) return;
        const step = e.key === "ArrowRight" ? 1 : -1;
        pick(list[(idx + step + list.length * 2) % list.length]?.id);
        break;
      }
      case "ArrowUp": {
        if (!s.selectedId) return;
        const i = GAME_INDEX.get(s.selectedId)!;
        const best = universe.graph.adjacency[i]
          ?.map((ei) => universe.graph.edges[ei]!)
          .map((edge) => ({ j: edge.a === i ? edge.b : edge.a, s: edge.score }))
          .sort((a, b) => b.s - a.s)[0];
        if (best) pick(universe.graph.games[best.j]?.id);
        break;
      }
      case "ArrowDown": {
        const prev = history.current.pop();
        if (prev) actions.select(prev);
        break;
      }
      case "Enter":
        document.getElementById("detail-panel")?.focus();
        break;
      case "Escape":
        actions.select(null, false);
        break;
      case "r":
      case "R":
        actions.resetCamera();
        break;
      case "+":
      case "=":
        actions.zoom(0.75);
        break;
      case "-":
      case "_":
        actions.zoom(1.33);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const interactive = mode === "explore";

  return (
    <div
      className="galaxy-layer"
      data-mode={mode}
      role={interactive ? "application" : undefined}
      aria-label={interactive ? `Interactive 3D galaxy of ${GAMES.length} games. Arrow left and right move between games, up jumps to the strongest connection, down goes back, R resets the camera, plus and minus zoom.` : undefined}
      aria-hidden={interactive ? undefined : true}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
    >
      <Canvas
        dpr={[1, dpr]}
        camera={{ fov: 50, near: 0.1, far: 1400, position: [0, 9, 118] }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor("#080611")}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} flipflops={3} onFallback={() => setDpr(1)}>
          <GalaxyScene universe={universe} quality={quality} reducedMotion={reducedMotion} />
        </PerformanceMonitor>
      </Canvas>

      <div className="label-layer" aria-hidden="true">
        {CLUSTERS.map((c) => (
          <span key={c.id} ref={registerCluster(c.id)} className="cluster-label" style={{ color: c.color }}>
            {c.label}
          </span>
        ))}
        <div
          ref={(el) => {
            bus.hover = el;
          }}
          className="hover-card"
        >
          <span ref={hoverTitle} className="hover-title" />
          <span ref={hoverMeta} className="hover-meta" />
        </div>
        <div
          ref={(el) => {
            bus.selected = el;
          }}
          className="selected-tag"
        >
          <span ref={selectedTitle} />
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
