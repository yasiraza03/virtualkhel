export type ClusterId =
  | "open-world" | "narrative" | "rpg" | "stealth" | "horror" | "survival" | "action"
  | "strategy" | "racing" | "simulation" | "platformer" | "shooter" | "puzzle";

export type PlatformId = "pc" | "playstation" | "xbox" | "nintendo" | "mobile";

export type TagCategory =
  | "mechanic" | "combat" | "setting" | "narrative" | "perspective" | "mode" | "aesthetic";

export interface GameImage {
  url: string;
  attribution: string;
  licenseUrl?: string;
  sourceUrl: string;
}

/** "upcoming" = announced for `year` but not confirmed released when the dataset was curated. */
export type ReleaseStatus = "released" | "upcoming";

export interface Game {
  id: string;
  title: string;
  year: number;
  status: ReleaseStatus;
  developers: string[];
  publisher: string | null;
  /** Primary genre first, then secondary genres. The primary genre decides the node's cluster. */
  genres: ClusterId[];
  platforms: PlatformId[];
  tags: string[];
  franchise: string | null;
  officialUrl: string | null;
  image: GameImage | null;
  provenance: { core: string; tags: string };
}

export interface VocabularyEntry {
  tag: string;
  category: TagCategory;
  label: string;
}

export type CuratedRelationType =
  | "spiritual-successor" | "design-lineage" | "shared-universe";

export interface CuratedRelationship {
  a: string;
  b: string;
  type: CuratedRelationType;
  note: string;
  source: "curated";
}

/** Verified edges come from dataset facts; inferred edges come from the Game DNA similarity score. */
export type EdgeKind = "franchise" | "developer" | "curated" | "similarity";

export interface GraphEdge {
  a: number;
  b: number;
  kind: EdgeKind;
  /** Game DNA similarity (0..1) between the endpoints. */
  score: number;
  note?: string;
}

export interface ScoreComponent {
  key: string;
  label: string;
  /** 0..1 raw match inside the component. */
  score: number;
  /** Normalised weight actually applied (components with no data are excluded). */
  weight: number;
  /** score * weight: contribution to the final similarity. */
  contribution: number;
  /** Human readable shared attributes behind the score. */
  shared: string[];
}

export interface SimilarityResult {
  score: number;
  components: ScoreComponent[];
}

export interface Recommendation {
  id: string;
  index: number;
  score: number;
  components: ScoreComponent[];
  reasons: string[];
}
