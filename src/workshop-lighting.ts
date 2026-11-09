// Shared physical layout: the sun enters through the high windows on the left.
// Lamp positions match the four visible pendants in workshop-shell.ts.
export const sunTravel = [0.88, -0.36, -0.30] as const;
export const pendantPositions = [
  [-3.8, 5.43, -3.4], [3.5, 5.43, -3.4],
  [-3.8, 5.43, 2.3], [3.5, 5.43, 2.3],
] as const;

/** Render in device pixels, with a bounded budget instead of dividing retina
 * screens down below CSS resolution. The CPU renderer has a separate budget. */
export function workshopPixelRatio(width: number, height: number, dpr: number) {
  const pixels = Math.max(1, width * height);
  const native = Number.isFinite(dpr) ? Math.max(1, dpr) : 1;
  return Math.max(1, Math.min(native, 1.75, Math.sqrt(2_800_000 / pixels)));
}

export interface ShadowVertex { x: number; y: number; z: number }

/** Orthographic depth rasterisation. Both winding orders cast a shadow; a thin
 * window frame must occlude light even when its rear face is toward the sun. */
export function rasterShadowTriangle(
  depth: Float32Array, size: number,
  a: ShadowVertex, b: ShadowVertex, c: ShadowVertex,
) {
  const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denom) < 0.00001) return;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  const dx0 = (b.y - c.y) / denom, dy0 = (c.x - b.x) / denom;
  const dx1 = (c.y - a.y) / denom, dy1 = (a.x - c.x) / denom;
  let row0 = ((b.y - c.y) * (minX + 0.5 - c.x) + (c.x - b.x) * (minY + 0.5 - c.y)) / denom;
  let row1 = ((c.y - a.y) * (minX + 0.5 - c.x) + (a.x - c.x) * (minY + 0.5 - c.y)) / denom;
  for (let y = minY; y <= maxY; y++, row0 += dy0, row1 += dy1) {
    let w0 = row0, w1 = row1;
    for (let x = minX; x <= maxX; x++, w0 += dx0, w1 += dx1) {
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * a.z + w1 * b.z + w2 * c.z;
      const at = y * size + x;
      if (z < depth[at]) depth[at] = z;
    }
  }
}

export function shadowVisibility(depth: Float32Array, size: number, x: number, y: number, z: number, bias = 0.045) {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= size - 1 || iy >= size - 1) return 1;
  const i = iy * size + ix, compare = z - bias;
  const fx = x - ix, fy = y - iy;
  const a = compare <= depth[i] ? 1 : 0;
  const b = compare <= depth[i + 1] ? 1 : 0;
  const c = compare <= depth[i + size] ? 1 : 0;
  const d = compare <= depth[i + size + 1] ? 1 : 0;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
