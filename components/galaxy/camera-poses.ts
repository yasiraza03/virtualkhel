import * as THREE from "three";
import { smoothstep } from "@/lib/journey-state";
import { JOURNEY_CLUSTER, journeyPath } from "@/lib/journey-config";
import type { Universe } from "@/lib/universe";

export interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

/** Overview pose used for the explorer and for "reset camera". Backs off on portrait screens. */
export function homePose(aspect: number): Pose {
  const back = aspect < 1 ? 1 + (1 - aspect) * 1.1 : 1;
  const wide = aspect > 1.2 ? 1 : 0; // leave room for the tool drawer on the left
  return { pos: new THREE.Vector3(-7 * wide, 38 * back, 60 * back), target: new THREE.Vector3(-7 * wide, 0, 0) };
}

/**
 * Which side of the screen the galaxy should occupy at each stage: +1 puts it on the right
 * (text card on the left), -1 on the left. Keeps the camera, copy and scene composed together.
 */
const SIDES = [1, 1, -1, 1, -1, 1];

export function keyframes(universe: Universe): Pose[] {
  const { layout, graph } = universe;
  const rpg = layout.clusters[JOURNEY_CLUSTER];
  const rpgPos = new THREE.Vector3(rpg.position[0], rpg.height * 0.45, rpg.position[2]);
  const out = new THREE.Vector3(rpg.position[0], 0, rpg.position[2]).normalize();
  const lock: Pose = {
    pos: new THREE.Vector3(rpg.position[0], 0, rpg.position[2]).addScaledVector(out, 15).add(new THREE.Vector3(3, 6.5, 4)),
    target: rpgPos.clone(),
  };

  const path = journeyPath(graph);
  const centroid = new THREE.Vector3();
  let extent = 18;
  if (path && path.nodes.length) {
    const pts = path.nodes.map((i) => new THREE.Vector3(layout.positions[i * 3], layout.positions[i * 3 + 1], layout.positions[i * 3 + 2]));
    pts.forEach((p) => centroid.add(p));
    centroid.divideScalar(pts.length);
    extent = Math.max(...pts.map((p) => p.distanceTo(centroid)), 8);
  }
  const dir = centroid.clone().setY(0);
  if (dir.lengthSq() < 1) dir.set(0, 0, 1);
  dir.normalize();
  const connect: Pose = {
    pos: centroid.clone().setY(0).addScaledVector(dir, extent * 1.1 + 12).add(new THREE.Vector3(0, extent * 0.55 + 10, 0)),
    target: centroid.clone().setY(centroid.y * 0.6),
  };

  return [
    { pos: new THREE.Vector3(0, 21, 100), target: new THREE.Vector3(0, 9, 0) }, // AWAKEN: the whole skyline from beyond the suburbs
    { pos: new THREE.Vector3(-30, 9, 58), target: new THREE.Vector3(2, 8, -6) }, // DESCEND: dive over the suburbs toward the districts
    { pos: new THREE.Vector3(0, 74, 44), target: new THREE.Vector3(0, 0, 0) }, // DISCOVER: rise over the districts
    lock, // LOCK ON: street-level approach to one district
    connect, // CONNECT: swoop along the wires
    { pos: new THREE.Vector3(18, 36, 68), target: new THREE.Vector3(0, 3, 0) }, // YOUR UNIVERSE: wide cinematic pull-back
  ];
}

const tmpA = new THREE.Vector3();
const tmpFwd = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function samplePose(frames: Pose[], scene: number, out: Pose, aspect = 1.6): Pose {
  const max = frames.length - 1;
  const s = Math.min(max, Math.max(0, scene));
  const i = Math.min(max - 1, Math.floor(s));
  const f = smoothstep(s - i);
  const a = frames[i]!;
  const b = frames[i + 1]!;
  out.pos.copy(tmpA.copy(a.pos).lerp(b.pos, f));
  out.target.copy(a.target).lerp(b.target, f);

  // Slide the whole composition sideways in camera space so it never sits behind the text card.
  const side = SIDES[i]! + (SIDES[i + 1]! - SIDES[i]!) * f;
  const wide = Math.min(1, Math.max(0, (aspect - 1.05) / 0.7));
  const tall = Math.min(1, Math.max(0, (0.95 - aspect) / 0.35));
  if (wide > 0 || tall > 0) {
    tmpFwd.copy(out.target).sub(out.pos);
    const dist = tmpFwd.length();
    tmpRight.crossVectors(tmpFwd.normalize(), UP).normalize();
    const shift = -side * dist * 0.2 * wide;
    out.pos.addScaledVector(tmpRight, shift);
    out.target.addScaledVector(tmpRight, shift);
    // Portrait screens stack text under the scene: lift the galaxy into the upper half.
    tmpUp.crossVectors(tmpRight, tmpFwd).normalize();
    const lift = -dist * 0.32 * tall;
    out.pos.addScaledVector(tmpUp, lift);
    out.target.addScaledVector(tmpUp, lift);
  }
  return out;
}

/** How much of the city has "powered up" (lit windows, neon edges): dim at AWAKEN, fully lit by DISCOVER. */
export function expansionAt(scene: number): number {
  return 0.3 + 0.7 * smoothstep((scene - 0.2) / 1.8);
}

const TINTS = [
  new THREE.Color(1.05, 0.8, 1.25), // violet
  new THREE.Color(0.8, 1.1, 1.25), // cyan
  new THREE.Color(1, 1, 1),
  new THREE.Color(1.15, 0.82, 1.35), // rpg violet
  new THREE.Color(0.9, 1.05, 1.3), // cyan-magenta
  new THREE.Color(1.25, 0.85, 1.15), // magenta
];

export function tintAt(scene: number, out: THREE.Color): THREE.Color {
  const s = Math.min(TINTS.length - 1, Math.max(0, scene));
  const i = Math.min(TINTS.length - 2, Math.floor(s));
  return out.copy(TINTS[i]!).lerp(TINTS[i + 1]!, smoothstep(s - i));
}
