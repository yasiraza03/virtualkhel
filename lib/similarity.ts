/**
 * GAME DNA - deterministic similarity.
 *
 * Every game is projected onto weighted feature sets, one per category. A "taste profile" is the average of
 * the feature sets of one or more games (a single game is simply a profile of one). Candidates are scored
 * against a profile with ONE formula, so pairwise similarity and the Taste Reactor can never disagree.
 *
 *  - set categories   : weighted Jaccard  sum(min(p, x)) / sum(max(p, x))
 *                       (p = profile weight, x = candidate weight)
 *  - identity (bonus) : developer / publisher / franchise. Counted only when the candidate matches the
 *                       profile; a missing or different value is "no data", never a penalty.
 *  - era              : linear decay over ERA_SPAN years from the mean release year of the profile.
 *
 * Missing data policy - only fields supported by the dataset are scored:
 *  - Required categories (genre, mechanics, setting, era) always count.
 *  - Optional categories (combat, narrative, perspective, mode, aesthetic, platform) count only when BOTH the
 *    profile and the candidate carry at least one feature there, so an absent tag is never read as a match
 *    or a mismatch.
 * The final score is sum(weight * score) / sum(weight of counted categories), in 0..1.
 */
import { CATEGORY_LABEL, PLATFORM_LABEL } from "@/lib/clusters";
import { TAG_CATEGORY, tagLabel } from "@/lib/games";
import type { CategoryKey } from "@/lib/clusters";
import type { Game, PlatformId, ScoreComponent, SimilarityResult } from "@/types/game";

export const ERA_SPAN = 20;
export const PRIMARY_GENRE_WEIGHT = 2;
export const SECONDARY_GENRE_WEIGHT = 1;

type Kind = "set" | "identity" | "era";
interface CategorySpec {
  key: CategoryKey;
  kind: Kind;
  weight: number;
  required: boolean;
}

export const CATEGORY_SPECS: CategorySpec[] = [
  { key: "genre", kind: "set", weight: 0.22, required: true },
  { key: "mechanic", kind: "set", weight: 0.17, required: true },
  { key: "setting", kind: "set", weight: 0.1, required: true },
  { key: "narrative", kind: "set", weight: 0.1, required: false },
  { key: "combat", kind: "set", weight: 0.08, required: false },
  { key: "perspective", kind: "set", weight: 0.05, required: false },
  { key: "aesthetic", kind: "set", weight: 0.04, required: false },
  { key: "mode", kind: "set", weight: 0.03, required: false },
  { key: "platform", kind: "set", weight: 0.04, required: false },
  { key: "era", kind: "era", weight: 0.07, required: true },
  { key: "franchise", kind: "identity", weight: 0.07, required: false },
  { key: "developer", kind: "identity", weight: 0.05, required: false },
  { key: "publisher", kind: "identity", weight: 0.02, required: false },
];

export type FeatureSets = Partial<Record<CategoryKey, Map<string, number>>>;

export interface Profile {
  /** Number of games averaged into this profile. */
  count: number;
  sets: FeatureSets;
  meanYear: number;
}

const featureCache = new Map<string, FeatureSets>();

function labelFor(category: CategoryKey, feature: string): string {
  switch (category) {
    case "platform":
      return PLATFORM_LABEL[feature as PlatformId] ?? feature;
    case "genre":
      return feature.replace(/-/g, " ");
    case "developer":
    case "publisher":
    case "franchise":
      return feature;
    default:
      return tagLabel(feature);
  }
}

/** Project a game onto its per-category weighted feature sets (cached). */
export function featuresOf(game: Game): FeatureSets {
  const cached = featureCache.get(game.id);
  if (cached) return cached;
  const sets: FeatureSets = {};
  const put = (cat: CategoryKey, feature: string, w = 1) => {
    let m = sets[cat];
    if (!m) sets[cat] = m = new Map();
    m.set(feature, Math.max(m.get(feature) ?? 0, w));
  };
  game.genres.forEach((g, i) => put("genre", g, i === 0 ? PRIMARY_GENRE_WEIGHT : SECONDARY_GENRE_WEIGHT));
  for (const t of game.tags) {
    const cat = TAG_CATEGORY.get(t);
    if (cat) put(cat, t);
  }
  for (const p of game.platforms) put("platform", p);
  for (const d of game.developers) put("developer", d);
  if (game.publisher) put("publisher", game.publisher);
  if (game.franchise) put("franchise", game.franchise);
  featureCache.set(game.id, sets);
  return sets;
}

export function buildProfile(games: Game[]): Profile {
  const n = games.length;
  const sets: FeatureSets = {};
  for (const g of games) {
    const f = featuresOf(g);
    for (const [cat, m] of Object.entries(f) as [CategoryKey, Map<string, number>][]) {
      let acc = sets[cat];
      if (!acc) sets[cat] = acc = new Map();
      for (const [feature, w] of m) acc.set(feature, (acc.get(feature) ?? 0) + w / n);
    }
  }
  const meanYear = n ? games.reduce((a, g) => a + g.year, 0) / n : 0;
  return { count: n, sets, meanYear };
}

const profileCache = new Map<string, Profile>();
export function profileOfGame(game: Game): Profile {
  let p = profileCache.get(game.id);
  if (!p) profileCache.set(game.id, (p = buildProfile([game])));
  return p;
}

/** Score one candidate against a profile. Excluding the profile's own games is the caller's job. */
export function scoreAgainstProfile(profile: Profile, candidate: Game): SimilarityResult {
  const cand = featuresOf(candidate);
  const raw: Omit<ScoreComponent, "weight" | "contribution">[] = [];
  const weights: number[] = [];

  for (const spec of CATEGORY_SPECS) {
    const p = profile.sets[spec.key];
    const x = cand[spec.key];

    if (spec.kind === "era") {
      if (!profile.count) continue;
      const diff = Math.abs(candidate.year - profile.meanYear);
      const s = Math.max(0, 1 - diff / ERA_SPAN);
      raw.push({
        key: spec.key,
        label: CATEGORY_LABEL.era ?? "Release era",
        score: s,
        shared: s > 0.5 ? [`within ${Math.max(1, Math.round(diff))} yr of ${Math.round(profile.meanYear)}`] : [],
      });
      weights.push(spec.weight);
      continue;
    }

    if (spec.kind === "identity") {
      if (!p || !x) continue;
      let s = 0;
      const matched: string[] = [];
      for (const [feature] of x) {
        const pw = p.get(feature);
        if (pw) {
          s = Math.max(s, Math.min(1, pw));
          matched.push(labelFor(spec.key, feature));
        }
      }
      if (s <= 0) continue;
      raw.push({ key: spec.key, label: CATEGORY_LABEL[spec.key] ?? spec.key, score: s, shared: matched });
      weights.push(spec.weight);
      continue;
    }

    if (!spec.required && (!p || !x || p.size === 0 || x.size === 0)) continue;
    let minSum = 0;
    let maxSum = 0;
    const shared: { feature: string; w: number }[] = [];
    if (p) {
      for (const [feature, pw] of p) {
        const xw = x?.get(feature) ?? 0;
        minSum += Math.min(pw, xw);
        maxSum += Math.max(pw, xw);
        if (xw > 0) shared.push({ feature, w: Math.min(pw, xw) });
      }
    }
    if (x) for (const [feature, xw] of x) if (!p?.has(feature)) maxSum += xw;
    shared.sort((a, b) => b.w - a.w || a.feature.localeCompare(b.feature));
    raw.push({
      key: spec.key,
      label: CATEGORY_LABEL[spec.key] ?? spec.key,
      score: maxSum > 0 ? minSum / maxSum : 0,
      shared: shared.slice(0, 6).map((f) => {
        const label = labelFor(spec.key, f.feature);
        if (profile.count <= 1) return label;
        // how many of the favourites carry this feature (weights are per-game averages)
        const n = Math.round((p?.get(f.feature) ?? 0) * profile.count);
        return n >= 1 && n <= profile.count && spec.key !== "genre" ? `${label} ${n}/${profile.count}` : label;
      }),
    });
    weights.push(spec.weight);
  }

  const total = weights.reduce((a, b) => a + b, 0);
  const components: ScoreComponent[] = raw.map((r, i) => {
    const weight = total ? (weights[i] ?? 0) / total : 0;
    return { ...r, weight, contribution: r.score * weight };
  });
  return { score: components.reduce((a, c) => a + c.contribution, 0), components };
}

export function similarity(a: Game, b: Game): SimilarityResult {
  return scoreAgainstProfile(profileOfGame(a), b);
}

export interface Alignment {
  key: CategoryKey;
  label: string;
  /** 0..1, the fraction of feature occurrences the favourites share. */
  alignment: number;
}

/** Per-category agreement among favourites; drives the Taste Reactor dials. */
export function categoryAlignment(games: Game[]): Alignment[] {
  const n = games.length;
  const out: Alignment[] = [];
  for (const spec of CATEGORY_SPECS) {
    const label = CATEGORY_LABEL[spec.key] ?? spec.key;
    if (spec.key === "era") {
      const ys = games.map((g) => g.year);
      const spread = n ? Math.max(...ys) - Math.min(...ys) : 0;
      out.push({ key: spec.key, label, alignment: n > 1 ? Math.max(0, 1 - spread / (ERA_SPAN * 1.5)) : 0 });
      continue;
    }
    const counts = new Map<string, number>();
    for (const g of games) for (const f of featuresOf(g)[spec.key]?.keys() ?? []) counts.set(f, (counts.get(f) ?? 0) + 1);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const shared = [...counts.values()].reduce((a, c) => a + Math.max(0, c - 1), 0);
    out.push({ key: spec.key, label, alignment: n > 1 && total > 0 ? shared / ((n - 1) * total) : 0 });
  }
  return out;
}
