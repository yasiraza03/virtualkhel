import { NextResponse } from "next/server";
import { badRequest, CACHE_STATIC, intParam, publicGame } from "@/lib/api-utils";
import { GAMES } from "@/lib/games";
import { searchGames } from "@/lib/search";

/** GET /api/search?q=hollow&limit=10 — ranked title search over the bundled dataset. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 1) return badRequest("Query parameter q is required.");
  if (q.length > 80) return badRequest("Query parameter q must be at most 80 characters.");
  const limit = intParam(params.get("limit"), 10, 1, 25);
  const items = searchGames(GAMES, q, limit).map(publicGame);
  return NextResponse.json({ query: q, count: items.length, items }, { headers: { "Cache-Control": CACHE_STATIC } });
}
