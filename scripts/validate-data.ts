import games from "../data/games.json";
import vocabulary from "../data/vocabulary.json";
import relationships from "../data/relationships.json";
import { validateDataset } from "../lib/data-validation";
import type { CuratedRelationship, Game, VocabularyEntry } from "../types/game";

const issues = validateDataset(
  games as unknown as Game[],
  vocabulary as unknown as VocabularyEntry[],
  relationships as unknown as CuratedRelationship[],
);
if (issues.length) {
  for (const i of issues) console.error(`FAIL ${i.gameId ?? "dataset"}: ${i.message}`);
  process.exit(1);
}
console.log(`OK ${games.length} games, ${vocabulary.length} vocabulary tags, ${relationships.length} relationships valid`);
