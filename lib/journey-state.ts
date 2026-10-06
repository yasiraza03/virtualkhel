/**
 * High-frequency scroll/journey state, shared between GSAP (writer) and the Three.js loop (reader).
 * Deliberately NOT React state: it changes every frame while scrolling.
 */
export const JOURNEY_STAGES = [
  { key: "awaken", label: "AWAKEN" },
  { key: "descend", label: "DESCEND" },
  { key: "discover", label: "DISCOVER" },
  { key: "lock-on", label: "LOCK ON" },
  { key: "connect", label: "CONNECT" },
  { key: "your-universe", label: "YOUR UNIVERSE" },
] as const;

export const journey = {
  /** Where scrolling wants the camera to be: 0..5 (float while scrubbing). */
  target: 0,
  /** What the camera currently shows: damped toward `target` inside the render loop. */
  scene: 0,
  /** 0 = scrub continuously, 1 = snap to whole stages with a short tween, 2 = snap instantly (reduced motion). */
  style: 0 as 0 | 1 | 2,
};

export const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
