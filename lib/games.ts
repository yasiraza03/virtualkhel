import gamesJson from "@/data/games.json";
import relationshipsJson from "@/data/relationships.json";
import vocabularyJson from "@/data/vocabulary.json";
import type { CuratedRelationship, Game, TagCategory, VocabularyEntry } from "@/types/game";

export const GAMES = gamesJson as unknown as Game[];
export const RELATIONSHIPS = relationshipsJson as unknown as CuratedRelationship[];
export const VOCABULARY = vocabularyJson as unknown as VocabularyEntry[];

export const GAME_INDEX = new Map(GAMES.map((g, i) => [g.id, i]));
export const TAG_CATEGORY = new Map<string, TagCategory>(VOCABULARY.map((v) => [v.tag, v.category]));

export function gameById(id: string): Game | undefined {
  const i = GAME_INDEX.get(id);
  return i === undefined ? undefined : GAMES[i];
}

export function tagLabel(tag: string): string {
  return tag.replace(/-/g, " ");
}
