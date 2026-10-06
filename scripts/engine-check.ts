/**
 * Invariant checks for the deterministic engine. Run with `npm run check`.
 * Exits non-zero on the first violated invariant so it can gate CI / Vercel builds.
 */
import { computeLayout } from "../lib/galaxy-layout";
import { GAMES, GAME_INDEX, RELATIONSHIPS } from "../lib/games";
import { buildGraph, shortestPath } from "../lib/graph";
import { readTaste, recommendSimilarTo } from "../lib/recommendations";
import { similarity } from "../lib/similarity";

let failed = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failed++;
};

const t0 = performance.now();
const graph = buildGraph(GAMES, RELATIONSHIPS);
const layout = computeLayout(graph);
console.log(`graph + layout built in ${(performance.now() - t0).toFixed(0)} ms (${graph.edges.length} edges)`);

// similarity
const n = GAMES.length;
let symmetric = true;
let bounded = true;
for (let i = 0; i < n && symmetric && bounded; i += 7) {
  for (let j = i + 1; j < n; j += 5) {
    const a = graph.scores[i * n + j]!;
    if (Math.abs(a - graph.scores[j * n + i]!) > 1e-6) symmetric = false;
    if (a < 0 || a > 1) bounded = false;
  }
}
ok(symmetric, "pairwise similarity is symmetric");
ok(bounded, "similarity stays within 0..1");
const ds = GAMES.find((g) => g.id === "dark-souls")!;
const dm = GAMES.find((g) => g.id === "demons-souls")!;
const fh = GAMES.find((g) => g.id === "forza-horizon-5")!;
ok(similarity(ds, dm).score > similarity(ds, fh).score, "Dark Souls is closer to Demon's Souls than to Forza Horizon 5");
ok(similarity(ds, ds).score > 0.95, "a game is nearly identical to itself");

// determinism
const again = computeLayout(buildGraph(GAMES, RELATIONSHIPS));
ok(again.positions.every((v, i) => v === layout.positions[i]), "layout is bit-for-bit deterministic across builds");
ok(layout.positions.every(Number.isFinite), "layout has no NaN/Infinity");

// graph structure
const seen = new Set<string>();
let dup = false;
for (const e of graph.edges) {
  const k = `${e.a}-${e.b}`;
  if (seen.has(k) || e.a === e.b) dup = true;
  seen.add(k);
}
ok(!dup, "no duplicate or self edges");
ok(graph.edges.filter((e) => e.kind === "curated").length === RELATIONSHIPS.length, "every curated relationship became a verified edge");
for (const e of graph.edges.filter((x) => x.kind === "franchise")) {
  if (GAMES[e.a]!.franchise !== GAMES[e.b]!.franchise) ok(false, `franchise edge ${e.a}-${e.b} mismatched`);
}
const a = GAME_INDEX.get("dark-souls")!;
const b = GAME_INDEX.get("hollow-knight")!;
const path = shortestPath(graph, a, b);
ok(!!path && path.nodes[0] === a && path.nodes.at(-1) === b, "Dijkstra finds the journey path");

// recommendations
const recs = recommendSimilarTo(GAMES, "stardew-valley", 5);
ok(recs.length === 5 && !recs.some((r) => r.id === "stardew-valley"), "recommendations exclude the seed game");
ok(recs.every((r, i) => i === 0 || recs[i - 1]!.score >= r.score), "recommendations are sorted by score");
const taste = readTaste(GAMES, ["dark-souls", "hollow-knight", "bloodborne"], 8)!;
ok(!taste.recommendations.some((r) => ["dark-souls", "hollow-knight", "bloodborne"].includes(r.id)), "taste ranking excludes the favourites");
ok(taste.recommendations.every((r) => r.reasons.length > 0), "every taste recommendation carries an explanation");
const again2 = readTaste(GAMES, ["dark-souls", "hollow-knight", "bloodborne"], 8)!;
ok(JSON.stringify(taste.recommendations.map((r) => [r.id, r.score])) === JSON.stringify(again2.recommendations.map((r) => [r.id, r.score])), "taste ranking is deterministic");

if (failed) {
  console.error(`\n${failed} invariant(s) failed`);
  process.exit(1);
}
console.log("\nAll engine invariants hold");
