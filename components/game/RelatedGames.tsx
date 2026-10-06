"use client";

import { Link2, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { CLUSTER_BY_ID } from "@/lib/clusters";
import { GAMES, GAME_INDEX } from "@/lib/games";
import { isVerified, otherEnd } from "@/lib/graph";
import { recommendSimilarTo } from "@/lib/recommendations";
import { actions } from "@/lib/store";
import type { Universe } from "@/lib/universe";

interface Props {
  universe: Universe | null;
  gameId: string;
}

const KIND_LABEL = { franchise: "Franchise", developer: "Developer", curated: "Curated", similarity: "Inferred" } as const;

/** Verified connections (dataset facts) and inferred nearest neighbours (Game DNA), kept visibly separate. */
export function RelatedGames({ universe, gameId }: Props) {
  const index = GAME_INDEX.get(gameId) ?? -1;
  const verified = useMemo(() => {
    if (!universe || index < 0) return [];
    return (universe.graph.adjacency[index] ?? [])
      .map((ei) => universe.graph.edges[ei]!)
      .filter((e) => isVerified(e.kind))
      .map((e) => ({ edge: e, other: GAMES[otherEnd(e, index)]! }))
      .sort((a, b) => b.edge.score - a.edge.score);
  }, [universe, index]);
  const similar = useMemo(() => recommendSimilarTo(GAMES, gameId, 6), [gameId]);

  return (
    <div className="space-y-6">
      {verified.length > 0 && (
        <section aria-labelledby="verified-h">
          <h3 id="verified-h" className="hud-label mb-3 flex items-center gap-2">
            <Link2 className="size-3.5 text-[var(--cyan)]" aria-hidden /> Verified links
          </h3>
          <ul className="space-y-2">
            {verified.map(({ edge, other }) => (
              <li key={other.id}>
                <button type="button" className="group flex w-full items-start gap-3 text-left" onClick={() => actions.select(other.id)}>
                  <span className="pip mt-1.5" style={{ color: CLUSTER_BY_ID[other.genres[0]!].color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium group-hover:text-[var(--cyan)]">{other.title}</span>
                    <span className="block text-xs text-[var(--text-3)]">
                      {KIND_LABEL[edge.kind]} · {edge.note ?? ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="similar-h">
        <h3 id="similar-h" className="hud-label mb-3 flex items-center gap-2">
          <Sparkles className="size-3.5 text-[var(--magenta)]" aria-hidden /> Nearest by Game DNA <span className="text-[var(--text-3)]">(inferred)</span>
        </h3>
        <ol className="space-y-3">
          {similar.map((r) => {
            const g = GAMES[r.index]!;
            return (
              <li key={r.id}>
                <button type="button" className="group w-full text-left" onClick={() => actions.select(g.id)}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="pip" style={{ color: CLUSTER_BY_ID[g.genres[0]!].color }} aria-hidden />
                      <span className="truncate text-sm font-medium group-hover:text-[var(--cyan)]">{g.title}</span>
                    </span>
                    <span className="num text-xs text-[var(--text-2)]">{Math.round(r.score * 100)}</span>
                  </span>
                  <span className="bar mt-1.5 block" aria-hidden>
                    <i style={{ width: `${Math.round(r.score * 100)}%` }} />
                  </span>
                  {r.reasons[0] && <span className="mt-1.5 block text-xs leading-snug text-[var(--text-3)]">{r.reasons.slice(0, 2).join(" · ")}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
