"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExploreHud } from "@/components/ui/ExploreHud";
import { actions, store, useStore } from "@/lib/store";
import { loadUniverse } from "@/lib/universe";
import type { Universe } from "@/lib/universe";
import { detectQuality, hasWebGL } from "@/lib/webgl";
import { JourneyOverlay } from "./JourneyOverlay";

// The whole 3D stack (three, fiber, drei, shaders) is a separate chunk that never loads on the server.
const GalaxyCanvas = dynamic(() => import("@/components/galaxy/GalaxyCanvas"), { ssr: false });

export default function ScrollExperience() {
  const mode = useStore((s) => s.mode);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const savedScroll = useRef(0);

  useEffect(() => {
    actions.init();
    setWebgl(hasWebGL());
    setQuality(detectQuality());
    // Graph + layout are pure CPU work; computed in yielding chunks after the hero has painted.
    let live = true;
    loadUniverse().then((u) => live && setUniverse(u));
    return () => {
      live = false;
    };
  }, []);

  // Scroll lock belongs to the explorer; the journey is a normal scrolling document.
  useEffect(() => {
    document.documentElement.classList.toggle("explore-lock", mode === "explore");
    if (mode === "journey") window.scrollTo(0, savedScroll.current);
    return () => document.documentElement.classList.remove("explore-lock");
  }, [mode]);

  const enter = useCallback((instant: boolean) => {
    if (store.get().mode === "journey") savedScroll.current = window.scrollY;
    actions.enterExplore(instant);
  }, []);

  const back = useCallback(() => {
    actions.select(null, false);
    actions.setMode("journey");
  }, []);

  return (
    <>
      <a
        href={mode === "journey" ? "#awaken" : "#panel-filters"}
        className="skip-link"
        onClick={(e) => {
          if (mode === "journey") {
            e.preventDefault();
            enter(true);
          }
        }}
      >
        {mode === "journey" ? "Skip intro — open the explorer" : "Skip to tools"}
      </a>

      {webgl === false ? <div className="fallback-bg" aria-hidden /> : universe && webgl ? <GalaxyCanvas universe={universe} quality={quality} /> : <div className="fallback-bg" aria-hidden />}

      {webgl && !universe && (
        <p className="city-loading hud-label" role="status">
          Building the city…
        </p>
      )}

      {mode === "journey" ? (
        <JourneyOverlay universe={universe} onEnter={enter} webgl={webgl !== false} />
      ) : (
        <ExploreHud universe={universe} onBackToJourney={back} webgl={webgl !== false} />
      )}
    </>
  );
}

