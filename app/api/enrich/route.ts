import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api-utils";
import { gameById } from "@/lib/games";

/**
 * Optional enrichment from public, credential-free sources (Wikipedia REST + Wikidata).
 * The app never depends on it: every failure resolves to `status: "unavailable"` with HTTP 200 so the
 * UI can show a calm message. Only ids from the bundled dataset are accepted, so there is no open proxy.
 */
const UA = "VIRTUALKHEL/0.1 (portfolio project; game discovery galaxy)";
const TIMEOUT_MS = 4500;
const REVALIDATE = 60 * 60 * 24;

interface WikiSummary {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const looksLikeGame = (s: WikiSummary) =>
  s.type === "standard" && /video game|game series|\bgame\b/i.test(`${s.description ?? ""} ${(s.extract ?? "").slice(0, 280)}`);

interface WikidataClaim {
  mainsnak?: { datavalue?: { value?: unknown } };
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return badRequest("Invalid id.");
  const game = gameById(id);
  if (!game) return badRequest("Unknown game id.");

  const candidates = [`${game.title} (video game)`, `${game.title} (${game.year} video game)`, game.title];
  let summary: WikiSummary | null = null;
  for (const title of candidates) {
    const s = await getJson<WikiSummary>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`,
    );
    if (s && looksLikeGame(s)) {
      summary = s;
      break;
    }
  }

  let officialUrl: string | null = null;
  let image: { url: string; fileUrl: string } | null = null;
  if (summary?.wikibase_item && /^Q\d+$/.test(summary.wikibase_item)) {
    const data = await getJson<{ entities?: Record<string, { claims?: Record<string, WikidataClaim[]> }> }>(
      `https://www.wikidata.org/wiki/Special:EntityData/${summary.wikibase_item}.json`,
    );
    const claims = data?.entities?.[summary.wikibase_item]?.claims;
    const site = claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (typeof site === "string" && /^https:\/\//.test(site)) officialUrl = site;
    const file = claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (typeof file === "string" && file.length < 200) {
      const name = encodeURIComponent(file.replace(/ /g, "_"));
      image = {
        url: `https://commons.wikimedia.org/wiki/Special:FilePath/${name}?width=640`,
        fileUrl: `https://commons.wikimedia.org/wiki/File:${name}`,
      };
    }
  }

  const body = {
    id,
    status: summary ? "ok" : "unavailable",
    summary: summary
      ? {
          title: summary.title ?? game.title,
          description: summary.description ?? null,
          extract: (summary.extract ?? "").slice(0, 900),
          pageUrl: summary.content_urls?.desktop?.page ?? null,
        }
      : null,
    officialUrl,
    image,
    attribution: summary
      ? ["Summary text from Wikipedia, available under CC BY-SA 4.0.", ...(officialUrl || image ? ["Structured data from Wikidata (CC0)."] : [])]
      : [],
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": summary ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=300" },
  });
}
