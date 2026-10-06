import type { ReactNode } from "react";
import { JOURNEY_STAGES } from "@/lib/journey-state";

interface Props {
  index: number;
  title: ReactNode;
  align?: "left" | "right";
  wide?: boolean;
  children: ReactNode;
}

/** One stage of the cinematic journey: semantic section, kicker, title, and a legible content card. */
export function SceneSection({ index, title, align = "left", wide, children }: Props) {
  const stage = JOURNEY_STAGES[index]!;
  return (
    <section id={stage.key} className="scene" data-stage-index={index} aria-labelledby={`${stage.key}-title`}>
      <div className="scene-inner" data-align={align}>
        <div className={`scene-card${wide ? " scene-card--wide" : ""}`}>
          <p className="scene-kicker reveal hud-label">
            <strong>{String(index + 1).padStart(2, "0")}</strong> / {stage.label}
          </p>
          <h2 id={`${stage.key}-title`} className="scene-title reveal">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}
