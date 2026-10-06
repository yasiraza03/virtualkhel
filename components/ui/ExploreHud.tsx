"use client";

import { ChevronDown, ChevronUp, Orbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GalaxyControls } from "@/components/galaxy/GalaxyControls";
import { GameDetailPanel } from "@/components/game/GameDetailPanel";
import { GameIndex } from "@/components/game/GameIndex";
import { GameSearch } from "@/components/game/GameSearch";
import { TasteReactor } from "@/components/reactor/TasteReactor";
import { actions, useStore } from "@/lib/store";
import type { PanelTab } from "@/lib/store";
import type { Universe } from "@/lib/universe";
import { FilterPanel } from "./FilterPanel";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "filters", label: "Filters" },
  { id: "index", label: "Index" },
  { id: "reactor", label: "Reactor" },
];

interface Props {
  universe: Universe | null;
  onBackToJourney: () => void;
  webgl: boolean;
}

/** The working application: search, filters, accessible index, Taste Reactor and the selection panel. */
export function ExploreHud({ universe, onBackToJourney, webgl }: Props) {
  const panel = useStore((s) => s.panel);
  const selectedId = useStore((s) => s.selectedId);
  const searchRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = panel ?? "filters";

  return (
    <div className="hud" data-detail={selectedId ? "open" : "closed"}>
      <div className="topbar">
        <div className="brand hidden sm:flex">
          <b>VIRTUALKHEL</b>
          <span className="hud-label">游戏星座 · Game Constellation</span>
        </div>
        <div className="min-w-0 flex-1 sm:max-w-md">
          <GameSearch mode="filter" inputRef={searchRef} placeholder="Search by title…  ( / )" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn" onClick={() => onBackToJourney()}>
            <Orbit className="size-4" aria-hidden /> <span className="hidden sm:inline">Journey</span>
            <span className="sr-only sm:hidden">Back to journey</span>
          </button>
        </div>
      </div>

      <section className="drawer hud-panel" aria-label="Galaxy tools" data-collapsed={collapsed && !!selectedId ? "true" : "false"}>
        <div className="drawer-tabs" role="tablist" aria-label="Tools">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              className="drawer-tab"
              onClick={() => {
                actions.setPanel(t.id);
                setCollapsed(false);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="drawer-body" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
          {!webgl && (
            <p className="mb-4 border border-[var(--line)] p-3 text-sm text-[var(--text-2)]" role="status">
              WebGL is not available in this browser, so the 3D galaxy is switched off. Search, filters, the index and the Taste Reactor all still work.
            </p>
          )}
          {active === "filters" && <FilterPanel universe={universe} />}
          {active === "index" && <GameIndex />}
          {active === "reactor" && <TasteReactor variant="dock" />}
        </div>
        <button type="button" className="btn btn-ghost mx-2 mb-2 justify-center md:hidden" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />} {collapsed ? "Show tools" : "Hide tools"}
        </button>
      </section>

      {selectedId && <GameDetailPanel universe={universe} />}
      {webgl && <GalaxyControls />}
    </div>
  );
}
