import { NextResponse } from "next/server";
import { badRequest, CACHE_STATIC, intParam, publicGame } from "@/lib/api-utils";
import { CLUSTERS, PLATFORMS } from "@/lib/clusters";
import { GAMES } from "@/lib/games";
import { normalise } from "@/lib/search";

const GENRES = new Set<string>(CLUSTERS.map((c) => c.id));
const PLATFORM_IDS = new Set<string>(PLATFORMS.map((p) => p.id));

/** GET /api/games?genre=rpg&platform=pc&q=souls&limit=50&offset=0 — bundled dataset, no upstream calls. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const genre = params.get("genre");
  const platform = params.get("platform");
  const q = normalise((params.get("q") ?? "").slice(0, 80));
  if (genre && !GENRES.has(genre)) return badRequest(`Unknown genre "${genre}". Valid: ${[...GENRES].join(", ")}`);
  if (platform && !PLATFORM_IDS.has(platform)) return badRequest(`Unknown platform "${platform}". Valid: ${[...PLATFORM_IDS].join(", ")}`);
  const limit = intParam(params.get("limit"), 50, 1, 100);
  const offset = intParam(params.get("offset"), 0, 0, GAMES.length);

  const filtered = GAMES.filter(
    (g) =>
      (!genre || g.genres.includes(genre as never)) &&
      (!platform || g.platforms.includes(platform as never)) &&
      (!q || normalise(`${g.title} ${g.franchise ?? ""} ${g.developers.join(" ")}`).includes(q)),
  );
  return NextResponse.json(
    { total: filtered.length, limit, offset, items: filtered.slice(offset, offset + limit).map(publicGame) },
    { headers: { "Cache-Control": CACHE_STATIC } },
  );
}
