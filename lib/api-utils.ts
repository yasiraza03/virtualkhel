import { NextResponse } from "next/server";
import type { Game } from "@/types/game";

export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

/** Public, normalised shape returned by the bundled-data endpoints. */
export function publicGame(g: Game) {
  return {
    id: g.id,
    title: g.title,
    year: g.year,
    developers: g.developers,
    publisher: g.publisher,
    genres: g.genres,
    platforms: g.platforms,
    tags: g.tags,
    franchise: g.franchise,
    officialUrl: g.officialUrl,
  };
}

export const CACHE_STATIC = "public, s-maxage=3600, stale-while-revalidate=86400";
