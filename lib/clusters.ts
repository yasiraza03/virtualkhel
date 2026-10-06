import type { ClusterId, PlatformId, TagCategory } from "@/types/game";

export interface ClusterMeta {
  id: ClusterId;
  label: string;
  color: string;
  blurb: string;
}

/** Order matters: neighbours on the ring are genres that share design DNA. */
export const CLUSTERS: ClusterMeta[] = [
  { id: "open-world", label: "Open-World Exploration", color: "#22D3EE", blurb: "Large persistent spaces built to be explored." },
  { id: "action", label: "Action", color: "#FB923C", blurb: "Combat and movement as the core verbs." },
  { id: "shooter", label: "Shooters", color: "#E879F9", blurb: "Ranged combat in first or third person." },
  { id: "stealth", label: "Stealth", color: "#818CF8", blurb: "Avoidance, patience and infiltration." },
  { id: "horror", label: "Horror", color: "#EF4444", blurb: "Fear, vulnerability and dread." },
  { id: "survival", label: "Survival", color: "#34D399", blurb: "Scarcity, crafting and endurance." },
  { id: "simulation", label: "Simulation", color: "#60A5FA", blurb: "Systems modelled for play." },
  { id: "strategy", label: "Strategy", color: "#FDE047", blurb: "Planning, tactics and empire management." },
  { id: "racing", label: "Racing", color: "#5EEAD4", blurb: "Speed, vehicles and competition." },
  { id: "platformer", label: "Platformers", color: "#A3E635", blurb: "Precision movement and level design." },
  { id: "puzzle", label: "Puzzle", color: "#F5F0FF", blurb: "Logic, observation and deduction." },
  { id: "narrative", label: "Narrative Adventures", color: "#F472B6", blurb: "Story and choice as the main event." },
  { id: "rpg", label: "RPGs", color: "#A855F7", blurb: "Character growth, worlds and decisions." },
];

export const CLUSTER_BY_ID = Object.fromEntries(CLUSTERS.map((c) => [c.id, c])) as Record<ClusterId, ClusterMeta>;

export const PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: "pc", label: "PC" },
  { id: "playstation", label: "PlayStation" },
  { id: "xbox", label: "Xbox" },
  { id: "nintendo", label: "Nintendo" },
  { id: "mobile", label: "Mobile" },
];
export const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label])) as Record<PlatformId, string>;

export const CATEGORY_LABEL: Record<string, string> = {
  genre: "Genre",
  mechanic: "Mechanics",
  combat: "Combat",
  setting: "Setting",
  narrative: "Narrative",
  perspective: "Perspective",
  mode: "Play mode",
  aesthetic: "Aesthetic",
  platform: "Platforms",
  developer: "Developer",
  publisher: "Publisher",
  franchise: "Franchise",
  era: "Release era",
};

export type CategoryKey = TagCategory | "genre" | "platform" | "developer" | "publisher" | "franchise" | "era";
