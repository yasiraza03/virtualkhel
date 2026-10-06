/**
 * Turns app state (+ journey stage) into per-node and per-edge visual targets. Pure and cheap:
 * called only when the store version or journey stage changes, never per frame.
 */
import { CLUSTER_BY_ID } from "@/lib/clusters";
import { getMatches } from "@/lib/store";
import type { AppState } from "@/lib/store";
import { isVerified, otherEnd } from "@/lib/graph";
import type { GameGraph } from "@/lib/graph";
import { journeyPath, JOURNEY_CLUSTER } from "@/lib/journey-config";
import { GAME_INDEX } from "@/lib/games";
import type { GraphEdge } from "@/types/game";

export interface NodeTargets {
  size: Float32Array;
  alpha: Float32Array;
  state: Float32Array;
}

export interface Highlight {
  a: number;
  b: number;
  kind: "verified" | "inferred" | "path" | "taste";
}

export interface SceneTargets {
  nodes: NodeTargets;
  edgeAlpha: Float32Array;
  highlights: Highlight[];
  /** true when highlights should be revealed progressively (path draw-in) */
  progressive: boolean;
}

/** Documented node size metric: base + sqrt(connection count). Diameter in world units. */
export const nodeBaseSize = (degree: number) => 0.5 + 0.15 * Math.sqrt(degree);

export function computeTargets(state: AppState, graph: GameGraph, stage: number): SceneTargets {
  const n = graph.games.length;
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  const st = new Float32Array(n);
  const edgeAlpha = new Float32Array(graph.edges.length);
  const highlights: Highlight[] = [];
  let progressive = false;

  const explore = state.mode === "explore";
  const matches = getMatches(state);
  const selected = state.selectedId ? (GAME_INDEX.get(state.selectedId) ?? -1) : -1;
  const hovered = state.hoveredId ? (GAME_INDEX.get(state.hoveredId) ?? -1) : -1;
  const taste = state.taste;
  const favIdx = new Set(state.favorites.map((id) => GAME_INDEX.get(id)).filter((x): x is number => x !== undefined));
  const recRank = new Map<number, number>();
  taste?.recommendations.forEach((r, rank) => recRank.set(r.index, rank));

  const neighbours = new Set<number>();
  if (selected >= 0) for (const ei of graph.adjacency[selected] ?? []) neighbours.add(otherEnd(graph.edges[ei]!, selected));

  const jPath = !explore && stage === 4 ? journeyPath(graph) : null;
  const pathNodes = new Set(jPath?.nodes ?? []);

  for (let i = 0; i < n; i++) {
    const g = graph.games[i]!;
    let s = nodeBaseSize(graph.degree[i] ?? 0);
    let a = 0.9;
    let t = 0;

    if (!explore) {
      if (stage === 3) a = g.genres[0] === JOURNEY_CLUSTER ? 1 : 0.16;
      else if (stage === 4) {
        if (pathNodes.has(i)) { a = 1; s *= 1.7; t = 3; }
        else a = 0.2;
      } else if (stage === 5 && taste) {
        if (favIdx.has(i)) { a = 1; s *= 1.9; t = 2; }
        else if (recRank.has(i)) { a = 1; s *= 1.5 - Math.min(0.4, (recRank.get(i) ?? 0) * 0.05); t = 3; }
        else a = 0.18;
      } else if (stage <= 1) a = 0.8;
    }

    if (matches && !matches.has(g.id)) {
      a = Math.min(a, 0.1);
      s *= 0.7;
    }
    if (explore && taste && !(matches && !matches.has(g.id))) {
      if (favIdx.has(i)) { s *= 1.8; a = 1; t = 2; }
      else if (recRank.has(i)) { s *= 1.5 - Math.min(0.4, (recRank.get(i) ?? 0) * 0.05); a = 1; t = 3; }
      else if (selected < 0) a = Math.min(a, 0.4);
    }
    if (explore && selected >= 0) {
      if (i === selected) { s *= 2.1; a = 1; t = 2; }
      else if (neighbours.has(i)) { s *= 1.25; a = Math.max(a, 0.95); }
      else a = Math.min(a, 0.32);
    }
    if (explore && i === hovered && i !== selected) { s *= 1.5; a = 1; t = Math.max(t, 1); }

    size[i] = s;
    alpha[i] = a;
    st[i] = t;
  }

  // edges
  const focus = selected >= 0;
  graph.edges.forEach((e: GraphEdge, ei) => {
    let a = isVerified(e.kind) ? 0.42 : 0.24;
    const ga = graph.games[e.a]!;
    const gb = graph.games[e.b]!;
    if (ga.genres[0] !== gb.genres[0]) a *= 0.55; // long cross-system links stay quieter than local structure
    if (matches && (!matches.has(ga.id) || !matches.has(gb.id))) a *= 0.15;
    if (focus) a *= e.a === selected || e.b === selected ? 1.5 : 0.18;
    else if (explore && taste) a *= 0.5;
    if (!explore) {
      if (stage === 3) a *= graph.games[e.a]!.genres[0] === JOURNEY_CLUSTER && graph.games[e.b]!.genres[0] === JOURNEY_CLUSTER ? 1.6 : 0.15;
      else if (stage === 4 || stage === 5) a *= 0.35;
      else if (stage <= 1) a *= 0.6;
    }
    edgeAlpha[ei] = a;
  });

  // highlights
  if (jPath) {
    progressive = true;
    jPath.edges.forEach((ei, k) => {
      const e = graph.edges[ei]!;
      highlights.push({ a: jPath.nodes[k]!, b: jPath.nodes[k + 1]!, kind: "path" });
      void e;
    });
  } else if (explore && selected >= 0) {
    const adj = [...(graph.adjacency[selected] ?? [])]
      .map((ei) => graph.edges[ei]!)
      .sort((x, y) => Number(isVerified(y.kind)) - Number(isVerified(x.kind)) || y.score - x.score)
      .slice(0, 28);
    for (const e of adj) highlights.push({ a: selected, b: otherEnd(e, selected), kind: isVerified(e.kind) ? "verified" : "inferred" });
  } else if (taste && (explore || stage === 5)) {
    const favs = [...favIdx];
    for (const r of taste.recommendations.slice(0, 6)) for (const f of favs) highlights.push({ a: f, b: r.index, kind: "taste" });
  }
  return { nodes: { size, alpha, state: st }, edgeAlpha, highlights: highlights.slice(0, 120), progressive };
}

export function clusterColor(id: string): string {
  return CLUSTER_BY_ID[id as keyof typeof CLUSTER_BY_ID]?.color ?? "#F5F0FF";
}
