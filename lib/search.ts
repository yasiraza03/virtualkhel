import type { Game } from "@/types/game";

export function normalise(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Indexed {
  game: Game;
  title: string;
  words: string[];
  extra: string;
}

const indexCache = new WeakMap<Game[], Indexed[]>();

function indexOf(games: Game[]): Indexed[] {
  let idx = indexCache.get(games);
  if (!idx) {
    idx = games.map((game) => {
      const title = normalise(game.title);
      return {
        game,
        title,
        words: title.split(" "),
        extra: normalise([game.franchise ?? "", ...game.developers].join(" ")),
      };
    });
    indexCache.set(games, idx);
  }
  return idx;
}

/** Title-first search. Ranks exact > prefix > word-prefix > substring > franchise/developer match. */
export function searchGames(games: Game[], query: string, limit = 20): Game[] {
  const q = normalise(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const scored: { game: Game; rank: number }[] = [];
  for (const it of indexOf(games)) {
    let rank = 0;
    if (it.title === q) rank = 100;
    else if (it.title.startsWith(q)) rank = 80;
    else if (tokens.every((t) => it.words.some((w) => w.startsWith(t)))) rank = 60;
    else if (it.title.includes(q)) rank = 40;
    else if (tokens.every((t) => it.title.includes(t))) rank = 30;
    else if (tokens.every((t) => it.extra.includes(t))) rank = 10;
    if (rank) scored.push({ game: it.game, rank });
  }
  scored.sort((a, b) => b.rank - a.rank || a.game.title.length - b.game.title.length || a.game.title.localeCompare(b.game.title));
  return scored.slice(0, limit).map((s) => s.game);
}
