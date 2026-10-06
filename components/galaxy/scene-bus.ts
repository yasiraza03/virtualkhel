/**
 * Imperative bridge between the Three.js loop and DOM overlays (labels, tooltip).
 * The render loop writes transforms straight to these elements so React never re-renders per frame.
 */
export interface SceneBus {
  clusterLabels: Map<string, HTMLElement>;
  hover: HTMLElement | null;
  selected: HTMLElement | null;
  showClusterLabels: boolean;
}

export const bus: SceneBus = {
  clusterLabels: new Map(),
  hover: null,
  selected: null,
  showClusterLabels: true,
};
