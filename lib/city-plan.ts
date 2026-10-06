/**
 * Deterministic plan for everything in the city that is NOT a game: roads, street lamps, houses,
 * parks, trees, ponds and the central pagoda. Pure data (no three.js), seeded only by hashes, so the
 * city is identical on every load and can be rendered by any backend.
 */
import { CLUSTERS } from "@/lib/clusters";
import { hash01, RING_RADIUS } from "@/lib/galaxy-layout";
import type { GalaxyLayout } from "@/lib/galaxy-layout";

export interface Road {
  pts: [number, number][];
  width: number;
  /** lit lane markings only on the bigger roads */
  marked: boolean;
}
export interface Box {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rot: number;
  color: string;
  seed: number;
  y?: number;
}
export interface Tree {
  x: number;
  z: number;
  s: number;
  color: string;
}
export interface Lamp {
  x: number;
  z: number;
  color: string;
}
export interface Park {
  x: number;
  z: number;
  r: number;
  pond: number;
}
export interface CityPlan {
  roads: Road[];
  lamps: Lamp[];
  houses: Box[];
  roofs: Box[];
  trees: Tree[];
  parks: Park[];
  pagoda: { tiers: Box[]; roofs: Box[] };
  /** Radius of the whole built-up city (for fog / ground sizing). */
  extent: number;
}

const HOUSE_COLORS = ["#FF2D95", "#00F0FF", "#FFE600", "#9D4DFF", "#FF6A00"];
const LAMP_COLORS = ["#FFC24A", "#FFC24A", "#FFC24A", "#FF3B30", "#00F0FF"];
const TREE_COLORS = ["#FF6FB5", "#FF6FB5", "#39FF14", "#00F0FF"];

const circle = (r: number, n = 128): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r]);

const line = (a: [number, number], b: [number, number], step = 2): [number, number][] => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / step));
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
};

/** Points every `spacing` units along a polyline, offset sideways by `side`. */
function along(pts: [number, number][], spacing: number, side: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    let d = carry;
    while (d < len) {
      const t = d / len;
      out.push({ x: ax + (bx - ax) * t + nx * side, z: az + (bz - az) * t + nz * side });
      d += spacing;
    }
    carry = d - len;
  }
  return out;
}

export function buildCityPlan(layout: GalaxyLayout): CityPlan {
  const roads: Road[] = [];
  const lamps: Lamp[] = [];
  const houses: Box[] = [];
  const roofs: Box[] = [];
  const trees: Tree[] = [];
  const parks: Park[] = [];

  const clusterAngles = CLUSTERS.map((_, i) => (i / CLUSTERS.length) * Math.PI * 2 + 0.35);
  const gap = Math.PI / CLUSTERS.length;
  const spokeAngles = clusterAngles.map((a) => a + gap); // avenues run BETWEEN districts

  const INNER = 13;
  const OUTER = RING_RADIUS + 17; // ring road just outside the districts
  const EXTENT = 104;

  // ---- roads
  const ringRoads = [
    { r: INNER, w: 2.4 },
    { r: OUTER, w: 3.2 },
    { r: 62, w: 2.2 },
    { r: 80, w: 2.2 },
    { r: 96, w: 2 },
  ];
  for (const { r, w } of ringRoads) roads.push({ pts: circle(r), width: w, marked: r <= OUTER });
  for (const a of spokeAngles) {
    roads.push({ pts: line([Math.cos(a) * INNER, Math.sin(a) * INNER], [Math.cos(a) * EXTENT, Math.sin(a) * EXTENT], 2.5), width: 2.4, marked: true });
  }
  // streets circling every district
  for (const c of CLUSTERS) {
    const a = layout.clusters[c.id];
    const R = a.radius * 1.55;
    roads.push({ pts: circle(R, 56).map(([x, z]) => [x + a.position[0], z + a.position[2]] as [number, number]), width: 1.2, marked: false });
  }

  // ---- lamps along the main roads (alternating sides), sodium yellow with the odd red lantern / cyan tube
  let lampIndex = 0;
  const addLamps = (pts: [number, number][], spacing: number, side: number) => {
    for (const p of along(pts, spacing, side)) {
      lamps.push({ x: p.x, z: p.z, color: LAMP_COLORS[Math.floor(hash01(`lamp${lampIndex++}`) * LAMP_COLORS.length)]! });
    }
  };
  for (const { r, w } of ringRoads.slice(0, 3)) {
    addLamps(circle(r, 160), r > 30 ? 6 : 5, w / 2 + 0.5);
    addLamps(circle(r, 160), r > 30 ? 6 : 5, -(w / 2 + 0.5));
  }
  for (const a of spokeAngles) {
    const pts = line([Math.cos(a) * INNER, Math.sin(a) * INNER], [Math.cos(a) * 70, Math.sin(a) * 70], 2.5);
    addLamps(pts, 7, 1.7);
    addLamps(pts, 7, -1.7);
  }

  // ---- parks: a big central park plus blossom groves between the outer ring roads
  parks.push({ x: 0, z: 0, r: INNER - 3, pond: 3.6 });
  [0, 2, 4, 6, 8, 10, 12].forEach((i) => {
    const a = clusterAngles[i]!;
    parks.push({ x: Math.cos(a) * 71, z: Math.sin(a) * 71, r: 6.5, pond: i % 4 === 0 ? 2.2 : 0 });
  });
  const inPark = (x: number, z: number, pad = 0) => parks.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  parks.forEach((p, pi) => {
    const count = pi === 0 ? 34 : 14;
    for (let k = 0; k < count; k++) {
      const ang = hash01(`pt${pi}-${k}a`) * Math.PI * 2;
      const rr = Math.sqrt(hash01(`pt${pi}-${k}r`)) * (p.r - 0.8);
      const x = p.x + Math.cos(ang) * rr;
      const z = p.z + Math.sin(ang) * rr;
      if (Math.hypot(x - p.x, z - p.z) < p.pond + 0.8) continue;
      trees.push({ x, z, s: 0.8 + hash01(`pt${pi}-${k}s`) * 0.9, color: TREE_COLORS[Math.floor(hash01(`pt${pi}-${k}c`) * TREE_COLORS.length)]! });
    }
  });

  // ---- houses: low-rise rows facing the outer ring roads, kept clear of avenues and parks
  const rows = [OUTER + 5.5, 62 + 5, 62 - 5, 80 + 5, 80 - 5, 96 - 5];
  let hi = 0;
  for (const R of rows) {
    const spacing = 5.2;
    const n = Math.floor((Math.PI * 2 * R) / spacing);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + hash01(`hj${R}-${k}`) * 0.02;
      // keep avenues clear
      if (spokeAngles.some((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) * R < 3.6)) continue;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      if (inPark(x, z, 3)) continue;
      const w = 1.7 + hash01(`hw${hi}`) * 1.5;
      const h = 1.2 + hash01(`hh${hi}`) * 2.6;
      const color = HOUSE_COLORS[Math.floor(hash01(`hc${hi}`) * HOUSE_COLORS.length)]!;
      const seed = hash01(`hs${hi}`);
      const rot = -a + Math.PI / 2;
      houses.push({ x, z, w, h, d: w * (0.9 + hash01(`hd${hi}`) * 0.5), rot, color, seed });
      roofs.push({ x, z, w: w * 1.18, h: 0.9 + hash01(`hr${hi}`) * 0.7, d: w * 1.18, rot: rot + Math.PI / 4, color, seed, y: h });
      hi++;
    }
  }

  // ---- the pagoda at the heart of the central park
  const tiers: Box[] = [];
  const pagodaRoofs: Box[] = [];
  let yy = 0;
  for (let k = 0; k < 5; k++) {
    const w = 3.2 - k * 0.5;
    const h = 1.5;
    tiers.push({ x: 0, z: 0, w, h, d: w, rot: Math.PI / 4, color: k % 2 ? "#FFE600" : "#FF3B30", seed: 0.3 + k * 0.1, y: yy });
    pagodaRoofs.push({ x: 0, z: 0, w: w * 1.45, h: 0.8, d: w * 1.45, rot: 0, color: "#FF3B30", seed: 0.5, y: yy + h });
    yy += h + 0.9;
  }

  return { roads, lamps, houses, roofs, trees, parks, pagoda: { tiers, roofs: pagodaRoofs }, extent: EXTENT };
}
