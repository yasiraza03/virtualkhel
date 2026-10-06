"use client";

import { useMemo } from "react";
import { CLUSTERS } from "@/lib/clusters";
import { GAMES } from "@/lib/games";
import { actions, useMatches, useStore } from "@/lib/store";

/** Accessible, keyboard-friendly alternative to the 3D view: every game, grouped by system, honouring filters. */
export function GameIndex() {
  const selectedId = useStore((s) => s.selectedId);
  const matches = useMatches();
  const groups = useMemo(
    () =>
      CLUSTERS.map((c) => ({
        cluster: c,
        games: GAMES.filter((g) => g.genres[0] === c.id && (!matches || matches.has(g.id))).sort((a, b) => a.title.localeCompare(b.title)),
      })).filter((g) => g.games.length > 0),
    [matches],
  );
  const total = groups.reduce((a, g) => a + g.games.length, 0);

  return (
    <nav aria-label="Game index" className="space-y-6">
      <p className="hud-label" role="status" aria-live="polite">
        {total} {total === 1 ? "game" : "games"} listed
      </p>
      {total === 0 && <p className="text-sm text-[var(--text-2)]">Nothing matches the current filters.</p>}
      {groups.map(({ cluster, games }) => (
        <section key={cluster.id} aria-labelledby={`idx-${cluster.id}`}>
          <h3 id={`idx-${cluster.id}`} className="hud-label mb-2 flex items-center gap-2" style={{ color: cluster.color }}>
            <span className="pip" aria-hidden /> {cluster.label} <span className="num opacity-70">{games.length}</span>
          </h3>
          <ul>
            {games.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  aria-current={selectedId === g.id ? "true" : undefined}
                  className="flex w-full items-baseline justify-between gap-3 border-l border-transparent px-2 py-1.5 text-left text-sm text-[var(--text-2)] hover:border-[var(--cyan)] hover:bg-[rgba(34,211,238,0.08)] hover:text-white aria-[current=true]:border-[var(--cyan)] aria-[current=true]:bg-[rgba(34,211,238,0.14)] aria-[current=true]:text-white"
                  onClick={() => actions.select(g.id)}
                >
                  <span className="truncate">{g.title}</span>
                  <span className="num shrink-0 text-xs text-[var(--text-3)]">
                    {g.status === "upcoming" && <span className="text-[var(--yellow)]" title="Announced, not yet verified released">◆ </span>}
                    {g.year}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
