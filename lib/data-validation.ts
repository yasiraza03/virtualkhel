import { CLUSTERS, PLATFORMS } from "@/lib/clusters";
import type { CuratedRelationship, Game, VocabularyEntry } from "@/types/game";

export interface ValidationIssue {
  gameId: string | null;
  message: string;
}

/**
 * Structural checks for the bundled dataset. Used by the validate-data script and in development.
 * The recommendation engine only scores fields that pass these checks.
 */
export function validateDataset(
  games: Game[],
  vocabulary: VocabularyEntry[],
  relationships: CuratedRelationship[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (gameId: string | null, message: string) => issues.push({ gameId, message });
  const ids = new Set<string>();
  const tags = new Set(vocabulary.map((v) => v.tag));
  const clusters = new Set<string>(CLUSTERS.map((c) => c.id));
  const platforms = new Set<string>(PLATFORMS.map((p) => p.id));

  for (const g of games) {
    if (ids.has(g.id)) add(g.id, "duplicate id");
    ids.add(g.id);
    if (!/^[a-z0-9-]+$/.test(g.id)) add(g.id, "id must be a lowercase slug");
    if (!g.title.trim()) add(g.id, "missing title");
    if (!Number.isInteger(g.year) || g.year < 1970 || g.year > new Date().getFullYear() + 1) {
      add(g.id, `implausible year ${g.year}`);
    }
    if (g.status !== "released" && g.status !== "upcoming") add(g.id, `unknown status ${g.status}`);
    // A released game must name a developer; an announced one may legitimately have none verified yet.
    if (g.developers.length === 0 && g.status === "released") add(g.id, "no developer");
    if (g.genres.length === 0) add(g.id, "no genres");
    for (const genre of g.genres) if (!clusters.has(genre)) add(g.id, `unknown genre ${genre}`);
    if (g.platforms.length === 0) add(g.id, "no platforms");
    for (const p of g.platforms) if (!platforms.has(p)) add(g.id, `unknown platform ${p}`);
    for (const t of g.tags) if (!tags.has(t)) add(g.id, `tag "${t}" not in vocabulary`);
    if (new Set(g.tags).size !== g.tags.length) add(g.id, "duplicate tags");
    if (g.officialUrl && !/^https:\/\//.test(g.officialUrl)) add(g.id, "officialUrl must be https");
    if (g.image && !g.image.attribution) add(g.id, "image without attribution");
  }
  for (const r of relationships) {
    if (!ids.has(r.a) || !ids.has(r.b)) add(null, `relationship references unknown game: ${r.a} -> ${r.b}`);
    if (r.a === r.b) add(null, `self relationship on ${r.a}`);
  }
  return issues;
}
