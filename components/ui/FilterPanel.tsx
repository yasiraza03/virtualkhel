"use client";

import { FilterX } from "lucide-react";
import { useMemo } from "react";
import { CLUSTERS, PLATFORMS } from "@/lib/clusters";
import { GAMES, RELATIONSHIPS, VOCABULARY } from "@/lib/games";
import { actions, useMatches, useStore } from "@/lib/store";
import type { Universe } from "@/lib/universe";

export function FilterPanel({ universe }: { universe: Universe | null }) {
  const genres = useStore((s) => s.genres);
  const platforms = useStore((s) => s.platforms);
  const query = useStore((s) => s.query);
  const status = useStore((s) => s.status);
  const matches = useMatches();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of GAMES) m.set(g.genres[0]!, (m.get(g.genres[0]!) ?? 0) + 1);
    return m;
  }, []);
  const platformCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of GAMES) for (const p of g.platforms) m.set(p, (m.get(p) ?? 0) + 1);
    return m;
  }, []);
  const statusCounts = useMemo(
    () => ({
      released: GAMES.filter((g) => g.status === "released").length,
      upcoming: GAMES.filter((g) => g.status === "upcoming").length,
    }),
    [],
  );
  const active = genres.length + platforms.length + (query ? 1 : 0) + (status ? 1 : 0);
  const verified = universe?.graph.edges.filter((e) => e.kind !== "similarity").length;
  const inferred = universe ? universe.graph.edges.length - (verified ?? 0) : undefined;

  return (
    <div className="space-y-7">
      <section aria-labelledby="f-genre">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="f-genre" className="hud-label">
            Systems <span className="normal-case tracking-normal">· primary genre</span>
          </h3>
          <span className="num text-xs text-[var(--text-2)]" role="status" aria-live="polite">
            {matches ? `${matches.size} of ${GAMES.length}` : `${GAMES.length} games`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CLUSTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={genres.includes(c.id)}
              title={c.blurb}
              onClick={() => actions.toggleGenre(c.id)}
            >
              <span className="pip" style={{ color: c.color }} aria-hidden />
              {c.label.replace("Open-World Exploration", "Open World").replace("Narrative Adventures", "Narrative")}
              <span className="num opacity-60">{counts.get(c.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="f-status">
        <h3 id="f-status" className="hud-label mb-3">
          Release
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={status === "released"} onClick={() => actions.setStatus("released")}>
            Released <span className="num opacity-60">{statusCounts.released}</span>
          </button>
          <button type="button" className="chip" aria-pressed={status === "upcoming"} onClick={() => actions.setStatus("upcoming")}>
            Announced <span className="num opacity-60">{statusCounts.upcoming}</span>
          </button>
        </div>
      </section>

      <section aria-labelledby="f-plat">
        <h3 id="f-plat" className="hud-label mb-3">
          Platform families
        </h3>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={platforms.includes(p.id)} onClick={() => actions.togglePlatform(p.id)}>
              {p.label}
              <span className="num opacity-60">{platformCounts.get(p.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="btn w-full justify-center" disabled={active === 0} onClick={actions.clearFilters}>
        <FilterX className="size-4" aria-hidden /> Clear filters
      </button>

      <section aria-labelledby="f-legend" className="space-y-3 border-t border-[var(--line)] pt-5 text-sm text-[var(--text-2)]">
        <h3 id="f-legend" className="hud-label">
          How to read the galaxy
        </h3>
        <ul className="space-y-2.5">
          <li>
            <strong className="font-medium text-white">Colour</strong> — primary genre district.
          </li>
          <li>
            <strong className="font-medium text-white">Tower height</strong> — connection count: <span className="num">3 + 1.5·links</span>.
          </li>
          <li>
            <strong className="font-medium text-white">Position</strong> — deterministic: district ring + hashed seed, relaxed by similarity.
          </li>
          <li className="flex items-center gap-2">
            <span className="legend-line" aria-hidden /> Verified: shared franchise, developer, or curated relation
            {verified !== undefined && <span className="num text-[var(--text-3)]">({verified})</span>}
          </li>
          <li className="flex items-center gap-2">
            <span className="legend-line dashed" aria-hidden /> Inferred: top-3 Game DNA similarity (≥ 0.42)
            {inferred !== undefined && <span className="num text-[var(--text-3)]">({inferred})</span>}
          </li>
        </ul>
      </section>

      <details className="border-t border-[var(--line)] pt-4 text-sm text-[var(--text-2)]">
        <summary className="hud-label cursor-pointer">About this data</summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            {GAMES.length} hand-curated games. Release year, developers, publisher and platform families are public release facts. Tags come from a fixed {VOCABULARY.length}-term vocabulary applied editorially — no
            numeric “scores” are invented.
          </p>
          <p>{RELATIONSHIPS.length} curated relationships are cited individually. Everything else is derived from shared metadata.</p>
          <p>Cover art is not bundled; optional public summaries load from Wikipedia and Wikidata on request.</p>
        </div>
      </details>
    </div>
  );
}
