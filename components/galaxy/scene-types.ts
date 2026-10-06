import type * as THREE from "three";
import type { SceneTargets } from "@/lib/scene-targets";

/** Mutable per-scene state shared between sibling components through a ref (no React updates). */
export interface Live {
  targets: SceneTargets | null;
  /** Increments each time `targets` is recomputed so consumers can rebuild dependent buffers. */
  targetsVersion: number;
  group: THREE.Group | null;
  /** 0..1 draw-in progress for the journey path highlight. */
  reveal: number;
}
