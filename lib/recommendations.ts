import { CATEGORY_LABEL } from "@/lib/clusters";
import { categoryAlignment, buildProfile, scoreAgainstProfile, profileOfGame } from "@/lib/similarity";
import type { Alignment, Profile } from "@/lib/similarity";
import { GAME_INDEX } from "@/lib/games";
import type { ClusterId, Game, Recommendation, ScoreComponent } from "@/types/game";

/** Turn the strongest score components into short, human-readable reasons. */
export function explain(components: ScoreComponent[], limit = 3): string[] {
  return [...components]
    .filter((c) => c.shared.length > 0 && c.score > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit)
    .map((c) => {
      const items = c.shared.slice(0, 4).join(", ");
      switch (c.key) {
        case "franchise":
          return `Same franchise: ${items}`;
        case "developer":
          return `Same developer: ${items}`;
        case "publisher":
          return `Same publisher: ${items}`;
        case "era":
          return `Release era: ${items}`;
        case "platform":
          return `Shared platforms: ${items}`;
        default:
          return `${CATEGORY_LABEL[c.key] ?? c.label}: ${items}`;
      }
    });
}

export function rankAgainstProfile(
  games: Game[],
  profile: Profile,
  excludeIds: ReadonlySet<string>,
  limit: number,
): Recommendation[] {
  const out: Recommendation[] = [];
  games.forEach((g, index) => {
    if (excludeIds.has(g.id)) return;
    const { score, components } = scoreAgainstProfile(profile, g);
    out.push({ id: g.id, index, score, components, reasons: explain(components) });
  });
  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return out.slice(0, limit);
}

export function recommendSimilarTo(games: Game[], id: string, limit = 8): Recommendation[] {
  const i = GAME_INDEX.get(id);
  const g = i === undefined ? undefined : games[i];
  if (!g) return [];
  return rankAgainstProfile(games, profileOfGame(g), new Set([id]), limit);
}

export interface TasteReading {
  profile: Profile;
  alignment: Alignment[];
  /** Mean pairwise agreement of the favourites on the weighted categories (0..1). */
  coherence: number;
  /** Features present in at least two of the favourites, strongest first. */
  dominant: { category: string; label: string; weight: number }[];
  recommendations: Recommendation[];
  /** Number of top recommendations per primary-genre cluster. */
  clusterCounts: Partial<Record<ClusterId, number>>;
}

export function readTaste(games: Game[], favoriteIds: string[], limit = 12): TasteReading | null {
  const favorites = favoriteIds.map((id) => games[GAME_INDEX.get(id) ?? -1]).filter((g): g is Game => !!g);
  if (favorites.length === 0) return null;
  const profile = buildProfile(favorites);
  const alignment = categoryAlignment(favorites);
  const used = alignment.filter((a) => a.key !== "developer" && a.key !== "publisher" && a.key !== "platform");
  const coherence = favorites.length > 1 ? used.reduce((a, b) => a + b.alignment, 0) / Math.max(1, used.length) : 0;

  const dominant: TasteReading["dominant"] = [];
  const need = favorites.length > 1 ? 2 / favorites.length - 1e-6 : 0;
  for (const [cat, map] of Object.entries(profile.sets)) {
    if (cat === "platform" || cat === "publisher" || cat === "developer") continue;
    for (const [feature, w] of map ?? []) {
      const share = cat === "genre" ? w / 2 : w;
      if (share >= need) dominant.push({ category: cat, label: feature.replace(/-/g, " "), weight: share });
    }
  }
  dominant.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));

  const recommendations = rankAgainstProfile(games, profile, new Set(favoriteIds), limit);
  const clusterCounts: TasteReading["clusterCounts"] = {};
  for (const r of recommendations) {
    const c = games[r.index]?.genres[0];
    if (c) clusterCounts[c] = (clusterCounts[c] ?? 0) + 1;
  }
  return { profile, alignment, coherence, dominant: dominant.slice(0, 14), recommendations, clusterCounts };
}
