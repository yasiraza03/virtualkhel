import { hash01 } from "@/lib/galaxy-layout";

/** Cables between towers are quadratic arcs that sag upward in the middle, like sky bridges. */
export function arcLift(dist: number): number {
  return 1.4 + dist * 0.17;
}

export function arcPoint(
  P: ArrayLike<number>,
  a: number,
  b: number,
  t: number,
  out: [number, number, number] | Float32Array | number[],
  offset = 0,
): void {
  const ax = P[a * 3]!;
  const ay = P[a * 3 + 1]!;
  const az = P[a * 3 + 2]!;
  const bx = P[b * 3]!;
  const by = P[b * 3 + 1]!;
  const bz = P[b * 3 + 2]!;
  const lift = arcLift(Math.hypot(bx - ax, bz - az));
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 + lift * 2;
  const cz = (az + bz) / 2;
  const u = 1 - t;
  out[offset] = u * u * ax + 2 * u * t * cx + t * t * bx;
  out[offset + 1] = u * u * ay + 2 * u * t * cy + t * t * by;
  out[offset + 2] = u * u * az + 2 * u * t * cz + t * t * bz;
}

export const seeded = (key: string) => hash01(key);
