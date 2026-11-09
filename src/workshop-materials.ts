import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export type Surface =
  | "floor"
  | "plaster"
  | "green-wall"
  | "painted-metal"
  | "wood";
const directory = "/assets/workshop/";
const physicalScale: Record<Surface, number> = {
  floor: 3,
  plaster: 2,
  "green-wall": 2,
  "painted-metal": 1,
  wood: 1.5,
};
// Raster images are shared between scenes. The fallback uses the same materials
// and UVs as the GPU scene, with a smaller sampling copy to limit memory.
const rasterImages = new Map<
  string,
  { canvas: HTMLCanvasElement; ready: Promise<void> }
>();
function rasterImage(url: string) {
  const existing = rasterImages.get(url);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#d0cec4";
  context.fillRect(0, 0, 1024, 1024);
  const ready = new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, 1024, 1024);
      resolve();
    };
    image.onerror = () => {
      console.warn("Workshop texture could not be loaded", url);
      resolve();
    };
    image.src = url;
  });
  const item = { canvas, ready };
  rasterImages.set(url, item);
  return item;
}

export function createWorkshopMaterials(scene: Scene, software: boolean) {
  const cache = new Map<string, PBRMaterial>();
  const imagePromises: Promise<void>[] = [];
  if (!software) {
    scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
      directory + "workshop.env",
      scene,
    );
    scene.environmentIntensity = 0.32;
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = 1;
    scene.imageProcessingConfiguration.exposure = 1.16;
    scene.imageProcessingConfiguration.contrast = 1.12;
  }
  function solid(hex: string, alpha = 1, metallic = 0, roughness = 0.7) {
    const key = `${hex}:${alpha}:${metallic}:${roughness}`;
    if (cache.has(key)) return cache.get(key)!;
    const m = new PBRMaterial(key, scene);
    m.albedoColor = Color3.FromHexString(hex);
    m.metallic = metallic;
    m.roughness = roughness;
    m.maxSimultaneousLights = 6;
    m.enableSpecularAntiAliasing = true;
    m.alpha = alpha;
    if (alpha < 1) {
      m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      m.backFaceCulling = false;
    }
    cache.set(key, m);
    return m;
  }
  function surface(kind: Surface) {
    if (cache.has(kind)) return cache.get(kind)!;
    const file = kind === "green-wall" ? "plaster" : kind;
    const m = new PBRMaterial(kind, scene);
    m.albedoColor = Color3.FromHexString(
      kind === "green-wall" ? "#7e8a7b" : kind === "plaster" ? "#e8ebe4" : kind === "wood" ? "#d0c6b4" : "#ffffff",
    );
    // Paint and wood are dielectric surfaces; only exposed steel is metallic.
    m.metallic = 0;
    m.roughness = kind === "painted-metal" ? 0.72 : kind === "wood" ? 0.88 : 0.94;
    m.maxSimultaneousLights = 6;
    m.enableSpecularAntiAliasing = true;
    const raster = rasterImage(directory + file + "-albedo.jpg");
    m.metadata = {
      softwareTexture: raster.canvas,
      softwareExposure:
        kind === "floor"
          ? 1.7
          : kind === "painted-metal"
            ? 1.4
            : kind === "wood"
              ? 1.2
              : 1.2,
    };
    imagePromises.push(
      raster.ready.then(() => {
        if (scene.isDisposed) return;
        scene.metadata = {
          ...scene.metadata,
          textureRevision: (scene.metadata?.textureRevision || 0) + 1,
        };
      }),
    );
    if (!software) {
      m.albedoTexture = new Texture(directory + file + "-albedo.jpg", scene);
      m.albedoTexture.anisotropicFilteringLevel = 8;
      m.bumpTexture = new Texture(directory + file + "-normal.jpg", scene);
      m.bumpTexture.gammaSpace = false;
      m.bumpTexture.level = kind === "floor" ? 0.4 : 0.25;
      m.invertNormalMapX = false;
      m.invertNormalMapY = true;
      m.metallicTexture = new Texture(
        directory + file + "-roughness.jpg",
        scene,
      );
      m.metallicTexture.gammaSpace = false;
      m.useRoughnessFromMetallicTextureAlpha = false;
      m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = false;
    }
    cache.set(kind, m);
    return m;
  }
  function enamel(hex: string) {
    const key = "enamel:" + hex;
    if (cache.has(key)) return cache.get(key)!;
    const m = solid(hex, 1, 0, 0.68).clone(key)!;
    if (!software) {
      // Reuse physical micro-scratches without tinting every painted object green.
      m.bumpTexture = surface("painted-metal").bumpTexture;
      m.metallicTexture = surface("painted-metal").metallicTexture;
      m.useRoughnessFromMetallicTextureAlpha = false;
      m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = false;
    }
    cache.set(key, m);
    return m;
  }
  function apply(mesh: Mesh, kind: Surface) {
    mesh.material = surface(kind);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    if (!positions || !normals) return;
    const uv: number[] = [];
    const scale = physicalScale[kind];
    for (let i = 0; i < positions.length; i += 3) {
      const nx = Math.abs(normals[i]),
        ny = Math.abs(normals[i + 1]),
        nz = Math.abs(normals[i + 2]);
      const axes = ny >= nx && ny >= nz ? [0, 2] : nx >= nz ? [2, 1] : [0, 1];
      uv.push(positions[i + axes[0]] / scale, positions[i + axes[1]] / scale);
    }
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
  }
  function decorate(mesh: Mesh, name: string) {
    if (/concrete-floor|episode-floor/.test(name)) apply(mesh, "floor");
    else if (/wall-lower-band/.test(name)) apply(mesh, "green-wall");
    else if (/wall|ceiling-panel/.test(name) && !/window/.test(name))
      apply(mesh, "plaster");
    else if (
      /bench-top|cart-surface|stored-box|overhanging-crate|crate-plank|crate-batten|loading-table|stored-material/.test(
        name,
      )
    )
      apply(mesh, "wood");
    else if (/electrical-cabinet|cabinet-door/.test(name)) mesh.material = enamel("#858b82");
    else if (/rack-post/.test(name)) mesh.material = enamel("#4e6158");
    else if (/rack-shelf|^shelf$/.test(name)) mesh.material = enamel("#7a7c70");
    else if (/bench-leg|table-leg/.test(name)) mesh.material = enamel("#53605a");
    else if (/vise/.test(name)) mesh.material = solid("#5f6867", 1, 0.72, 0.42);
    else if (/pump-base|motor/.test(name))
      apply(mesh, "painted-metal");
  }
  return {
    solid,
    surface,
    apply,
    decorate,
    ready: () => Promise.all(imagePromises),
  };
}
