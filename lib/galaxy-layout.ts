/**
 * Deterministic galaxy layout.
 *
 *  - Cluster centres sit on a fixed ring ordered so neighbouring genres share design DNA.
 *  - Inside a cluster the starting angle/radius come from a hash of the game id, never from Math.random().
 *  - The galaxy is a night city: every game is a tower whose HEIGHT is its connection count
 *    (see towerHeight); a beacon hovers just above it. Node positions returned here are the beacon positions.
 *  - A fixed number of relaxation passes pulls similar games together, pulls hybrid games toward their
 *    secondary genre's cluster, and pushes overlapping nodes apart. Same input -> same output, every render.
 */
import { CLUSTERS } from "@/lib/clusters";
import type { GameGraph } from "@/lib/graph";
import type { ClusterId } from "@/types/game";

export const RING_RADIUS = 27;
export const YEAR_MIN = 1985;
export const YEAR_MAX = 2023;
export const HEIGHT_SPAN = 9;
export const BEACON_LIFT = 0.9;

/** Tower height in world units from the documented size metric (connection count). */
export const towerHeight = (degree: number) => 3 + degree * 1.5;
export const towerWidth = (degree: number) => 0.8 + degree * 0.05;

export function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface ClusterAnchor {
  id: ClusterId;
  position: [number, number, number];
  radius: number;
  count: number;
  /** Height of the tallest beacon in the district (for labels and camera framing). */
  height: number;
}

export interface GalaxyLayout {
  /** Flat xyz triplets, one per game, in dataset order. */
  positions: Float32Array;
  clusters: Record<ClusterId, ClusterAnchor>;
}

export function yearToHeight(year: number): number {
  const t = (Math.min(YEAR_MAX, Math.max(YEAR_MIN, year)) - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
  return (t - 0.5) * HEIGHT_SPAN;
}

export function computeLayout(graph: GameGraph): GalaxyLayout {
  const { games } = graph;
  const n = games.length;
  const counts = new Map<ClusterId, number>();
  for (const g of games) counts.set(g.genres[0]!, (counts.get(g.genres[0]!) ?? 0) + 1);

  const clusters = {} as Record<ClusterId, ClusterAnchor>;
  CLUSTERS.forEach((c, i) => {
    const angle = (i / CLUSTERS.length) * Math.PI * 2 + 0.35;
    const count = counts.get(c.id) ?? 0;
    // slight alternating radius gives the ring a spiral-arm feel without randomness
    const r = RING_RADIUS + (i % 2 === 0 ? 2.2 : -2.2);
    clusters[c.id] = {
      id: c.id,
      position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
      radius: 2.4 + Math.sqrt(count) * 0.85,
      count,
      height: 10,
    };
  });

  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  games.forEach((g, i) => {
    const anchor = clusters[g.genres[0]!];
    const a = hash01(`${g.id}:a`) * Math.PI * 2;
    const r = Math.sqrt(hash01(`${g.id}:r`)) * anchor.radius;
    pos[i * 3] = anchor.position[0] + Math.cos(a) * r;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = anchor.position[2] + Math.sin(a) * r;
  });

  const MIN_DIST = 1.35;
  for (let iter = 0; iter < 90; iter++) {
    const cool = 1 - iter / 90;
    vel.fill(0);
    // repulsion (planar only: height is reserved for the year axis)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i * 3]! - pos[j * 3]!;
        const dz = pos[i * 3 + 2]! - pos[j * 3 + 2]!;
        const dy = pos[i * 3 + 1]! - pos[j * 3 + 1]!;
        const d2 = dx * dx + dy * dy * 0.4 + dz * dz;
        if (d2 < MIN_DIST * MIN_DIST * 2.2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((MIN_DIST * 1.48 - d) / d) * 0.5;
          vel[i * 3] = vel[i * 3]! + dx * push;
          vel[i * 3 + 2] = vel[i * 3 + 2]! + dz * push;
          vel[j * 3] = vel[j * 3]! - dx * push;
          vel[j * 3 + 2] = vel[j * 3 + 2]! - dz * push;
        }
      }
    }
    // springs along intra-cluster edges (stronger for verified), plus pull to home cluster and secondary genres
    for (const e of graph.edges) {
      // Cross-cluster edges would drag whole systems into the middle, so only intra-cluster edges act as springs.
      if (games[e.a]!.genres[0] !== games[e.b]!.genres[0]) continue;
      const dx = pos[e.b * 3]! - pos[e.a * 3]!;
      const dz = pos[e.b * 3 + 2]! - pos[e.a * 3 + 2]!;
      const d = Math.hypot(dx, dz) || 1;
      const rest = e.kind === "similarity" ? 3.4 : 2.6;
      const k = (e.kind === "similarity" ? 0.012 : 0.02) * (d - rest) / d;
      vel[e.a * 3] = vel[e.a * 3]! + dx * k;
      vel[e.a * 3 + 2] = vel[e.a * 3 + 2]! + dz * k;
      vel[e.b * 3] = vel[e.b * 3]! - dx * k;
      vel[e.b * 3 + 2] = vel[e.b * 3 + 2]! - dz * k;
    }
    games.forEach((g, i) => {
      g.genres.forEach((genre, gi) => {
        const anchor = clusters[genre];
        const w = gi === 0 ? 0.035 : 0.01;
        const dx = anchor.position[0] - pos[i * 3]!;
        const dz = anchor.position[2] - pos[i * 3 + 2]!;
        const d = Math.hypot(dx, dz) || 1;
        // Only pull when outside the cluster's radius so interiors can spread out.
        const over = Math.max(0, d - anchor.radius * (gi === 0 ? 0.9 : 1.6));
        vel[i * 3] = vel[i * 3]! + (dx / d) * over * w * 3;
        vel[i * 3 + 2] = vel[i * 3 + 2]! + (dz / d) * over * w * 3;
      });
    });
    for (let i = 0; i < n; i++) {
      pos[i * 3] = pos[i * 3]! + vel[i * 3]! * cool;
      pos[i * 3 + 2] = pos[i * 3 + 2]! + vel[i * 3 + 2]! * cool;
    }
  }
  // Final heights: towers rise from the street; the beacon floats above the roof.
  for (const c of Object.values(clusters)) c.height = 6;
  games.forEach((g, i) => {
    const top = towerHeight(graph.degree[i] ?? 0) + BEACON_LIFT;
    pos[i * 3 + 1] = top;
    const c = clusters[g.genres[0]!];
    c.height = Math.max(c.height, top);
  });
  return { positions: pos, clusters };
}
