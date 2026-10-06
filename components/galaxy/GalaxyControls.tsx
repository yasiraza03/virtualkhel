"use client";

import { Maximize2, Minus, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { actions } from "@/lib/store";
import { bus } from "./scene-bus";

/** On-screen camera controls: the same actions the keyboard shortcuts trigger. */
export function GalaxyControls() {
  const [labels, setLabels] = useState(true);
  return (
    <div className="dock-controls" role="group" aria-label="Camera controls">
      <button type="button" className="btn btn-icon" aria-label="Zoom in" title="Zoom in (+)" onClick={() => actions.zoom(0.7)}>
        <Plus className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-icon" aria-label="Zoom out" title="Zoom out (-)" onClick={() => actions.zoom(1.4)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="btn btn-icon"
        aria-label="Toggle system labels"
        aria-pressed={labels}
        title="System labels"
        onClick={() => {
          bus.showClusterLabels = !labels;
          setLabels(!labels);
        }}
      >
        <Tag className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn" title="Reset camera (R)" onClick={actions.resetCamera}>
        <Maximize2 className="size-4" aria-hidden /> Reset
      </button>
    </div>
  );
}
