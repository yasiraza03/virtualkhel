/**
 * Game graph.
 *
 * Nodes are games. Edges come in two families that the UI draws differently:
 *  - VERIFIED  : derived from dataset facts - same franchise, same developer, or a curated relationship.
 *  - INFERRED  : the top INFERRED_NEIGHBOURS most similar games per node by Game DNA score (>= MIN_INFERRED_SCORE).
 *
 * Node size metric ("connection count"): the number of distinct edges incident to a node.
 */
import { GAME_INDEX } from "@/lib/games";
import { profileOfGame, scoreAgainstProfile } from "@/lib/similarity";
import type { CuratedRelationship, EdgeKind, Game, GraphEdge } from "@/types/game";

export const INFERRED_NEIGHBOURS = 3;
export const MIN_INFERRED_SCORE = 0.42;

export interface GameGraph {
  games: Game[];
  edges: GraphEdge[];
  /** adjacency[i] = indices into `edges` touching node i */
  adjacency: number[][];
  degree: number[];
  /** Dense symmetric similarity matrix, row-major n*n. */
  scores: Float32Array;
}

export const isVerified = (kind: EdgeKind) => kind !== "similarity";

export function pairScore(graph: GameGraph, a: number, b: number): number {
  return graph.scores[a * graph.games.length + b] ?? 0;
}

export function otherEnd(edge: GraphEdge, node: number): number {
  return edge.a === node ? edge.b : edge.a;
}

/** Fill rows [from, to) of the upper triangle of the score matrix (and mirror them). Chunkable. */
export function computeScoreRows(games: Game[], scores: Float32Array, from: number, to: number): void {
  const n = games.length;
  for (let i = from; i < Math.min(to, n); i++) {
    const gi = games[i];
    if (!gi) continue;
    const profile = profileOfGame(gi);
    for (let j = i + 1; j < n; j++) {
      const gj = games[j];
      if (!gj) continue;
      const s = scoreAgainstProfile(profile, gj).score;
      scores[i * n + j] = s;
      scores[j * n + i] = s;
    }
  }
}

export function buildGraph(games: Game[], relationships: CuratedRelationship[]): GameGraph {
  const scores = new Float32Array(games.length * games.length);
  // The score is symmetric, so each unordered pair is computed once and mirrored.
  computeScoreRows(games, scores, 0, games.length);
  return assembleGraph(games, relationships, scores);
}

/** Turn a finished score matrix into edges, adjacency and degrees. */
export function assembleGraph(games: Game[], relationships: CuratedRelationship[], scores: Float32Array): GameGraph {
  const n = games.length;
  const edges: GraphEdge[] = [];
  const key = (a: number, b: number) => (a < b ? a * n + b : b * n + a);
  const used = new Map<number, number>(); // pair -> edge index

  const add = (a: number, b: number, kind: EdgeKind, note?: string) => {
    const k = key(a, b);
    const existing = used.get(k);
    const score = scores[a * n + b] ?? 0;
    if (existing !== undefined) {
      const e = edges[existing];
      // verified beats inferred; curated beats franchise beats developer
      const rank = (x: EdgeKind) => ({ similarity: 0, developer: 1, franchise: 2, curated: 3 })[x];
      if (e && rank(kind) > rank(e.kind)) {
        e.kind = kind;
        if (note) e.note = note;
      }
      return;
    }
    used.set(k, edges.length);
    edges.push({ a: Math.min(a, b), b: Math.max(a, b), kind, score, note });
  };

  // Verified: franchise and developer groups.
  const franchises = new Map<string, number[]>();
  const developers = new Map<string, number[]>();
  games.forEach((g, i) => {
    if (g.franchise) (franchises.get(g.franchise) ?? franchises.set(g.franchise, []).get(g.franchise)!).push(i);
    for (const d of g.developers) (developers.get(d) ?? developers.set(d, []).get(d)!).push(i);
  });
  for (const [name, group] of franchises) {
    for (let x = 0; x < group.length; x++)
      for (let y = x + 1; y < group.length; y++) add(group[x]!, group[y]!, "franchise", `Same franchise: ${name}`);
  }
  for (const [name, group] of developers) {
    // Very large studios would otherwise form hairballs; cap the clique and rely on franchise/similarity beyond it.
    if (group.length > 8) continue;
    for (let x = 0; x < group.length; x++)
      for (let y = x + 1; y < group.length; y++) add(group[x]!, group[y]!, "developer", `Same developer: ${name}`);
  }
  for (const r of relationships) {
    const a = GAME_INDEX.get(r.a);
    const b = GAME_INDEX.get(r.b);
    if (a !== undefined && b !== undefined) add(a, b, "curated", r.note);
  }

  // Inferred: top-k similarity neighbours.
  for (let i = 0; i < n; i++) {
    const ranked: { j: number; s: number }[] = [];
    for (let j = 0; j < n; j++) if (j !== i) ranked.push({ j, s: scores[i * n + j] ?? 0 });
    ranked.sort((p, q) => q.s - p.s || p.j - q.j);
    for (const { j, s } of ranked.slice(0, INFERRED_NEIGHBOURS)) if (s >= MIN_INFERRED_SCORE) add(i, j, "similarity");
  }

  const adjacency: number[][] = Array.from({ length: n }, () => []);
  edges.forEach((e, idx) => {
    adjacency[e.a]!.push(idx);
    adjacency[e.b]!.push(idx);
  });
  return { games, edges, adjacency, degree: adjacency.map((a) => a.length), scores };
}

/** Edge traversal cost: dissimilar hops are expensive, verified hops get a discount. */
export function edgeCost(edge: GraphEdge): number {
  return Math.max(0.05, 1 - edge.score - (isVerified(edge.kind) ? 0.12 : 0));
}

export interface GraphPath {
  nodes: number[];
  edges: number[];
  cost: number;
}

/** Dijkstra over the game graph. n is small (hundreds), so a linear scan frontier is plenty. */
export function shortestPath(graph: GameGraph, from: number, to: number): GraphPath | null {
  const n = graph.games.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const prevEdge = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  dist[from] = 0;
  for (let step = 0; step < n; step++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && (dist[i] ?? Infinity) < best) { best = dist[i]!; u = i; }
    if (u === -1 || u === to) break;
    done[u] = true;
    for (const ei of graph.adjacency[u] ?? []) {
      const e = graph.edges[ei]!;
      const v = otherEnd(e, u);
      const alt = best + edgeCost(e);
      if (alt < (dist[v] ?? Infinity)) {
        dist[v] = alt;
        prev[v] = u;
        prevEdge[v] = ei;
      }
    }
  }
  if (!Number.isFinite(dist[to] ?? Infinity)) return null;
  const nodes: number[] = [];
  const edges: number[] = [];
  for (let at = to; at !== -1; at = prev[at]!) {
    nodes.push(at);
    if (prevEdge[at] !== -1) edges.push(prevEdge[at]!);
  }
  return { nodes: nodes.reverse(), edges: edges.reverse(), cost: dist[to]! };
}

/** Neighbour indices of a node sorted by similarity, best first. */
export function nearestNeighbours(graph: GameGraph, node: number, limit = 8): { index: number; score: number }[] {
  const n = graph.games.length;
  const out: { index: number; score: number }[] = [];
  for (let j = 0; j < n; j++) if (j !== node) out.push({ index: j, score: graph.scores[node * n + j] ?? 0 });
  out.sort((a, b) => b.score - a.score || a.index - b.index);
  return out.slice(0, limit);
}
