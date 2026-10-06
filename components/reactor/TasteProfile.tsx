"use client";

import { useMemo } from "react";
import { CLUSTER_BY_ID } from "@/lib/clusters";
import { GAMES, GAME_INDEX } from "@/lib/games";
import type { TasteReading } from "@/lib/recommendations";

const AXES = ["genre", "mechanic", "setting", "narrative", "combat", "perspective", "aesthetic", "mode", "era"] as const;
const AXIS_SHORT: Record<string, string> = {
  genre: "GENRE", mechanic: "MECH", setting: "SETTING", narrative: "NARR", combat: "COMBAT",
  perspective: "VIEW", aesthetic: "LOOK", mode: "MODE", era: "ERA",
};

const C = 150;
const R = 104;

/**
 * The reactor "instrument": a radar of how strongly the favourites AGREE per feature category
 * (alignment = share of feature occurrences used by more than one favourite), a rotating sweep, and
 * a coherence gauge. All values come from lib/similarity; nothing here is decorative data.
 */
export function TasteProfile({ taste, favorites }: { taste: TasteReading | null; favorites: string[] }) {
  const points = useMemo(() => {
    return AXES.map((key, i) => {
      const angle = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
      const a = taste?.alignment.find((x) => x.key === key)?.alignment ?? 0;
      const r = 14 + a * (R - 14);
      return {
        key,
        angle,
        value: a,
        x: C + Math.cos(angle) * r,
        y: C + Math.sin(angle) * r,
        lx: C + Math.cos(angle) * (R + 22),
        ly: C + Math.sin(angle) * (R + 22),
        ex: C + Math.cos(angle) * R,
        ey: C + Math.sin(angle) * R,
      };
    });
  }, [taste]);
  const coherence = taste?.coherence ?? 0;
  const lock = favorites.length >= 2 ? Math.round(coherence * 100) : null;
  const polygon = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const summary = points.map((p) => `${AXIS_SHORT[p.key]} ${Math.round(p.value * 100)}%`).join(", ");

  return (
    <figure className="m-0">
      <svg viewBox="0 0 300 300" className="mx-auto block w-full max-w-[19rem]" role="img" aria-label={`Taste radar. Agreement among favourites: ${summary}`}>
        <defs>
          <radialGradient id="rx-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rx-poly" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F472B6" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="rx-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={R + 10} fill="url(#rx-core)" />
        {[0.33, 0.66, 1].map((k) => (
          <circle key={k} cx={C} cy={C} r={14 + k * (R - 14)} fill="none" stroke="rgba(168,85,247,0.35)" strokeWidth="1" strokeDasharray={k === 1 ? undefined : "2 4"} />
        ))}
        {points.map((p) => (
          <line key={p.key} x1={C} y1={C} x2={p.ex} y2={p.ey} stroke="rgba(168,85,247,0.28)" />
        ))}
        <g className="reactor-sweep" aria-hidden>
          <path d={`M${C},${C} L${C + R},${C} A${R},${R} 0 0 0 ${C + R * Math.cos(-0.6)},${C + R * Math.sin(-0.6)} Z`} fill="url(#rx-sweep)" opacity="0.5" />
          <line x1={C} y1={C} x2={C + R} y2={C} stroke="#22D3EE" strokeWidth="1.2" />
        </g>
        <polygon className="reactor-poly" points={polygon} fill="url(#rx-poly)" stroke="#22D3EE" strokeWidth="1.5" strokeLinejoin="round" opacity={taste ? 1 : 0.25} />
        {points.map((p) => (
          <g key={`n${p.key}`}>
            <circle className="reactor-poly" cx={p.x} cy={p.y} r="3.2" fill="#F5F0FF" />
            <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" className="num" fontSize="8.5" letterSpacing="0.8" fill="rgba(245,240,255,0.72)">
              {AXIS_SHORT[p.key]}
            </text>
          </g>
        ))}
        {/* three reactor cores */}
        {[0, 1, 2].map((slot) => {
          const id = favorites[slot];
          const g = id ? GAMES[GAME_INDEX.get(id) ?? -1] : undefined;
          const a = -Math.PI / 2 + (slot - 1) * 0.55;
          const x = C + Math.cos(a) * 16;
          const y = C + Math.sin(a) * 16 + (slot === 1 ? -8 : 0);
          return (
            <circle key={slot} cx={x} cy={y} r={g ? 6 : 4} fill={g ? CLUSTER_BY_ID[g.genres[0]!].color : "none"} stroke={g ? "#fff" : "rgba(245,240,255,0.4)"} strokeWidth="1" strokeDasharray={g ? undefined : "2 2"}>
              <title>{g ? g.title : `Empty slot ${slot + 1}`}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex items-end justify-between gap-4">
        <div>
          <p className="hud-label">Signal lock</p>
          <p className="font-display text-3xl font-semibold leading-none" aria-live="polite">
            {lock === null ? <span className="text-[var(--text-3)]">—</span> : <span className="num">{lock}%</span>}
          </p>
        </div>
        <p className="max-w-[11rem] text-right text-xs leading-snug text-[var(--text-3)]">
          {lock === null ? "Choose at least two favourites to measure how coherent your taste is." : "Share of feature occurrences your favourites have in common."}
        </p>
      </figcaption>
    </figure>
  );
}
