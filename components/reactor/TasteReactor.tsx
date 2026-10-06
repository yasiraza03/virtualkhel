"use client";

import { Atom, Crosshair, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { GameSearch } from "@/components/game/GameSearch";
import { CLUSTER_BY_ID, CLUSTERS } from "@/lib/clusters";
import { GAMES, GAME_INDEX } from "@/lib/games";
import { actions, MAX_FAVORITES, store, useStore } from "@/lib/store";
import { TasteProfile } from "./TasteProfile";

const PRESETS: { label: string; ids: string[] }[] = [
  { label: "Story & choice", ids: ["the-witcher-3-wild-hunt", "disco-elysium", "baldurs-gate-3"] },
  { label: "Cozy & crafty", ids: ["stardew-valley", "animal-crossing-new-horizons", "terraria"] },
  { label: "Dark & demanding", ids: ["dark-souls", "hollow-knight", "bloodborne"] },
  { label: "Pure speed", ids: ["forza-horizon-5", "mario-kart-8-deluxe", "burnout-paradise"] },
].map((p) => ({ ...p, ids: p.ids.filter((id) => GAME_INDEX.has(id)) }));

interface Props {
  variant: "inline" | "dock";
}

export function TasteReactor({ variant }: Props) {
  const favorites = useStore((s) => s.favorites);
  const taste = useStore((s) => s.taste);
  const [picking, setPicking] = useState<number | null>(null);
  const limit = variant === "inline" ? 5 : 12;

  const setSlot = (slot: number, id: string | null) => {
    const next = [...favorites];
    if (id === null) next.splice(slot, 1);
    else if (slot >= next.length) next.push(id);
    else next[slot] = id;
    actions.setFavorites(next);
    setPicking(null);
  };

  const locate = (id: string) => {
    if (store.get().mode === "journey") actions.enterExplore();
    actions.select(id);
  };

  const recs = taste?.recommendations.slice(0, limit) ?? [];
  const ready = favorites.length === MAX_FAVORITES;

  return (
    <section aria-labelledby={`reactor-${variant}`} className={variant === "dock" ? "space-y-6 p-4" : "space-y-6"}>
      <header>
        <p className="hud-label mb-2 flex items-center gap-2">
          <Atom className="size-3.5 text-[var(--magenta)]" aria-hidden /> Taste Reactor
        </p>
        <h2 id={`reactor-${variant}`} className="font-display text-2xl font-bold leading-tight">
          Tune the galaxy to your taste
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Pick three favourites. Their shared features become a weighted profile, every other game is scored against it, and the matches light up.
        </p>
      </header>

      <ol className="space-y-2" aria-label="Favourite games">
        {Array.from({ length: MAX_FAVORITES }, (_, slot) => {
          const id = favorites[slot];
          const g = id ? GAMES[GAME_INDEX.get(id) ?? -1] : undefined;
          const canPick = slot <= favorites.length;
          return (
            <li key={slot}>
              {picking === slot ? (
                <GameSearch mode="pick" autoFocus excludeIds={favorites} label={`Choose favourite ${slot + 1}`} placeholder={`Favourite ${slot + 1}…`} onPick={(game) => setSlot(slot, game.id)} onClose={() => setPicking(null)} />
              ) : g ? (
                <div className="slot" data-filled="true">
                  <span className="num w-4 text-xs text-[var(--text-3)]">{slot + 1}</span>
                  <span className="pip" style={{ color: CLUSTER_BY_ID[g.genres[0]!].color }} aria-hidden />
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-[var(--cyan)]" onClick={() => locate(g.id)}>
                    {g.title}
                  </button>
                  <span className="num text-xs text-[var(--text-3)]">{g.year}</span>
                  <button type="button" aria-label={`Remove ${g.title}`} className="p-1 text-[var(--text-3)] hover:text-white" onClick={() => setSlot(slot, null)}>
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <button type="button" className="slot text-[var(--text-3)] hover:text-white" disabled={!canPick} onClick={() => setPicking(slot)}>
                  <span className="num w-4 text-xs">{slot + 1}</span>
                  <Plus className="size-4" aria-hidden /> <span className="text-sm">Add favourite</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div>
        <p className="hud-label mb-2">Example trios</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" onClick={() => actions.setFavorites(p.ids)}>
              {p.label}
            </button>
          ))}
          {favorites.length > 0 && (
            <button type="button" className="chip" onClick={() => actions.setFavorites([])}>
              <RotateCcw className="size-3" aria-hidden /> Clear
            </button>
          )}
        </div>
      </div>

      <TasteProfile taste={taste} favorites={favorites} />

      {taste && taste.dominant.length > 0 && favorites.length > 1 && (
        <div>
          <p className="hud-label mb-2">Shared by at least two favourites</p>
          <ul className="flex flex-wrap gap-1.5">
            {taste.dominant.slice(0, variant === "inline" ? 8 : 14).map((d) => (
              <li key={`${d.category}-${d.label}`} className="chip">
                {d.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div aria-live="polite">
        {!taste && <p className="text-sm text-[var(--text-3)]">Add a favourite to see ranked matches. {ready ? "" : `${MAX_FAVORITES - favorites.length} to go for the full profile.`}</p>}
        {taste && (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="hud-label">Top matches</p>
              {!ready && <p className="text-xs text-[var(--text-3)]">{favorites.length}/{MAX_FAVORITES} favourites</p>}
            </div>
            <ol className="space-y-4">
              {recs.map((r, rank) => {
                const g = GAMES[r.index]!;
                return (
                  <li key={r.id}>
                    <div className="flex items-start gap-3">
                      <span className="num w-5 pt-0.5 text-xs text-[var(--text-3)]">{String(rank + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex min-w-0 items-center gap-2">
                            <span className="pip" style={{ color: CLUSTER_BY_ID[g.genres[0]!].color }} aria-hidden />
                            <span className="truncate text-sm font-semibold">{g.title}</span>
                            <span className="num text-xs text-[var(--text-3)]">{g.year}</span>
                          </p>
                          <button type="button" className="btn btn-icon btn-ghost" aria-label={`Locate ${g.title} in the galaxy`} onClick={() => locate(g.id)}>
                            <Crosshair className="size-4" aria-hidden />
                          </button>
                        </div>
                        <div className="bar my-1.5" role="meter" aria-label={`Match for ${g.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.score * 100)}>
                          <i style={{ width: `${Math.round(r.score * 100)}%` }} />
                        </div>
                        <ul className="space-y-0.5 text-xs leading-snug text-[var(--text-2)]">
                          {r.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      <span className="num pt-0.5 text-sm text-[var(--cyan)]">{Math.round(r.score * 100)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
            {variant === "dock" && <ClusterSummary />}
          </>
        )}
      </div>
    </section>
  );
}

function ClusterSummary() {
  const taste = useStore((s) => s.taste);
  if (!taste) return null;
  const rows = CLUSTERS.map((c) => ({ c, n: taste.clusterCounts[c.id] ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  if (!rows.length) return null;
  const max = rows[0]!.n;
  return (
    <div className="mt-6 border-t border-[var(--line)] pt-4">
      <p className="hud-label mb-3">Matching systems in the top {taste.recommendations.length}</p>
      <ul className="space-y-2">
        {rows.map(({ c, n }) => (
          <li key={c.id} className="flex items-center gap-3 text-xs">
            <span className="w-28 truncate text-[var(--text-2)]">{c.label}</span>
            <span className="bar flex-1">
              <i style={{ width: `${(n / max) * 100}%`, background: c.color }} />
            </span>
            <span className="num w-4 text-right">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
