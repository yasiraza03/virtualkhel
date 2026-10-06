import * as THREE from "three";

/** Shared, mutable visual parameters the render loop animates (never React state). */
export const visuals = {
  tint: new THREE.Color(1, 1, 1),
  expand: 0.4,
};
