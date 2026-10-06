"use client";

import { ExternalLink, Globe, Heart, Loader2, Locate, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABEL, CLUSTER_BY_ID, PLATFORM_LABEL } from "@/lib/clusters";
import { GAMES, GAME_INDEX, TAG_CATEGORY, tagLabel } from "@/lib/games";
import { actions, MAX_FAVORITES, useStore } from "@/lib/store";
import type { Universe } from "@/lib/universe";
import { RelatedGames } from "./RelatedGames";

interface Enrichment {
  status: "ok" | "unavailable";
  summary: { title: string; description: string | null; extract: string; pageUrl: string | null } | null;
  officialUrl: string | null;
  image: { url: string; fileUrl: string } | null;
  attribution: string[];
}

type EnrichState = { phase: "idle" } | { phase: "loading" } | { phase: "done"; data: Enrichment } | { phase: "error" };

/** Deterministic mini-constellation: the selected game and its strongest links, drawn as SVG. */
function Signature({ universe, index }: { universe: Universe | null; index: number }) {
  const nodes = useMemo(() => {
    if (!universe) return null;
    const edges = (universe.graph.adjacency[index] ?? []).map((ei) => universe.graph.edges[ei]!).sort((a, b) => b.score - a.score).slice(0, 8);
    const P = universe.layout.positions;
    const cx = P[index * 3]!;
    const cz = P[index * 3 + 2]!;
    // Angle follows the real bearing in the galaxy; distance from the centre encodes similarity (closer = more similar).
    return edges.map((e) => {
      const j = e.a === index ? e.b : e.a;
      const angle = Math.atan2(P[j * 3 + 2]! - cz, P[j * 3]! - cx);
      const r = 20 + (1 - e.score) * 52;
      return { j, e, x: 120 + Math.cos(angle) * r * 1.55, y: 60 + Math.sin(angle) * r * 0.82 };
    });
  }, [universe, index]);
  if (!nodes || !universe) return <div className="h-[120px]" aria-hidden />;
  const color = CLUSTER_BY_ID[universe.graph.games[index]!.genres[0]!].color;
  return (
    <svg viewBox="0 0 240 120" className="h-[120px] w-full" role="img" aria-label="Constellation of this game and its strongest connections">
      {nodes.map((n) => (
        <line key={n.j} x1="120" y1="60" x2={n.x} y2={n.y} stroke={n.e.kind === "similarity" ? "#F472B6" : "#22D3EE"} strokeWidth="1" strokeDasharray={n.e.kind === "similarity" ? "3 3" : undefined} opacity="0.65" />
      ))}
      {nodes.map((n) => (
        <circle key={`c${n.j}`} cx={n.x} cy={n.y} r="3.2" fill={CLUSTER_BY_ID[universe.graph.games[n.j]!.genres[0]!].color} />
      ))}
      <circle cx="120" cy="60" r="11" fill="none" stroke={color} opacity="0.35" />
      <circle cx="120" cy="60" r="6" fill={color} />
    </svg>
  );
}

export function GameDetailPanel({ universe }: { universe: Universe | null }) {
  const selectedId = useStore((s) => s.selectedId);
  const favorites = useStore((s) => s.favorites);
  const [enrich, setEnrich] = useState<EnrichState>({ phase: "idle" });

  const index = selectedId ? (GAME_INDEX.get(selectedId) ?? -1) : -1;
  const game = index >= 0 ? GAMES[index] : undefined;

  useEffect(() => setEnrich({ phase: "idle" }), [selectedId]);

  const tagsByCategory = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const t of game?.tags ?? []) {
      const cat = TAG_CATEGORY.get(t) ?? "mechanic";
      out.set(cat, [...(out.get(cat) ?? []), t]);
    }
    return [...out.entries()];
  }, [game]);

  if (!game) return null;
  const cluster = CLUSTER_BY_ID[game.genres[0]!];
  const isFav = favorites.includes(game.id);

  const loadEnrichment = async () => {
    setEnrich({ phase: "loading" });
    try {
      const res = await fetch(`/api/enrich?id=${encodeURIComponent(game.id)}`);
      if (!res.ok) throw new Error(String(res.status));
      setEnrich({ phase: "done", data: (await res.json()) as Enrichment });
    } catch {
      setEnrich({ phase: "error" });
    }
  };

  return (
    <aside id="detail-panel" className="detail hud-panel" tabIndex={-1} aria-label={`Details for ${game.title}`}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <p className="hud-label flex items-center gap-2" style={{ color: cluster.color }}>
            <span className="pip" aria-hidden /> {cluster.label}
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold leading-tight">{game.title}</h2>
          <p className="num mt-1 text-xs text-[var(--text-2)]">
            {game.year} · {game.developers.length ? game.developers.join(" / ") : "developer not verified"}
          </p>
          {game.status === "upcoming" && (
            <p className="tag-upcoming mt-2">Announced for {game.year} · not yet verified released</p>
          )}
        </div>
        <button type="button" className="btn btn-icon btn-ghost shrink-0" aria-label="Close details" onClick={() => actions.select(null, false)}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="detail-scroll space-y-6">
        <Signature universe={universe} index={index} />

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => actions.flyTo(game.id)}>
            <Locate className="size-4" aria-hidden /> Locate
          </button>
          <button type="button" className="btn" aria-pressed={isFav} onClick={() => actions.toggleFavorite(game.id)}>
            <Heart className="size-4" aria-hidden fill={isFav ? "currentColor" : "none"} /> {isFav ? "In reactor" : "Add to reactor"}
          </button>
        </div>
        {!isFav && favorites.length >= MAX_FAVORITES && (
          <p className="-mt-3 text-xs text-[var(--text-3)]">The Taste Reactor holds {MAX_FAVORITES} favourites; adding replaces the oldest.</p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="hud-label pt-1">Genres</dt>
          <dd className="flex flex-wrap gap-1.5">
            {game.genres.map((g) => (
              <span key={g} className="chip">
                <span className="pip" style={{ color: CLUSTER_BY_ID[g].color }} aria-hidden /> {CLUSTER_BY_ID[g].label}
              </span>
            ))}
          </dd>
          <dt className="hud-label pt-1">Platforms</dt>
          <dd className="text-[var(--text-2)]">{game.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</dd>
          {game.publisher && (
            <>
              <dt className="hud-label pt-1">Publisher</dt>
              <dd className="text-[var(--text-2)]">{game.publisher}</dd>
            </>
          )}
          {game.franchise && (
            <>
              <dt className="hud-label pt-1">Franchise</dt>
              <dd className="text-[var(--text-2)]">{game.franchise}</dd>
            </>
          )}
          <dt className="hud-label pt-1">Links</dt>
          <dd className="num text-xs text-[var(--text-2)]">{universe ? `${universe.graph.degree[index]} connections` : "…"}</dd>
        </dl>

        <section aria-labelledby="dna-h">
          <h3 id="dna-h" className="hud-label mb-3">
            Game DNA <span className="normal-case tracking-normal">· editorial tags</span>
          </h3>
          <div className="space-y-3">
            {tagsByCategory.map(([cat, tags]) => (
              <div key={cat}>
                <p className="mb-1.5 text-xs text-[var(--text-3)]">{CATEGORY_LABEL[cat] ?? cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="chip">
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <RelatedGames universe={universe} gameId={game.id} />

        <section aria-labelledby="pub-h" className="border-t border-[var(--line)] pt-4">
          <h3 id="pub-h" className="hud-label mb-3 flex items-center gap-2">
            <Globe className="size-3.5" aria-hidden /> Public data (optional)
          </h3>
          {enrich.phase === "idle" && (
            <>
              <p className="mb-3 text-xs text-[var(--text-3)]">
                Cover art is not bundled because publisher artwork is not freely licensed. You can fetch a public summary from Wikipedia and Wikidata on demand.
              </p>
              <button type="button" className="btn" onClick={loadEnrichment}>
                Fetch summary
              </button>
            </>
          )}
          {enrich.phase === "loading" && (
            <p className="flex items-center gap-2 text-sm text-[var(--text-2)]" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Contacting public sources…
            </p>
          )}
          {enrich.phase === "error" && (
            <p className="text-sm text-[var(--text-2)]" role="status">
              Public sources could not be reached. Everything else works offline.{" "}
              <button type="button" className="underline decoration-[var(--cyan)] underline-offset-4" onClick={loadEnrichment}>
                Try again
              </button>
            </p>
          )}
          {enrich.phase === "done" && enrich.data.status === "unavailable" && (
            <p className="text-sm text-[var(--text-2)]" role="status">
              No reliable public summary was found for this title.
            </p>
          )}
          {enrich.phase === "done" && enrich.data.summary && (
            <div className="space-y-3 text-sm">
              {enrich.data.image && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrich.data.image.url} alt={`${game.title} (Wikimedia Commons)`} loading="lazy" className="max-h-48 w-full object-cover" />
                  <figcaption className="mt-1 text-xs text-[var(--text-3)]">
                    <a href={enrich.data.image.fileUrl} target="_blank" rel="noreferrer noopener" className="underline">
                      Wikimedia Commons file page
                    </a>{" "}
                    for author and licence.
                  </figcaption>
                </figure>
              )}
              <p className="leading-relaxed text-[var(--text-2)]">{enrich.data.summary.extract}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {enrich.data.summary.pageUrl && (
                  <a className="inline-flex items-center gap-1 underline decoration-[var(--cyan)] underline-offset-4" href={enrich.data.summary.pageUrl} target="_blank" rel="noreferrer noopener">
                    Wikipedia <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
                {enrich.data.officialUrl && (
                  <a className="inline-flex items-center gap-1 underline decoration-[var(--cyan)] underline-offset-4" href={enrich.data.officialUrl} target="_blank" rel="noreferrer noopener">
                    Official site <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </p>
              <ul className="text-xs text-[var(--text-3)]">
                {enrich.data.attribution.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <p className="text-xs leading-relaxed text-[var(--text-3)]">
          <span className="hud-label">Provenance</span>
          <br />
          {game.provenance.core} {game.provenance.tags}
        </p>
      </div>
    </aside>
  );
}
