import { computeLayout } from "@/lib/galaxy-layout";
import type { GalaxyLayout } from "@/lib/galaxy-layout";
import { GAMES, RELATIONSHIPS } from "@/lib/games";
import { assembleGraph, computeScoreRows } from "@/lib/graph";
import type { GameGraph } from "@/lib/graph";

export interface Universe {
  graph: GameGraph;
  layout: GalaxyLayout;
}

let cached: Universe | null = null;
let pending: Promise<Universe> | null = null;

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Builds the graph and deterministic layout once per page load. The similarity matrix is computed in
 * small row chunks with a yield between them, so the ~1 s of pure compute never blocks scrolling or input.
 */
export function loadUniverse(): Promise<Universe> {
  if (cached) return Promise.resolve(cached);
  pending ??= (async () => {
    const n = GAMES.length;
    const scores = new Float32Array(n * n);
    const CHUNK = 6;
    for (let row = 0; row < n; row += CHUNK) {
      computeScoreRows(GAMES, scores, row, row + CHUNK);
      await yieldToBrowser();
    }
    const graph = assembleGraph(GAMES, RELATIONSHIPS, scores);
    cached = { graph, layout: computeLayout(graph) };
    return cached;
  })();
  return pending;
}
