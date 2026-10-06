"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ChevronsDown } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { TasteReactor } from "@/components/reactor/TasteReactor";
import { CLUSTERS } from "@/lib/clusters";
import { GAMES } from "@/lib/games";
import { journey, JOURNEY_STAGES } from "@/lib/journey-state";
import { journeyPath, JOURNEY_CLUSTER } from "@/lib/journey-config";
import { isVerified } from "@/lib/graph";
import { explain } from "@/lib/recommendations";
import { similarity } from "@/lib/similarity";
import { actions, useStore } from "@/lib/store";
import type { Universe } from "@/lib/universe";
import { SceneSection } from "./SceneSection";

interface Props {
  universe: Universe | null;
  onEnter: (instant: boolean) => void;
  webgl: boolean;
}

const HERO_WORD = "VIRTUALKHEL";

export function JourneyOverlay({ universe, onEnter, webgl }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const ticks = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const stats = useMemo(() => {
    if (!universe) return null;
    const verified = universe.graph.edges.filter((e) => isVerified(e.kind)).length;
    return { verified, inferred: universe.graph.edges.length - verified };
  }, [universe]);

  const lockOn = useMemo(() => {
    if (!universe) return [];
    return GAMES.map((g, i) => ({ g, i }))
      .filter(({ g }) => g.genres[0] === JOURNEY_CLUSTER)
      .sort((a, b) => (universe.graph.degree[b.i] ?? 0) - (universe.graph.degree[a.i] ?? 0))
      .slice(0, 5)
      .map(({ g, i }) => ({ g, links: universe.graph.degree[i] ?? 0 }));
  }, [universe]);

  const steps = useMemo(() => {
    if (!universe) return [];
    const path = journeyPath(universe.graph);
    if (!path) return [];
    return path.nodes.map((n, k) => {
      const g = GAMES[n]!;
      let why: string | null = null;
      let verified = false;
      const next = path.nodes[k + 1];
      if (next !== undefined) {
        const edge = path.edges[k] !== undefined ? universe.graph.edges[path.edges[k]!] : undefined;
        verified = !!edge && isVerified(edge.kind);
        why = verified && edge?.note ? edge.note : explain(similarity(g, GAMES[next]!).components, 2).join(" · ");
      }
      return { g, why, verified, next: next !== undefined ? GAMES[next]!.title : null };
    });
  }, [universe]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    if (!el) return;
    const coarse = window.matchMedia("(max-width: 767px)").matches;
    journey.style = reducedMotion ? 2 : coarse ? 1 : 0;

    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>(".scene", el);

      if (!reducedMotion) {
        gsap.from(".hero-wordmark .ch", { opacity: 0, yPercent: 60, rotateX: -80, transformOrigin: "50% 100%", stagger: 0.055, duration: 1.2, ease: "power3.out", delay: 0.2 });
        gsap.from(".hero-fade", { opacity: 0, y: 18, stagger: 0.14, duration: 0.9, ease: "power2.out", delay: 0.9 });
        sections.slice(1).forEach((sec) => {
          gsap.from(sec.querySelectorAll(".reveal"), {
            opacity: 0,
            y: 34,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.09,
            scrollTrigger: { trigger: sec, start: "top 58%", toggleActions: "play none none reverse" },
          });
        });
        // Title drifts slightly slower than the page: the camera "pulls away" from the wordmark.
        gsap.to(".hero-stack", { yPercent: -14, opacity: 0.0, ease: "none", scrollTrigger: { trigger: sections[0], start: "top top", end: "bottom 20%", scrub: true } });
      }

      const update = () => {
        const tops = sections.map((s) => s.offsetTop);
        const y = window.scrollY;
        const vh = window.innerHeight;
        const max = sections.length - 1;
        if (journey.style === 0) {
          let i = 0;
          for (let k = 0; k <= max; k++) if (tops[k]! <= y + 1) i = k;
          const h = sections[i]!.offsetHeight;
          const frac = Math.min(1, Math.max(0, (y - tops[i]!) / h));
          const local = Math.min(1, Math.max(0, (frac - 0.28) / 0.72));
          journey.target = i === max ? max : i + local;
        } else {
          // Non-cinematic: the stage whose section covers the middle of the viewport.
          const mid = y + vh * 0.5;
          let i = 0;
          for (let k = 0; k <= max; k++) if (tops[k]! <= mid) i = k;
          journey.target = i;
        }
        const active = Math.round(journey.target);
        ticks.current.forEach((t, k) => {
          if (!t) return;
          if (k === active) t.setAttribute("aria-current", "true");
          else t.removeAttribute("aria-current");
        });
      };
      ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom bottom", onUpdate: update, onRefresh: update });
      update();
    }, el);

    return () => {
      ctx.revert();
      journey.target = 0;
    };
  }, [reducedMotion]);

  const scrollTo = (i: number) => {
    document.getElementById(JOURNEY_STAGES[i]!.key)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  const openCluster = (id: (typeof CLUSTERS)[number]["id"]) => {
    actions.setGenres([id]);
    actions.setPanel("filters");
    onEnter(false);
    actions.focusCluster(id);
  };

  return (
    <div ref={root} className="journey relative z-10">
      <nav className="stage-rail" aria-label="Journey progress">
        {JOURNEY_STAGES.map((s, i) => (
          <button key={s.key} type="button" className="stage-tick" ref={(el) => void (ticks.current[i] = el)} onClick={() => scrollTo(i)}>
            <span className="t-label">{s.label}</span>
            <span className="t-bar" aria-hidden />
            <span className="sr-only">Go to stage {i + 1}</span>
          </button>
        ))}
      </nav>

      <section id="awaken" className="scene scene-hero" data-stage-index={0} aria-labelledby="hero-title">
        <div className="sign-v" aria-hidden>游戏星座</div>
        <div className="sign-h" aria-hidden>24H · 营业中</div>
        <div className="scene-inner">
          <div className="hero-stack w-full">
            <p className="hud-label hero-fade mb-5">
              <strong>Game Constellation</strong> <span className="mx-2 opacity-60">{"//"}</span> 游戏星座 <span className="mx-2 opacity-60">{"//"}</span> {GAMES.length} games · {CLUSTERS.length} districts
            </p>
            <h1 id="hero-title" className="hero-wordmark" aria-label={HERO_WORD}>
              <span aria-hidden>
                {HERO_WORD.split("").map((c, i) => (
                  <span key={i} className="ch">
                    {c}
                  </span>
                ))}
              </span>
            </h1>
            <p className="tagline hero-fade">THE UNIVERSE OF GAMES, CONNECTED.</p>
            <div className="hero-fade mt-10 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" onClick={() => onEnter(false)}>
                Enter the universe <ArrowRight className="size-4" aria-hidden />
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onEnter(true)}>
                Skip intro
              </button>
            </div>
            <p className="hero-fade mt-3 text-xs text-[var(--text-3)]">
              {webgl ? "Or scroll for a guided descent." : "3D is unavailable on this device. The full explorer still works."}
            </p>
          </div>
        </div>
        <div className="hero-ticker" aria-hidden>
          <div>
            {[0, 1].map((k) => (
              <span key={k}>
                <span>游戏星座</span>✦<span>{GAMES.length} games</span>✦<span>{CLUSTERS.length} districts</span>✦<span>verified vs inferred, never blurred</span>✦<span>deterministic game dna</span>✦<span>no llm</span>✦
              </span>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => scrollTo(1)} className="scroll-cue hud-label hero-fade absolute bottom-16 left-1/2 -translate-x-1/2" aria-label="Scroll to begin the guided descent">
          <span>Descend</span>
          <i aria-hidden />
          <ChevronsDown className="size-4" aria-hidden />
        </button>
      </section>

      <SceneSection index={1} title={<>Under the neon, a network.</>}>
        <p className="scene-body reveal">
          Every light is a game. Every wire between two of them is either a fact we can cite or a similarity we can compute — and the map never lets the two blur.
        </p>
        <div className="reveal grid grid-cols-2 gap-x-6">
          <div className="stat">
            <b className="num">{GAMES.length}</b>
            <span className="hud-label">games</span>
          </div>
          <div className="stat">
            <b className="num">{CLUSTERS.length}</b>
            <span className="hud-label">districts</span>
          </div>
          <div className="stat">
            <b className="num">{stats ? stats.verified : "…"}</b>
            <span className="hud-label">verified links</span>
          </div>
          <div className="stat">
            <b className="num">{stats ? stats.inferred : "…"}</b>
            <span className="hud-label">inferred links</span>
          </div>
        </div>
      </SceneSection>

      <SceneSection index={2} title={<>Districts light up.</>} align="right">
        <p className="scene-body reveal">
          Colour is genre. Height is release year. Nothing is shuffled — the city looks the same every time you come back.
        </p>
        <ul className="reveal flex flex-wrap gap-2">
          {CLUSTERS.map((c) => (
            <li key={c.id}>
              <button type="button" className="chip" onClick={() => openCluster(c.id)}>
                <span className="pip" style={{ color: c.color }} aria-hidden /> {c.label}
              </button>
            </li>
          ))}
        </ul>
      </SceneSection>

      <SceneSection index={3} title={<>Lock on to a district.</>}>
        <p className="scene-body reveal">
          RPGs run dense: shared mechanics, shared worlds, shared obsessions. The most connected titles burn brightest.
        </p>
        <ul className="reveal space-y-2">
          {lockOn.map(({ g, links }) => (
            <li key={g.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-4 border-b border-[var(--line)] py-2 text-left hover:text-[var(--cyan)]"
                onClick={() => {
                  onEnter(false);
                  actions.select(g.id);
                }}
              >
                <span className="font-display text-lg font-medium">{g.title}</span>
                <span className="num text-xs text-[var(--text-3)]">
                  {g.year} · {links} links
                </span>
              </button>
            </li>
          ))}
          {lockOn.length === 0 && <li className="text-sm text-[var(--text-3)]">Calculating the graph…</li>}
        </ul>
      </SceneSection>

      <SceneSection index={4} title={<>Trace the wires.</>} align="right" wide>
        <p className="scene-body reveal">
          The shortest path between two games, found with Dijkstra over the graph. Verified hops are facts; inferred hops show the strongest shared attributes.
        </p>
        <ol className="reveal">
          {steps.map((s) => (
            <li key={s.g.id} className="path-step" style={{ ["--c" as string]: CLUSTERS.find((c) => c.id === s.g.genres[0])?.color }}>
              <p className="font-display text-lg font-semibold leading-tight">
                {s.g.title} <span className="num text-xs font-normal text-[var(--text-3)]">{s.g.year}</span>
              </p>
              {s.why && s.next && (
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  <span className="hud-label mr-2" style={{ color: s.verified ? "var(--cyan)" : "var(--magenta)" }}>
                    {s.verified ? "Verified" : "Inferred"}
                  </span>
                  → {s.next}: {s.why}
                </p>
              )}
            </li>
          ))}
          {steps.length === 0 && <li className="text-sm text-[var(--text-3)]">Calculating the graph…</li>}
        </ol>
      </SceneSection>

      <SceneSection index={5} title={<>Your universe.</>} wide>
        <div className="reveal">
          <TasteReactor variant="inline" />
        </div>
        <div className="reveal mt-8 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => onEnter(false)}>
            Open the full galaxy <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
        <p className="reveal mt-10 max-w-md text-xs leading-relaxed text-[var(--text-3)]">
          Hand-curated dataset with provenance per game. Tags are editorial; no gameplay values are invented. Optional public summaries come from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). Game titles and trademarks belong to their respective owners.
        </p>
      </SceneSection>
    </div>
  );
}
