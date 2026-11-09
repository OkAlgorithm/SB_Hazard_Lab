import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { clipNearPlane } from "./render-math";
import { pendantPositions, shadowVisibility, sunTravel } from "./workshop-lighting";
import { softwareShadows } from "./software-shadows";

/** Same Babylon scene, camera transforms and ray picking, drawn on a 2D canvas
 * when the browser cannot create a WebGL context. No alternate answer map. */
export class SoftwareEngine extends NullEngine {
  constructor(canvas: HTMLCanvasElement) {
    super({
      renderWidth: canvas.clientWidth || 800,
      renderHeight: canvas.clientHeight || 450,
      textureSize: 1024,
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
    });
    this._renderingCanvas = canvas;
    this.resize();
  }
  override getRenderWidth() {
    return this.getRenderingCanvas()?.width || 800;
  }
  override getRenderHeight() {
    return this.getRenderingCanvas()?.height || 450;
  }
  override resize() {
    const canvas = this.getRenderingCanvas();
    if (canvas)
      this.setSize(
        Math.round(canvas.clientWidth || 800),
        Math.round(canvas.clientHeight || 450),
      );
  }
}

interface Point {
  x: number;
  y: number;
  z: number;
}
interface Triangle {
  p: Point[];
  depth: number;
  alpha: number;
  texture?: HTMLCanvasElement;
  uv?: number[][];
  repeat: boolean;
  ambient: number[];
  sunlight: number[];
  shadow?: number[][];
  specular: number;
  tint: number[];
  transparent: boolean;
}
interface Geometry {
  positions: Vector3[];
  indices: number[];
  uv?: number[];
  normals?: number[];
}
type RasterMaterial = Pick<
  StandardMaterial,
  "alpha" | "backFaceCulling" | "disableLighting" | "metadata"
> &
  Partial<Pick<StandardMaterial, "diffuseColor" | "diffuseTexture">> &
  Partial<Pick<PBRMaterial, "albedoColor" | "albedoTexture">>;

function sampleCoordinate(coordinate: number, size: number, repeat: boolean) {
  return repeat ? ((Math.floor(coordinate) % size) + size) % size
    : Math.max(0, Math.min(size - 1, Math.floor(coordinate)));
}

export function softwareRenderer(canvas: HTMLCanvasElement, scene: Scene) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw Error("No canvas rendering context");
  const geometry = new WeakMap<Mesh, Geometry>();
  let textureCache = new WeakMap<HTMLCanvasElement, ImageData>();
  let textureRevision = -1;
  const light = new Vector3(...sunTravel).normalize().negate();
  const shadowMap = softwareShadows(scene);
  let lastFrame = 0;
  let lastState = "";
  let frame: ImageData | undefined, depth: Float32Array | undefined;
  return () => {
    const now = performance.now();
    if (now - lastFrame < 45) return;
    lastFrame = now;
    const shadowsChanged = shadowMap.update(now);
    // A still scene does not need to rasterise its million pixels again.
    // Camera movement, animation, marks, cutaway, resize and texture loads all
    // invalidate this key; the Babylon scene and input still update normally.
    const state = `${canvas.width}:${canvas.height}:${scene.metadata?.textureRevision}:` +
      Array.from(scene.getTransformMatrix().m).join(",") + ":" +
      scene.meshes.map(m => `${m.uniqueId}/${m.isEnabled()}/${m.isVisible}/${m.visibility}/${m.getWorldMatrix().updateFlag}/${m.material?.uniqueId}/${m.material?.alpha}`).join("|");
    if (state === lastState && !shadowsChanged) return;
    lastState = state;
    if (textureRevision !== scene.metadata?.textureRevision) {
      textureRevision = scene.metadata?.textureRevision;
      textureCache = new WeakMap();
    }
    const w = canvas.width,
      h = canvas.height;
    const viewport = new Viewport(0, 0, w, h);
    const transform = scene.getTransformMatrix();
    const camera = scene.activeCamera!;
    const view = camera.getViewMatrix();
    const inverseView = view.clone().invert();
    const projection = camera.getProjectionMatrix();
    const near = camera.minZ + 0.00001;
    const triangles: Triangle[] = [];
    if (!frame || frame.width !== w || frame.height !== h) {
      frame = ctx.createImageData(w, h);
      depth = new Float32Array(w * h);
    }
    const pixels = frame.data;
    depth!.fill(Infinity);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 229;
      pixels[i + 1] = 233;
      pixels[i + 2] = 223;
      pixels[i + 3] = 255;
    }
    for (const abstract of scene.meshes) {
      const mesh = abstract as Mesh;
      if (
        !mesh.isEnabled() ||
        !mesh.isVisible ||
        mesh.visibility <= 0 ||
        !mesh.getTotalVertices()
      )
        continue;
      let g = geometry.get(mesh);
      if (!g) {
        const raw = mesh.getVerticesData(VertexBuffer.PositionKind);
        const ind = mesh.getIndices();
        if (!raw || !ind) continue;
        const positions: Vector3[] = [];
        for (let i = 0; i < raw.length; i += 3)
          positions.push(new Vector3(raw[i], raw[i + 1], raw[i + 2]));
        g = {
          positions,
          indices: Array.from(ind),
          uv: mesh.getVerticesData(VertexBuffer.UVKind)
            ? Array.from(mesh.getVerticesData(VertexBuffer.UVKind)!)
            : undefined,
          normals: mesh.getVerticesData(VertexBuffer.NormalKind)
            ? Array.from(mesh.getVerticesData(VertexBuffer.NormalKind)!)
            : undefined,
        };
        geometry.set(mesh, g);
      }
      const world = mesh.getWorldMatrix();
      const points = g.positions.map((p) =>
        Vector3.Project(p, world, transform, viewport),
      );
      const worldPoints = g.positions.map((p) =>
        Vector3.TransformCoordinates(p, world),
      );
      const mat = mesh.material as RasterMaterial | null;
      const base = mat?.albedoColor ||
        mat?.diffuseColor || { r: 0.55, g: 0.65, b: 0.5 };
      const dynamic = (mat?.albedoTexture || mat?.diffuseTexture) as
        | DynamicTexture
        | undefined;
      let tex: HTMLCanvasElement | undefined = mat?.metadata?.softwareTexture;
      const repeat = !!tex && mat?.metadata?.textureRepeat !== false;
      try {
        if (dynamic && typeof dynamic.getContext === "function")
          tex = (dynamic.getContext() as CanvasRenderingContext2D).canvas;
      } catch {
        /* Solid material fallback. */
      }
      const lit = !mat?.disableLighting;
      const lightPoints = lit ? worldPoints.map(p => shadowMap.project(p)) : [];
      const viewDepth = worldPoints.map(p => p.x * view.m[2] + p.y * view.m[6] + p.z * view.m[10] + view.m[14]);
      for (let i = 0; i < g.indices.length; i += 3) {
        const ix = [g.indices[i], g.indices[i + 1], g.indices[i + 2]];
        const normal = g.normals
          ? Vector3.TransformNormal(
              new Vector3(
                ix.reduce((sum, n) => sum + g!.normals![n * 3], 0),
                ix.reduce((sum, n) => sum + g!.normals![n * 3 + 1], 0),
                ix.reduce((sum, n) => sum + g!.normals![n * 3 + 2], 0),
              ),
              world,
            ).normalize()
          : Vector3.Cross(
              worldPoints[ix[1]].subtract(worldPoints[ix[0]]),
              worldPoints[ix[2]].subtract(worldPoints[ix[0]]),
            ).normalize();
        if (
          mat?.backFaceCulling !== false &&
          Vector3.Dot(
            normal,
            camera.globalPosition.subtract(worldPoints[ix[0]]),
          ) < -0.001
        )
          continue;
        const original = ix.map((n) => points[n]);
        const faces: { p: Point[]; uv?: number[][]; shadow?: number[][] }[] = [];
        if (
          original.every((p) => Number.isFinite(p.x) && p.z >= 0 && p.z <= 1)
        ) {
          faces.push({
            p: original,
            shadow: lit ? ix.map(n => {
              const q = lightPoints[n], inv = 1 / viewDepth[n];
              return [q.x * inv, q.y * inv, q.z * inv, inv];
            }) : undefined,
            uv:
              tex && g.uv
                ? ix.map((n) => {
                    const p = worldPoints[n];
                    const z =
                      p.x * view.m[2] +
                      p.y * view.m[6] +
                      p.z * view.m[10] +
                      view.m[14];
                    return [
                      g!.uv![n * 2] * tex!.width,
                      (1 - g!.uv![n * 2 + 1]) * tex!.height,
                      1 / z,
                    ];
                  })
                : undefined,
          });
        } else {
          const clipped = clipNearPlane(
            ix.map((n) => {
              const p = Vector3.TransformCoordinates(worldPoints[n], view);
              return {
                x: p.x,
                y: p.y,
                z: p.z,
                u: g!.uv?.[n * 2],
                v: g!.uv?.[n * 2 + 1],
              };
            }),
            near,
          );
          for (let j = 1; j < clipped.length - 1; j++) {
            const vertices = [clipped[0], clipped[j], clipped[j + 1]];
            const p = vertices.map((q) =>
              Vector3.Project(
                new Vector3(q.x, q.y, q.z),
                Matrix.IdentityReadOnly,
                projection,
                viewport,
              ),
            );
            if (p.some((q) => !Number.isFinite(q.x) || q.z < 0 || q.z > 1))
              continue;
            faces.push({
              p,
              shadow: lit ? vertices.map(q => {
                const s = shadowMap.project(Vector3.TransformCoordinates(new Vector3(q.x, q.y, q.z), inverseView));
                return [s.x / q.z, s.y / q.z, s.z / q.z, 1 / q.z];
              }) : undefined,
              uv:
                tex && g.uv
                  ? vertices.map((q) => [
                      q.u! * tex!.width,
                      (1 - q.v!) * tex!.height,
                      1 / q.z,
                    ])
                  : undefined,
            });
          }
        }
        if (!faces.length) continue;
        const centre = worldPoints[ix[0]].add(worldPoints[ix[1]]).add(worldPoints[ix[2]]).scale(1 / 3);
        const nDotL = Math.max(0, Vector3.Dot(normal, light));
        let lamp = 0;
        if (lit) for (const pos of pendantPositions) {
          const toLamp = new Vector3(...pos).subtract(centre);
          const distance = toLamp.length();
          const cos = Math.max(0, toLamp.y / distance);
          // Warm downward cones; ceiling undersides receive only bounced light.
          lamp += Math.max(0, Vector3.Dot(normal, toLamp.scale(1 / distance))) *
            Math.max(0, (cos - 0.38) / 0.62) * 0.13 / (1 + distance * distance * 0.055);
        }
        const bounce = 0.34 + (normal.y + 1) * 0.045;
        const ambientLinear = [bounce * 0.91 + lamp, bounce * 0.97 + lamp * 0.86, bounce * 1.06 + lamp * 0.65];
        const lum = mat?.metadata?.softwareExposure || 1;
        const ambient = lit ? ambientLinear.map(v => Math.sqrt(v) * lum) : [1, 1, 1];
        const sunlight = lit ? ambientLinear.map((v, i) =>
          (Math.sqrt(v + nDotL * 1.3 * [1, 0.95, 0.84][i]) - Math.sqrt(v)) * lum,
        ) : [0, 0, 0];
        const pbr = mat as unknown as PBRMaterial | null;
        const metallic = pbr?.metallic || 0;
        const roughness = pbr?.roughness ?? 0.8;
        const half = camera.globalPosition.subtract(centre).normalize().add(light).normalize();
        const specular = lit ? Math.pow(Math.max(0, Vector3.Dot(normal, half)), 10 + (1 - roughness) * 75) *
          (0.025 + metallic * 0.42) * nDotL * 255 : 0;
        for (const face of faces) {
          const p = face.p;
          if (
            p.every((q) => q.x < 0) ||
            p.every((q) => q.x > w) ||
            p.every((q) => q.y < 0) ||
            p.every((q) => q.y > h)
          )
            continue;
          triangles.push({
            p,
            depth: (p[0].z + p[1].z + p[2].z) / 3,
            alpha: mat?.alpha ?? 1,
            texture: tex,
            uv: face.uv,
            repeat,
            ambient,
            sunlight,
            shadow: face.shadow,
            specular,
            tint: [base.r, base.g, base.b],
            transparent: (mat?.alpha ?? 1) < 0.999 || !!dynamic?.hasAlpha,
          });
        }
      }
    }
    // Complete the opaque depth buffer before blending glass, wet patches or
    // ground contact. Blending them against the clear colour causes pale halos.
    triangles.sort(
      (a, b) =>
        Number(a.transparent) - Number(b.transparent) || b.depth - a.depth,
    );
    for (const t of triangles) {
      const [a, b, c] = t.p;
      const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(denom) < 0.01) continue;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))),
        maxX = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))),
        maxY = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      const dx0 = (b.y - c.y) / denom,
        dy0 = (c.x - b.x) / denom,
        dx1 = (c.y - a.y) / denom,
        dy1 = (a.x - c.x) / denom;
      let row0 =
        ((b.y - c.y) * (minX + 0.5 - c.x) + (c.x - b.x) * (minY + 0.5 - c.y)) /
        denom;
      let row1 =
        ((c.y - a.y) * (minX + 0.5 - c.x) + (a.x - c.x) * (minY + 0.5 - c.y)) /
        denom;
      let texture: ImageData | undefined;
      if (t.texture) {
        texture = textureCache.get(t.texture);
        if (!texture) {
          try {
            texture = t.texture
              .getContext("2d")!
              .getImageData(0, 0, t.texture.width, t.texture.height);
            textureCache.set(t.texture, texture);
          } catch {
            /* Use base colour. */
          }
        }
      }
      for (let y = minY; y <= maxY; y++, row0 += dy0, row1 += dy1) {
        let w0 = row0,
          w1 = row1;
        for (let x = minX; x <= maxX; x++, w0 += dx0, w1 += dx1) {
          const w2 = 1 - w0 - w1;
          if (w0 < -0.0001 || w1 < -0.0001 || w2 < -0.0001) continue;
          const z = w0 * a.z + w1 * b.z + w2 * c.z;
          const index = y * w + x;
          if (z >= depth![index]) continue;
          let r = 0, g = 0, bColor = 0;
          let sampleAlpha = 1;
          let visibility = 1;
          if (t.shadow && t.sunlight[0] > 0.001) {
            const s = t.shadow;
            const inv = 1 / (w0 * s[0][3] + w1 * s[1][3] + w2 * s[2][3]);
            visibility = shadowVisibility(shadowMap.depth, shadowMap.size,
              (w0 * s[0][0] + w1 * s[1][0] + w2 * s[2][0]) * inv,
              (w0 * s[0][1] + w1 * s[1][1] + w2 * s[2][1]) * inv,
              (w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2]) * inv,
            );
          }
          const lr = t.ambient[0] + t.sunlight[0] * visibility;
          const lg = t.ambient[1] + t.sunlight[1] * visibility;
          const lb = t.ambient[2] + t.sunlight[2] * visibility;
          if (texture && t.uv) {
            const perspective =
              w0 * t.uv[0][2] + w1 * t.uv[1][2] + w2 * t.uv[2][2];
            const uCoordinate =
              (w0 * t.uv[0][0] * t.uv[0][2] +
                w1 * t.uv[1][0] * t.uv[1][2] +
                w2 * t.uv[2][0] * t.uv[2][2]) /
              perspective;
            const vCoordinate =
              (w0 * t.uv[0][1] * t.uv[0][2] +
                w1 * t.uv[1][1] * t.uv[1][2] +
                w2 * t.uv[2][1] * t.uv[2][2]) /
              perspective;
            const u = sampleCoordinate(uCoordinate, texture.width, t.repeat);
            const v = sampleCoordinate(vCoordinate, texture.height, t.repeat);
            const ti = (v * texture.width + u) * 4;
            r = texture.data[ti] * t.tint[0] * lr;
            g = texture.data[ti + 1] * t.tint[1] * lg;
            bColor = texture.data[ti + 2] * t.tint[2] * lb;
            sampleAlpha = texture.data[ti + 3] / 255;
          } else {
            r = t.tint[0] * 255 * lr;
            g = t.tint[1] * 255 * lg;
            bColor = t.tint[2] * 255 * lb;
          }
          const specular = t.specular * (visibility * 0.8 + 0.2);
          r += specular; g += specular * 0.95; bColor += specular * 0.86;
          const pi = index * 4;
          const alpha = t.alpha * sampleAlpha;
          if (alpha <= 0) continue;
          pixels[pi] = r * alpha + pixels[pi] * (1 - alpha);
          pixels[pi + 1] = g * alpha + pixels[pi + 1] * (1 - alpha);
          pixels[pi + 2] = bColor * alpha + pixels[pi + 2] * (1 - alpha);
          if (!t.transparent) depth![index] = z;
        }
      }
    }
    ctx.putImageData(frame, 0, 0);
  };
}
