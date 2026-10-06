import { GAME_INDEX } from "@/lib/games";
import { shortestPath } from "@/lib/graph";
import type { GameGraph, GraphPath } from "@/lib/graph";
import type { ClusterId } from "@/types/game";

/** The cluster the camera approaches in scene 4 (LOCK ON). */
export const JOURNEY_CLUSTER: ClusterId = "rpg";

/** Start and end of the relationship path revealed in scene 5 (CONNECT). */
export const JOURNEY_PATH_ENDS: [string, string] = ["dark-souls", "hollow-knight"];

let cachedPath: { graph: GameGraph; path: GraphPath | null } | null = null;

/** Dijkstra over the real graph. Cached per graph instance. */
export function journeyPath(graph: GameGraph): GraphPath | null {
  if (cachedPath?.graph === graph) return cachedPath.path;
  const a = GAME_INDEX.get(JOURNEY_PATH_ENDS[0]);
  const b = GAME_INDEX.get(JOURNEY_PATH_ENDS[1]);
  const path = a !== undefined && b !== undefined ? shortestPath(graph, a, b) : null;
  cachedPath = { graph, path };
  return path;
}
