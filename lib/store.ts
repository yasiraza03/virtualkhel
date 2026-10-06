import { useSyncExternalStore } from "react";
import { GAMES, GAME_INDEX } from "@/lib/games";
import { readTaste } from "@/lib/recommendations";
import type { TasteReading } from "@/lib/recommendations";
import type { ClusterId, PlatformId, ReleaseStatus } from "@/types/game";

export type Mode = "journey" | "explore";
export type PanelTab = "filters" | "index" | "reactor";

export type CameraCommand =
  | { kind: "fly"; id: string; n: number }
  | { kind: "reset"; n: number }
  | { kind: "cluster"; id: ClusterId; n: number }
  | { kind: "zoom"; factor: number; n: number }
  | { kind: "enter"; instant: boolean; n: number };

export interface AppState {
  /** Bumps on every change so the render loop can cheaply detect "something changed". */
  version: number;
  mode: Mode;
  panel: PanelTab | null;
  selectedId: string | null;
  hoveredId: string | null;
  query: string;
  genres: ClusterId[];
  platforms: PlatformId[];
  /** null = show both released and announced titles. */
  status: ReleaseStatus | null;
  favorites: string[];
  taste: TasteReading | null;
  camera: CameraCommand | null;
  reducedMotion: boolean;
  announcement: string;
}

export const MAX_FAVORITES = 3;
const FAV_KEY = "virtualkhel:favorites";

function loadFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && GAME_INDEX.has(x)).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    /* storage can be unavailable (private mode); favourites then live for this session only */
  }
}

let state: AppState = {
  version: 0,
  mode: "journey",
  panel: "filters",
  selectedId: null,
  hoveredId: null,
  query: "",
  genres: [],
  platforms: [],
  status: null,
  favorites: [],
  taste: null,
  camera: null,
  reducedMotion: false,
  announcement: "",
};

const listeners = new Set<() => void>();
let cameraSeq = 0;

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
}

type CameraInput = CameraCommand extends infer C ? (C extends { n: number } ? Omit<C, "n"> : never) : never;
const nextCamera = (cmd: CameraInput): CameraCommand => ({ ...cmd, n: ++cameraSeq }) as CameraCommand;

let matchKey = "";
let matchCache: Set<string> | null = null;

/** Games that satisfy the current search + genre + platform filters, or null when no filter is active. */
export function getMatches(s: AppState = state): Set<string> | null {
  const q = s.query.trim();
  if (!q && s.genres.length === 0 && s.platforms.length === 0 && !s.status) return null;
  const key = `${q}|${s.genres.join(",")}|${s.platforms.join(",")}|${s.status ?? ""}`;
  if (key === matchKey && matchCache) return matchCache;
  const needle = q.toLowerCase();
  const out = new Set<string>();
  for (const g of GAMES) {
    if (s.genres.length && !g.genres.some((x) => s.genres.includes(x))) continue;
    if (s.platforms.length && !g.platforms.some((x) => s.platforms.includes(x))) continue;
    if (s.status && g.status !== s.status) continue;
    if (needle) {
      const hay = `${g.title} ${g.franchise ?? ""} ${g.developers.join(" ")}`.toLowerCase();
      if (!needle.split(/\s+/).every((t) => hay.includes(t))) continue;
    }
    out.add(g.id);
  }
  matchKey = key;
  matchCache = out;
  return out;
}

/** Hook: the active filter match set. Re-renders only when query/genre/platform change (not on hover). */
export function useMatches(): Set<string> | null {
  const query = useStore((s) => s.query);
  const genres = useStore((s) => s.genres);
  const platforms = useStore((s) => s.platforms);
  const status = useStore((s) => s.status);
  return getMatches({ query, genres, platforms, status } as AppState);
}

export const actions = {
  init() {
    const favorites = loadFavorites();
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    set({ favorites, taste: readTaste(GAMES, favorites), reducedMotion });
  },
  setMode(mode: Mode) {
    if (state.mode === mode) return;
    set({ mode, hoveredId: null, camera: mode === "explore" ? nextCamera({ kind: "enter", instant: false }) : state.camera });
  },
  enterExplore(instant = false) {
    set({
      mode: "explore",
      hoveredId: null,
      camera: nextCamera({ kind: "enter", instant: instant || state.reducedMotion }),
    });
  },
  setPanel(panel: PanelTab | null) {
    set({ panel });
  },
  hover(id: string | null) {
    if (state.hoveredId !== id) set({ hoveredId: id });
  },
  select(id: string | null, fly = true) {
    const g = id ? GAMES[GAME_INDEX.get(id) ?? -1] : undefined;
    set({
      selectedId: g ? g.id : null,
      camera: g && fly ? nextCamera({ kind: "fly", id: g.id }) : state.camera,
      announcement: g ? `${g.title}, ${g.year}. ${g.genres[0]?.replace("-", " ")} cluster.` : "Selection cleared.",
    });
  },
  setQuery(query: string) {
    set({ query });
  },
  toggleGenre(id: ClusterId) {
    const genres = state.genres.includes(id) ? state.genres.filter((g) => g !== id) : [...state.genres, id];
    set({ genres });
  },
  setGenres(genres: ClusterId[]) {
    set({ genres });
  },
  setStatus(status: ReleaseStatus | null) {
    set({ status: state.status === status ? null : status });
  },
  togglePlatform(id: PlatformId) {
    const platforms = state.platforms.includes(id) ? state.platforms.filter((p) => p !== id) : [...state.platforms, id];
    set({ platforms });
  },
  clearFilters() {
    set({ query: "", genres: [], platforms: [], status: null });
  },
  setFavorites(ids: string[]) {
    const favorites = [...new Set(ids)].filter((x) => GAME_INDEX.has(x)).slice(0, MAX_FAVORITES);
    saveFavorites(favorites);
    set({ favorites, taste: readTaste(GAMES, favorites) });
  },
  toggleFavorite(id: string) {
    if (state.favorites.includes(id)) actions.setFavorites(state.favorites.filter((x) => x !== id));
    else if (state.favorites.length < MAX_FAVORITES) actions.setFavorites([...state.favorites, id]);
    else actions.setFavorites([...state.favorites.slice(1), id]);
  },
  flyTo(id: string) {
    set({ camera: nextCamera({ kind: "fly", id }) });
  },
  focusCluster(id: ClusterId) {
    set({ camera: nextCamera({ kind: "cluster", id }) });
  },
  zoom(factor: number) {
    set({ camera: nextCamera({ kind: "zoom", factor }) });
  },
  resetCamera() {
    set({ camera: nextCamera({ kind: "reset" }), announcement: "Camera reset." });
  },
  announce(announcement: string) {
    set({ announcement });
  },
};

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Subscribe to one slice. The selector MUST return a stable value (primitive or an object held in state). */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
