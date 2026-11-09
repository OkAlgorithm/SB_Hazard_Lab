import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { rasterShadowTriangle, sunTravel } from "./workshop-lighting";

/** A real directional depth map for the compatibility renderer. It is rebuilt
 * only when geometry/cutaway changes, at most five times a second for episodes. */
export function softwareShadows(scene: Scene) {
  const size = 768;
  const depth = new Float32Array(size * size);
  const direction = new Vector3(...sunTravel).normalize();
  const right = Vector3.Cross(Vector3.Up(), direction).normalize();
  const up = Vector3.Cross(direction, right).normalize();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const x of [-10, 10]) for (const y of [-0.7, 7.4]) for (const z of [-8, 8]) {
    const p = new Vector3(x, y, z);
    const sx = Vector3.Dot(p, right), sy = Vector3.Dot(p, up);
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  }
  const scaleX = (size - 1) / (maxX - minX), scaleY = (size - 1) / (maxY - minY);
  const project = (p: Vector3) => ({
    x: (Vector3.Dot(p, right) - minX) * scaleX,
    y: (Vector3.Dot(p, up) - minY) * scaleY,
    z: Vector3.Dot(p, direction),
  });
  let signature = "", lastChecked = -Infinity;
  const geometry = new WeakMap<Mesh, { positions: Vector3[]; indices: ArrayLike<number> }>();
  function update(now: number) {
    if (now - lastChecked < 200) return false;
    lastChecked = now;
    const casters = scene.meshes.filter((mesh) => {
      const mat = mesh.material;
      return mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 &&
        mesh.getTotalVertices() && !mesh.metadata?.nonOccluding &&
        (mat?.alpha ?? 1) > 0.95 && !(mat as { disableLighting?: boolean })?.disableLighting &&
        !/^(courtyard|concrete-floor|episode-floor|foundation|floor-joint|route-|contact-shadow)/.test(mesh.name);
    }) as Mesh[];
    const next = casters.map(m => `${m.uniqueId}:${m.getWorldMatrix().updateFlag}`).join("|");
    if (next === signature) return false;
    signature = next;
    depth.fill(Infinity);
    for (const mesh of casters) {
      let g = geometry.get(mesh);
      if (!g) {
        const raw = mesh.getVerticesData(VertexBuffer.PositionKind), indices = mesh.getIndices();
        if (!raw || !indices) continue;
        const positions: Vector3[] = [];
        for (let i = 0; i < raw.length; i += 3) positions.push(new Vector3(raw[i], raw[i + 1], raw[i + 2]));
        g = { positions, indices };
        geometry.set(mesh, g);
      }
      const world = mesh.getWorldMatrix();
      const p = g.positions.map(v => project(Vector3.TransformCoordinates(v, world)));
      for (let i = 0; i < g.indices.length; i += 3)
        rasterShadowTriangle(depth, size, p[g.indices[i]], p[g.indices[i + 1]], p[g.indices[i + 2]]);
    }
    return true;
  }
  return { depth, size, project, update };
}
