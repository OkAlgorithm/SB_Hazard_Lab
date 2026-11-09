export interface ClipVertex {
  x: number;
  y: number;
  z: number;
  u?: number;
  v?: number;
}

/** Clip a view-space polygon to the positive-Z near plane. */
export function clipNearPlane(
  vertices: ClipVertex[],
  near: number,
): ClipVertex[] {
  if (!Number.isFinite(near) || near <= 0 || vertices.length < 3) return [];
  const out: ClipVertex[] = [];
  let previous = vertices[vertices.length - 1];
  for (const current of vertices) {
    const previousInside = previous.z >= near;
    const currentInside = current.z >= near;
    if (previousInside !== currentInside) {
      const t = (near - previous.z) / (current.z - previous.z);
      out.push({
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
        z: near,
        u:
          previous.u !== undefined && current.u !== undefined
            ? previous.u + (current.u - previous.u) * t
            : undefined,
        v:
          previous.v !== undefined && current.v !== undefined
            ? previous.v + (current.v - previous.v) * t
            : undefined,
      });
    }
    if (currentInside) out.push(current);
    previous = current;
  }
  return out;
}
