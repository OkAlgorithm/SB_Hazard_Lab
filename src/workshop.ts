import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { SoftwareEngine, softwareRenderer } from "./software-renderer";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraKeyboardMoveInput";
import "@babylonjs/core/Cameras/Inputs/freeCameraKeyboardMoveInput";
import "@babylonjs/core/Cameras/Inputs/freeCameraMouseInput";
import "@babylonjs/core/Cameras/Inputs/freeCameraTouchInput";
import {
  objectLabels,
  type Mark,
  type Selection,
  type Zone,
} from "./assessment";
import { episode1Pose } from "./episode-timeline";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { createWorkshopMaterials } from "./workshop-materials";
import { buildWorkshopShell, contactShadow } from "./workshop-shell";
import { pendantPositions, sunTravel, workshopPixelRatio } from "./workshop-lighting";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import type { Camera } from "@babylonjs/core/Cameras/camera";

type Point = [number, number, number];
const v = (p: Point) => new Vector3(...p);
const color = (hex: string) => Color3.FromHexString(hex);
let webglAvailable: boolean | undefined;
const palette = {
  floor: "#b4b0a3",
  edge: "#78796b",
  steel: "#636d69",
  steelDark: "#343c3a",
  machine: "#687157",
  machineLight: "#8c9577",
  ochre: "#b69a50",
  cream: "#d2cfc1",
  wood: "#9d805a",
  dark: "#292f2c",
  orange: "#bc7c42",
};

function pickObject(scene: Scene) {
  const pick = scene.pick(
    scene.pointerX,
    scene.pointerY,
    (mesh) =>
      mesh.isEnabled() &&
      !mesh.metadata?.nonOccluding &&
      (mesh.isPickable || (mesh.isVisible && mesh.visibility > 0)),
  );
  let node = pick?.pickedMesh as TransformNode | null;
  let metadata: { objectId: string; label: string } | undefined;
  while (node) {
    if (node.metadata?.objectId) {
      metadata = node.metadata;
      break;
    }
    node = node.parent as TransformNode | null;
  }
  return { pick, metadata };
}

function studio(canvas: HTMLCanvasElement) {
  if (webglAvailable === undefined) {
    const probe = document.createElement("canvas");
    try {
      const gl = probe.getContext("webgl2") || probe.getContext("webgl");
      webglAvailable = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglAvailable = false;
    }
  }
  const engine = webglAvailable
    ? new Engine(canvas, true, {
        preserveDrawingBuffer: false,
        stencil: true,
        adaptToDeviceRatio: false,
      })
    : new SoftwareEngine(canvas);
  const software = engine instanceof SoftwareEngine;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const pixelRatio = () => workshopPixelRatio(canvas.clientWidth || 800, canvas.clientHeight || 450, window.devicePixelRatio || 1);
  if (!software) engine.setHardwareScalingLevel(1 / pixelRatio());
  const scene = new Scene(engine);
  const drawSoftware =
    engine instanceof SoftwareEngine ? softwareRenderer(canvas, scene) : null;
  const render = () => {
    scene.render();
    drawSoftware?.();
  };
  scene.clearColor = Color4.FromHexString("#c3cdcf");
  scene.ambientColor = new Color3(0.12, 0.13, 0.14);
  const sky = new HemisphericLight("window-sky-bounce", new Vector3(-0.5, 1, 0), scene);
  sky.intensity = 0.3;
  sky.diffuse = color("#dbe5ed");
  sky.groundColor = color("#6b685d");
  const sun = new DirectionalLight(
    "window-afternoon-sun",
    new Vector3(...sunTravel).normalize(),
    scene,
  );
  sun.position = new Vector3(-16, 8.3, 5.6);
  sun.intensity = 3.4;
  sun.diffuse = color("#fff1d7");
  sun.autoCalcShadowZBounds = true;
  const shadows = new ShadowGenerator(coarse ? 1024 : 2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.0005;
  shadows.normalBias = 0.018;
  shadows.darkness = 0.08;
  const surfaces = createWorkshopMaterials(
    scene,
    software,
  );
  for (const position of pendantPositions) {
    const light = new SpotLight(
      "warm-pendant-fill",
      new Vector3(...position),
      new Vector3(0, -1, 0),
      Math.PI * 0.74,
      1.3,
      scene,
    );
    light.diffuse = color("#ffe5ba");
    light.intensity = 14;
    light.range = 9;
  }
  function finishCameras(cameras: Camera[]) {
    if (software) return;
    if (!coarse && SSAO2RenderingPipeline.IsSupported) {
      const ao = new SSAO2RenderingPipeline("workshop-contact-ao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, cameras);
      ao.radius = 0.28;
      ao.totalStrength = 0.55;
      ao.samples = 8;
      ao.expensiveBlur = false;
      ao.bilateralSamples = 8;
      ao.maxZ = 35;
    }
    const quality = new DefaultRenderingPipeline("workshop-finish", true, scene, cameras);
    quality.fxaaEnabled = true;
    quality.samples = !coarse && engine.webGLVersion >= 2 ? 2 : 1;
    // Keep the frame crisp and the hazards legible; no depth blur or grain.
  }
  function material(hex: string, alpha = 1) {
    return surfaces.solid(hex, alpha);
  }
  function tag(mesh: Mesh, id: string, label?: string) {
    mesh.isPickable = true;
    mesh.metadata = {
      objectId: id,
      label: label || objectLabels[id] || "Участок цеха",
    };
    return mesh;
  }
  function box(
    name: string,
    pos: Point,
    size: Point,
    hex: string,
    parent?: TransformNode,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: size[0], height: size[1], depth: size[2] },
      scene,
    );
    m.position = v(pos);
    m.material = material(hex);
    surfaces.decorate(m, name);
    m.isPickable = false;
    m.checkCollisions = size[1] > 0.15;
    m.receiveShadows = true;
    if (parent) m.parent = parent;
    if (size[1] > 0.015 && !/^(courtyard|concrete-floor|episode-floor|foundation|floor-joint|route-)/.test(name))
      shadows.addShadowCaster(m);
    return m;
  }
  function cylinder(
    name: string,
    pos: Point,
    height: number,
    diameter: number,
    hex: string,
    parent?: TransformNode,
    tessellation = 28,
  ) {
    const m = MeshBuilder.CreateCylinder(
      name,
      { height, diameter, tessellation },
      scene,
    );
    m.position = v(pos);
    m.material = material(hex);
    surfaces.decorate(m, name);
    m.isPickable = false;
    m.receiveShadows = true;
    if (parent) m.parent = parent;
    shadows.addShadowCaster(m);
    return m;
  }
  function tube(
    name: string,
    points: Point[],
    radius: number,
    hex: string,
    id?: string,
    parent?: TransformNode,
  ) {
    const m = MeshBuilder.CreateTube(
      name,
      { path: points.map(v), radius, tessellation: 16, cap: Mesh.CAP_ALL },
      scene,
    );
    m.material = material(hex);
    m.isPickable = false;
    m.receiveShadows = true;
    shadows.addShadowCaster(m);
    if (parent) m.parent = parent;
    if (id) tag(m, id);
    return m;
  }
  function sign(
    text: string,
    pos: Point,
    width = 2,
    height = 0.45,
    hex = "#e4e9da",
    parent?: TransformNode,
    flat = false,
  ) {
    const texture = new DynamicTexture(
      "sign-" + text,
      { width: 1024, height: Math.round((1024 * height) / width) },
      scene,
      false,
    );
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, texture.getSize().width, texture.getSize().height);
    ctx.font = `700 ${Math.min(96, Math.round(1024 / (Math.max(7, text.length) * 0.66)))}px Arial`;
    ctx.fillStyle = "#273f36";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, texture.getSize().height / 2);
    texture.update();
    const m = MeshBuilder.CreatePlane("sign-" + text, { width, height }, scene);
    m.position = v(pos);
    if (flat) m.rotation.x = Math.PI / 2;
    if (parent) m.parent = parent;
    m.isPickable = false;
    const mat = new StandardMaterial("sign-material", scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = new Color3(0.7, 0.7, 0.7);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    m.material = mat;
    return m;
  }
  function human(name: string, pos: Point, rotation = 0) {
    const root = new TransformNode(name, scene);
    root.position = v(pos);
    root.rotation.y = rotation;
    const torso = box(
      "jacket",
      [0, 1.08, 0],
      [0.48, 0.65, 0.28],
      "#586c72",
      root,
    );
    box(
      "reflective-band",
      [0, 1.11, -0.15],
      [0.48, 0.07, 0.014],
      "#c5c89c",
      root,
    );
    cylinder("neck", [0, 1.48, 0], 0.12, 0.14, "#b98c68", root);
    const head = MeshBuilder.CreateSphere(
      "head",
      { diameter: 0.3, segments: 12 },
      scene,
    );
    head.position = new Vector3(0, 1.65, 0);
    head.material = material("#c09a77");
    head.parent = root;
    head.isPickable = false;
    const helmet = MeshBuilder.CreateSphere(
      "helmet",
      { diameter: 0.37, segments: 12, slice: 0.56 },
      scene,
    );
    helmet.position = new Vector3(0, 1.76, 0);
    helmet.material = material(palette.ochre);
    helmet.parent = root;
    helmet.isPickable = false;
    cylinder("helmet-brim", [0, 1.76, 0], 0.035, 0.43, palette.ochre, root);
    const legs = [-0.14, 0.14].map((x, i) => {
      const leg = box(
        "trouser-" + i,
        [x, 0.48, 0],
        [0.17, 0.65, 0.2],
        "#384c54",
        root,
      );
      box("boot", [x, 0.1, -0.045], [0.23, 0.17, 0.34], "#35423b", root);
      return leg;
    });
    const arms = [-0.32, 0.32].map((x, i) => {
      const arm = box(
        "sleeve-" + i,
        [x, 1.04, 0],
        [0.15, 0.58, 0.19],
        "#586c72",
        root,
      );
      cylinder("glove", [x, 0.72, 0], 0.13, 0.14, "#b9b296", root);
      return arm;
    });
    return { root, torso, legs, arms };
  }
  function trolley(name: string, pos: Point, longLoad = false) {
    const root = new TransformNode(name, scene);
    root.position = v(pos);
    const deck = box(
      "cart-deck",
      [0, 0.4, 0],
      [1.1, 0.15, 1.5],
      palette.steelDark,
      root,
    );
    box("cart-surface", [0, 0.49, 0], [1.03, 0.04, 1.43], palette.wood, root);
    for (const x of [-0.45, 0.45])
      for (const z of [-0.57, 0.57]) {
        const wheel = cylinder(
          "wheel",
          [x, 0.2, z],
          0.15,
          0.31,
          "#35433e",
          root,
        );
        wheel.rotation.z = Math.PI / 2;
      }
    for (const x of [-0.45, 0.45])
      cylinder("cart-handle", [x, 0.92, 0.65], 0.9, 0.055, palette.steel, root);
    tube(
      "handle-crossbar",
      [
        [-0.45, 1.35, 0.65],
        [0.45, 1.35, 0.65],
      ],
      0.04,
      palette.steel,
      undefined,
      root,
    );
    let load: Mesh | undefined;
    if (longLoad) {
      load = box(
        "long-load",
        [0, 0.92, -0.15],
        [0.28, 0.3, 4.7],
        "#929e91",
        root,
      );
      load.material = surfaces.solid("#a2aaa8", 1, 0.9, 0.36);
      for (const z of [-0.65, 0.65])
        tube(
          "retaining-strap",
          [
            [-0.16, 1.085, z],
            [0.16, 1.085, z],
          ],
          0.028,
          palette.ochre,
          undefined,
          root,
        );
    }
    return { root, deck, load };
  }
  const resize = () => {
    if (!software) {
      const scaling = 1 / pixelRatio();
      if (Math.abs(engine.getHardwareScalingLevel() - scaling) > 0.01) engine.setHardwareScalingLevel(scaling);
    }
    engine.resize();
  };
  window.addEventListener("resize", resize);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const dispose = () => {
    observer.disconnect();
    window.removeEventListener("resize", resize);
    scene.dispose();
    engine.dispose();
  };
  return {
    engine,
    scene,
    render,
    material,
    tag,
    box,
    cylinder,
    tube,
    sign,
    human,
    trolley,
    dispose,
    shadows,
    surfaces,
    finishCameras,
  };
}

export interface WorkshopController {
  setZone: (zone: Zone | "all") => void;
  setMode: (mode: "orbit" | "walk") => void;
  move: (x: number, z: number) => void;
  setMarking: (value: boolean) => void;
  setPaused: (value: boolean) => void;
  setMarks: (marks: Mark[]) => void;
  setChapter: (chapter: number) => void;
  setLecturePlaying: (playing: boolean) => void;
  dispose: () => void;
}

export function createWorkshop(
  canvas: HTMLCanvasElement,
  variant: "lecture" | "assessment",
  onSelect: (selection: Selection) => void,
  onReady: () => void,
): WorkshopController {
  const s = studio(canvas);
  const { scene, engine, box, cylinder, tube, sign, tag } = s;
  scene.collisionsEnabled = true;
  const floor = box(
    "concrete-floor",
    [0, -0.17, 0],
    [18, 0.34, 13.8],
    palette.floor,
  );
  tag(floor, "D0");
  box("foundation", [0, -0.48, 0], [18.3, 0.3, 14.1], palette.edge);
  for (let x = -6; x < 9; x += 3)
    box("floor-joint", [x, 0.004, 0], [0.015, 0.008, 13.6], "#99998b");
  for (let z = -4; z < 7; z += 3)
    box("floor-joint", [0, 0.004, z], [17.9, 0.008, 0.015], "#99998b");
  const shell = buildWorkshopShell(s);
  shell.setCutaway(true);
  // Marked pedestrian route, kept distinct from equipment footprints.
  for (const x of [-1.78, 0.58])
    for (let z = -5.8; z < 4.6; z += 0.85)
      box("route-line", [x, 0.025, z], [0.055, 0.018, 0.6], palette.ochre);
  for (const z of [1.2, 2.99])
    for (let x = 0.8; x < 6.7; x += 0.85)
      box("route-line", [x, 0.025, z], [0.6, 0.018, 0.055], palette.ochre);
  // Authored, bevelled GLB geometry. The logical assessment objects are retained.
  const modelPromises: Promise<unknown>[] = [];
  function lathe(x: number, z: number, closed = false) {
    const root = new TransformNode("lathe-1k62", scene);
    root.position.set(x, 0, z);
    root.rotation.y = Math.PI / 2;
    root.metadata = {
      objectId: closed ? "D1" : "D0",
      label: closed ? objectLabels.D1 : "Станок 1К62",
    };
    const placeholder = box(
      "lathe-loading-base",
      [0, 0.5, 0],
      [3.5, 1, 1.3],
      palette.machine,
      root,
    );
    const promise = ImportMeshAsync("/assets/workshop/lathe-1k62.glb", scene)
      .then((result) => {
        if (scene.isDisposed) return;
        result.meshes[0].parent = root;
        const oldMaterials = new Set(
          result.meshes.map((mesh) => mesh.material).filter(Boolean),
        );
        for (const mesh of result.meshes) {
          if (!mesh.getTotalVertices()) continue;
          const name = mesh.material?.name || mesh.name;
          if (name === "painted-metal")
            mesh.material = s.surfaces.surface("painted-metal");
          else if (name === "machined-steel")
            mesh.material = s.surfaces.solid("#a5aaa4", 1, 0.82, 0.28);
          else if (name === "glass")
            mesh.material = s.surfaces.solid("#b4c4bd", 0.2, 0.02, 0.12);
          else if (name === "rubber")
            mesh.material = s.surfaces.solid("#282d26", 1, 0, 0.87);
          else if (name === "lettering")
            mesh.material = s.surfaces.solid("#d6d3b9");
          else if (name === "nameplate")
            mesh.material = s.surfaces.solid("#30352b", 1, 0.25, 0.5);
          else if (name === "brass")
            mesh.material = s.surfaces.solid("#a48b56", 1, 0.75, 0.38);
          else mesh.material = s.surfaces.solid("#414943", 1, 0.4, 0.66);
          mesh.isPickable = true;
          mesh.checkCollisions = name !== "glass";
          mesh.receiveShadows = true;
          if (name !== "glass") s.shadows.addShadowCaster(mesh);
        }
        placeholder.dispose();
        for (const mat of oldMaterials) mat?.dispose();
      })
      .catch((error) =>
        console.error("Detailed lathe could not be loaded", error),
      );
    modelPromises.push(promise);
    contactShadow(scene, x, z, 2.4, 4.5, 0.34);
  }
  lathe(-3.9, 2.6, true);
  lathe(-3.9, -2.4);
  // Electrical cable is separated from the liquid spill.
  box("electrical-outlet", [-7.6, 0.7, 1.4], [0.25, 0.3, 0.17], palette.cream);
  const cablePosition: Point =
    variant === "lecture" ? [-6.8, 0.075, 3.8] : [-6.3, 0.075, 0.8];
  const leftBreak: Point = [
    cablePosition[0] - 0.24,
    cablePosition[1],
    cablePosition[2],
  ];
  const rightBreak: Point = [
    cablePosition[0] + 0.24,
    cablePosition[1],
    cablePosition[2],
  ];
  tube(
    "electrical-cable-left",
    [[-7.6, 0.7, 1.3], [-7.5, 0.13, 1.1], [-7, 0.12, 0.75], leftBreak],
    0.035,
    "#30372e",
    "H4",
  );
  tube(
    "electrical-cable-right",
    [rightBreak, [-5.65, 0.12, 0.82]],
    0.035,
    "#30372e",
    "H4",
  );
  for (const offset of [-0.02, 0, 0.02]) {
    tube(
      "exposed-conductor",
      [
        [leftBreak[0], leftBreak[1], leftBreak[2] + offset],
        [
          cablePosition[0] - 0.09,
          cablePosition[1] + 0.045,
          cablePosition[2] + offset * 1.3,
        ],
        [
          cablePosition[0] + 0.09,
          cablePosition[1] + 0.04,
          cablePosition[2] + offset * 1.3,
        ],
        [rightBreak[0], rightBreak[1], rightBreak[2] + offset],
      ],
      0.008,
      "#cd9a58",
      "H4",
    );
  }
  for (const direction of [-1, 1]) {
    const collar = cylinder(
      "torn-insulation",
      [cablePosition[0] + direction * 0.26, cablePosition[1], cablePosition[2]],
      0.11,
      0.11,
      "#2e3e34",
    );
    collar.rotation.z = Math.PI / 2;
    tag(collar, "H4");
  }
  const electricProxy = box(
    "electrical-pick-area",
    cablePosition,
    [0.8, 0.4, 0.55],
    palette.cream,
  );
  electricProxy.isVisible = false;
  electricProxy.checkCollisions = false;
  tag(electricProxy, "H4");
  // Benches and properly stored tools.
  const bench = new TransformNode("workbench", scene);
  bench.position = new Vector3(4.8, 0, -3.4);
  box("bench-top", [0, 1.1, 0], [3.25, 0.18, 1.45], palette.wood, bench);
  for (const x of [-1.4, 1.4])
    for (const z of [-0.54, 0.54])
      box("bench-leg", [x, 0.54, z], [0.11, 1.08, 0.11], palette.steel, bench);
  box("bench-shelf", [0, 0.36, 0], [2.9, 0.08, 1.15], palette.steel, bench);
  const toolBox = box(
    "toolbox",
    [0.45, 0.57, 0],
    [1.1, 0.35, 0.7],
    palette.steelDark,
    bench,
  );
  tag(toolBox, "D2");
  box(
    "toolbox-handle",
    [0.45, 0.8, 0],
    [0.35, 0.08, 0.08],
    palette.cream,
    bench,
  );
  box(
    "vise-base",
    [-1.1, 1.24, 0],
    [0.5, 0.13, 0.45],
    palette.steelDark,
    bench,
  );
  box("vise", [-1.1, 1.4, 0], [0.45, 0.24, 0.35], palette.steel, bench);
  box(
    "bench-cabinet",
    [0.9, 0.66, 0],
    [0.85, 0.92, 1.1],
    palette.machine,
    bench,
  );
  for (const y of [0.38, 0.65, 0.92]) {
    box(
      "drawer-seam",
      [0.9, y, -0.56],
      [0.75, 0.015, 0.012],
      palette.dark,
      bench,
    );
    tube(
      "drawer-handle",
      [
        [0.75, y + 0.1, -0.59],
        [1.05, y + 0.1, -0.59],
      ],
      0.018,
      palette.steelDark,
      undefined,
      bench,
    );
  }
  // Storage rack: one deliberately unstable upper crate.
  const rack = new TransformNode("storage-rack", scene);
  rack.position = new Vector3(4.7, 0, 4.8);
  for (const x of [-1.9, 1.9])
    for (const z of [-0.65, 0.65])
      box("rack-post", [x, 1.9, z], [0.12, 3.8, 0.12], palette.steelDark, rack);
  for (const y of [0.45, 1.55, 2.8]) {
    box("rack-shelf", [0, y, 0], [3.95, 0.12, 1.5], palette.steel, rack);
    box(
      "shelf-lip",
      [0, y + 0.06, -0.78],
      [3.95, 0.17, 0.07],
      palette.ochre,
      rack,
    );
  }
  for (const x of [-1, 0, 1]) {
    box("stored-box", [x, 0.8, 0.1], [0.78, 0.6, 0.85], palette.wood, rack);
    box("label", [x, 0.8, -0.34], [0.2, 0.12, 0.008], palette.cream, rack);
  }
  for (const x of [-1.18, -0.55, 0.1, 0.75]) {
    for (let j = 0; j < 3; j++) {
      const ring = MeshBuilder.CreateTorus(
        "stored-machined-ring",
        { diameter: 0.39, thickness: 0.075, tessellation: 16 },
        scene,
      );
      ring.parent = rack;
      ring.position.set(x, 1.68 + j * 0.085, 0.05);
      ring.material = s.surfaces.solid("#858b80", 1, 0.7, 0.38);
      ring.isPickable = false;
      ring.receiveShadows = true;
      s.shadows.addShadowCaster(ring);
    }
  }
  const crateRoot = new TransformNode("tilted-crate", scene);
  crateRoot.metadata = { objectId: "H3", label: objectLabels.H3 };
  crateRoot.parent = rack;
  crateRoot.position = new Vector3(
    variant === "lecture" ? -1 : 1.1,
    3.1,
    -1.25,
  );
  crateRoot.rotation.x = -0.24;
  crateRoot.rotation.z = 0.09;
  const crate = box(
    "overhanging-crate",
    [0, 0, 0],
    [1.1, 0.8, 1.15],
    "#b69b72",
    crateRoot,
  );
  tag(crate, "H3");
  for (const x of [-0.46, 0.46])
    box("crate-batten", [x, 0, -0.59], [0.08, 0.8, 0.04], "#8a785b", crateRoot);
  for (const y of [-0.3, -0.1, 0.1, 0.3])
    box(
      "crate-plank",
      [0, y, -0.58],
      [1.08, 0.17, 0.022],
      y < 0 ? "#a38a64" : "#b49b73",
      crateRoot,
    );
  for (const x of [-0.46, 0.46])
    for (const y of [-0.31, 0.31])
      cylinder(
        "crate-fastener",
        [x, y, -0.62],
        0.012,
        0.035,
        "#655f4e",
        crateRoot,
      ).rotation.x = Math.PI / 2;
  sign("ДЕТАЛИ", [0, 0.06, -0.613], 0.56, 0.19, "#d7d4ba", crateRoot);
  // Trip cable crossing the marked walking route, with intact insulation.
  const tripZ = variant === "lecture" ? -3.1 : -1.8;
  tube(
    "trip-cable",
    [
      [-3.2, 0.035, tripZ + 0.3],
      [-2.3, 0.04, tripZ],
      [-1.3, 0.05, tripZ - 0.15],
      [-0.5, 0.035, tripZ + 0.12],
      [0.7, 0.035, tripZ],
      [1.7, 0.04, tripZ - 0.28],
    ],
    0.028,
    "#30372e",
    "H1",
  );
  const tripProxy = tube(
    "cable-pick-area",
    [
      [-3.2, 0.035, tripZ + 0.3],
      [-2.3, 0.04, tripZ],
      [-1.3, 0.05, tripZ - 0.15],
      [-0.5, 0.035, tripZ + 0.12],
      [0.7, 0.035, tripZ],
      [1.7, 0.04, tripZ - 0.28],
    ],
    0.23,
    "#30372e",
    "H1",
  );
  tripProxy.isVisible = false;
  // Liquid, visibly distinct from a solid floor stain.
  const spill = MeshBuilder.CreateDisc(
    "liquid",
    { radius: 0.8, tessellation: 48, updatable: true },
    scene,
  );
  spill.position = new Vector3(
    variant === "lecture" ? 2.8 : 1.7,
    0.033,
    variant === "lecture" ? -3.8 : 1.9,
  );
  spill.rotation.x = Math.PI / 2;
  spill.scaling.x = 1.45;
  const spillVertices = spill.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < spillVertices.length; i += 3) {
    const angle = Math.atan2(spillVertices[i + 1], spillVertices[i]);
    const ripple =
      0.9 + 0.065 * Math.sin(angle * 5) + 0.035 * Math.cos(angle * 3);
    spillVertices[i] *= ripple;
    spillVertices[i + 1] *= ripple;
  }
  spill.updateVerticesData(VertexBuffer.PositionKind, spillVertices, true);
  spill.material = s.surfaces.solid("#5d6461", 0.7, 0, 0.08);
  spill.material.backFaceCulling = false;
  tag(spill, "H2");
  const glint = box(
    "liquid-reflection",
    [spill.position.x - 0.15, 0.045, spill.position.z],
    [0.7, 0.008, 0.055],
    "#adb8b6",
  );
  glint.rotation.y = 0.2;
  tag(glint, "H2");
  tube(
    "liquid-glint",
    [
      [spill.position.x - 0.5, 0.048, spill.position.z + 0.18],
      [spill.position.x - 0.25, 0.048, spill.position.z + 0.22],
      [spill.position.x + 0.12, 0.048, spill.position.z + 0.15],
    ],
    0.012,
    "#b2bdbb",
    "H2",
  );
  const trench = box(
    "flush-cable-cover",
    [-0.6, 0.016, -3.5],
    [2.1, 0.012, 0.65],
    "#a0ac9b",
  );
  trench.material = s.surfaces.solid("#85897d", 1, 0.55, 0.62);
  tag(trench, "D3");
  for (const x of [-1.5, 0.3])
    for (const z of [-3.73, -3.27])
      cylinder("cover-fastener", [x, 0.025, z], 0.01, 0.055, palette.dark);
  // Secondary equipment and wall fixtures do not introduce additional hazards.
  const pump = new TransformNode("pump", scene);
  pump.position = new Vector3(7.4, 0, -0.4);
  box("pump-base", [0, 0.12, 0], [1.2, 0.24, 2.1], palette.steelDark, pump);
  const motor = cylinder(
    "motor",
    [0, 0.62, 0.2],
    1.15,
    0.7,
    palette.machine,
    pump,
  );
  motor.rotation.x = Math.PI / 2;
  for (let z = -0.3; z < 0.8; z += 0.15) {
    const fin = cylinder(
      "motor-fin",
      [0, 0.62, z],
      0.04,
      0.79,
      palette.machineLight,
      pump,
    );
    fin.rotation.x = Math.PI / 2;
  }
  tube(
    "pump-pipe",
    [
      [0, 0.5, -0.8],
      [0, 1.9, -0.8],
      [0, 1.9, 0.2],
    ],
    0.11,
    palette.steel,
    undefined,
    pump,
  );
  cylinder("valve", [0, 1.9, -0.8], 0.06, 0.48, palette.orange, pump);
  const lessonCart =
    variant === "lecture"
      ? s.trolley("teaching-cart", [3.4, 0, 1], true)
      : null;
  const lessonPerson =
    variant === "lecture" ? s.human("teaching-worker", [-0.6, 0, -3.8]) : null;
  const lessonNearCart =
    variant === "lecture"
      ? s.trolley("teaching-near-miss", [2.5, 0, -2.6])
      : null;
  lessonCart?.root.setEnabled(false);
  lessonPerson?.root.setEnabled(false);
  lessonNearCart?.root.setEnabled(false);
  box("noticeboard", [-8.65, 2.25, -3], [0.08, 1.3, 1.8], palette.steel);
  for (const z of [-3.55, -3, -2.45])
    box("notice-sheet", [-8.59, 2.3, z], [0.015, 0.75, 0.4], palette.cream);
  contactShadow(scene, 4.8, -3.4, 3.9, 2.3);
  contactShadow(scene, 4.7, 4.8, 4.9, 2.3);
  contactShadow(scene, 7.4, -0.4, 1.7, 2.6);
  s.trolley("parked-trolley", [5.6, 0, -0.7]);
  const arc = new ArcRotateCamera(
    "inspection-orbit",
    -1.02,
    1.13,
    23,
    new Vector3(0, 1.1, 0.25),
    scene,
  );
  arc.lowerRadiusLimit = 6;
  arc.upperRadiusLimit = 28;
  arc.lowerBetaLimit = 0.35;
  arc.upperBetaLimit = 1.48;
  arc.wheelPrecision = 28;
  arc.panningSensibility = 70;
  arc.angularSensibilityX = 350;
  arc.angularSensibilityY = 350;
  arc.inertia = 0.65;
  arc.minZ = 0.1;
  arc.attachControl(canvas, true);
  arc.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  const walk = new UniversalCamera(
    "inspection-walk",
    new Vector3(-0.6, 1.72, -5.9),
    scene,
  );
  walk.minZ = 0.1;
  walk.fov = 1.0;
  walk.speed = 0.18;
  // Lower divisors make mouse drags and touch look respond sooner.
  // Keyboard and pad movement keep their existing speed and timing.
  walk.angularSensibility = 800;
  walk.touchAngularSensibility = 12000;
  walk.inertia = 0;
  walk.inputs.removeByType("FreeCameraKeyboardMoveInput");
  walk.keysUp = [87, 38];
  walk.keysDown = [83, 40];
  walk.keysLeft = [65, 37];
  walk.keysRight = [68, 39];
  walk.ellipsoid = new Vector3(0.35, 0.8, 0.35);
  walk.checkCollisions = true;
  walk.setTarget(new Vector3(-0.6, 1.65, 4.5));
  s.finishCameras([arc, walk]);
  scene.activeCamera = arc;
  let marking = false,
    paused = false,
    mode: "orbit" | "walk" = "orbit",
    chapter = 0,
    lecturePlaying = false;
  let targetGoal = arc.target.clone(),
    radiusGoal = arc.radius,
    alphaGoal = arc.alpha,
    betaGoal = arc.beta,
    transition = false;
  let pad = { x: 0, z: 0 };
  const keys = new Set<string>();
  const keydown = (event: KeyboardEvent) => {
    if (document.activeElement !== canvas || paused) return;
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(event.key)
    ) {
      keys.add(event.key.toLowerCase());
      event.preventDefault();
    }
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const blur = () => {
    keys.clear();
    pad = { x: 0, z: 0 };
  };
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  const zoneViews = {
    all: {
      target: [0, 1.1, 0.25] as Point,
      radius: 23,
      alpha: -1.02,
      beta: 1.13,
    },
    A: {
      target: [-1, 0.8, -2.3] as Point,
      radius: 12,
      alpha: -1.08,
      beta: 1.08,
    },
    B: {
      target: [-5.4, 1.1, 1.45] as Point,
      radius: 10.2,
      alpha: -0.64,
      beta: 1.03,
    },
    C: {
      target: [4.6, 1.65, 3.7] as Point,
      radius: 11.5,
      alpha: -1.6,
      beta: 1.03,
    },
  };
  function setZone(zone: Zone | "all") {
    const view = zoneViews[zone];
    targetGoal = v(view.target);
    radiusGoal = view.radius;
    alphaGoal = view.alpha;
    betaGoal = view.beta;
    transition = true;
    if (mode === "walk") {
      const positions = {
        all: [-0.6, 1.72, -5.9] as Point,
        A: [-0.6, 1.72, -5.2] as Point,
        B: [-6.6, 1.72, -1.6] as Point,
        C: [2.1, 1.72, 0.6] as Point,
      };
      const targets = {
        all: [-0.6, 1.65, 4.5] as Point,
        A: [-0.6, 0.25, -2.2] as Point,
        B: [-6.3, 0.35, 0.95] as Point,
        C: [5.1, 2.15, 4.4] as Point,
      };
      walk.position = v(positions[zone]);
      walk.setTarget(v(targets[zone]));
    }
  }
  const pins: Mesh[] = [];
  function setMarks(marks: Mark[]) {
    pins.splice(0).forEach((mesh) => {
      mesh.material?.dispose(false, true);
      mesh.dispose();
    });
    for (const [i, mark] of marks.entries()) {
      if (mark.source !== "world" || !mark.position) continue;
      const texture = new DynamicTexture(
        "observation-number",
        { width: 256, height: 256 },
        scene,
        false,
      );
      texture.hasAlpha = true;
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 256, 256);
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.fillStyle = "#e5c273";
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#b69b5f";
      ctx.stroke();
      ctx.fillStyle = "#344c34";
      ctx.font = "800 120px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), 128, 134);
      texture.update();
      const pin = MeshBuilder.CreatePlane(
        "observation-pin",
        { width: 0.55, height: 0.55 },
        scene,
      );
      pin.position = v(mark.position).add(new Vector3(0, 0.44, 0));
      pin.billboardMode = Mesh.BILLBOARDMODE_ALL;
      pin.isPickable = false;
      pin.metadata = { nonOccluding: true };
      const mat = new StandardMaterial("observation-pin-material", scene);
      mat.diffuseTexture = texture;
      mat.useAlphaFromDiffuseTexture = true;
      mat.disableLighting = true;
      mat.backFaceCulling = false;
      pin.material = mat;
      pins.push(pin);
    }
  }
  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERTAP || !marking || paused)
      return;
    const { pick, metadata } = pickObject(scene);
    const point = pick?.pickedPoint || Vector3.Zero();
    onSelect({
      objectId: metadata?.objectId || "D0",
      label: metadata?.label || "Участок цеха",
      source: "world",
      position: [point.x, point.y, point.z],
    });
  });
  const down = () => {
    transition = false;
    canvas.focus({ preventScroll: true });
  };
  canvas.addEventListener("pointerdown", down);
  let t = 0;
  let lastTick = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.08, (now - lastTick) / 1000);
    lastTick = now;
    if (paused) return;
    if (variant !== "lecture" || lecturePlaying) t += dt;
    if (transition && mode === "orbit") {
      arc.target = Vector3.Lerp(arc.target, targetGoal, 0.08);
      arc.radius += (radiusGoal - arc.radius) * 0.08;
      arc.alpha += (alphaGoal - arc.alpha) * 0.08;
      arc.beta += (betaGoal - arc.beta) * 0.08;
      if (Vector3.Distance(arc.target, targetGoal) < 0.015) transition = false;
    }
    const dx =
      pad.x +
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const dz =
      pad.z +
      (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    if (dx || dz) {
      transition = false;
      const forward =
        mode === "orbit"
          ? arc.target.subtract(arc.position)
          : walk.getTarget().subtract(walk.position);
      forward.y = 0;
      forward.normalize();
      const right = new Vector3(forward.z, 0, -forward.x);
      const delta = right
        .scale(dx)
        .add(forward.scale(dz))
        .normalize()
        .scale(dt * 2.2);
      if (mode === "orbit") {
        arc.target.addInPlace(delta);
        arc.target.x = Math.max(-7, Math.min(7, arc.target.x));
        arc.target.z = Math.max(-5, Math.min(5, arc.target.z));
      } else walk.cameraDirection.addInPlace(delta);
    }
    if (mode === "walk") {
      walk.position.x = Math.max(-8, Math.min(8, walk.position.x));
      walk.position.z = Math.max(-6, Math.min(6, walk.position.z));
      walk.position.y = 1.72;
    }
    if (variant === "lecture") {
      const time = t % 12;
      if (lessonCart && (chapter === 2 || chapter === 3)) {
        const p = smooth((time - 3) / 7);
        lessonCart.root.position.set(4 - 3 * p, 0, 1);
        lessonCart.root.rotation.y = (Math.PI / 2) * p;
      }
      if (lessonPerson && lessonNearCart && chapter === 4) {
        const p = smooth(time / 6.5);
        lessonNearCart.root.position.set(2.5 - 2.4 * p, 0, -2.3);
        lessonNearCart.root.rotation.y = -Math.PI / 2;
        lessonPerson.root.position.set(
          -0.6,
          0,
          -4.2 +
            2 * smooth(time / 6) -
            (time >= 6 ? 0.65 * smooth((time - 6) / 0.6) : 0),
        );
        lessonPerson.legs.forEach(
          (leg, i) =>
            (leg.rotation.x =
              time < 6.6 ? Math.sin(time * 6 + i * Math.PI) * 0.2 : 0),
        );
      }
    }
    s.render();
  });
  Promise.all([...modelPromises, s.surfaces.ready()]).then(() => {
    if (scene.isDisposed) return;
    if (engine instanceof SoftwareEngine) requestAnimationFrame(onReady);
    else scene.executeWhenReady(onReady);
  });
  return {
    setZone,
    setMarks,
    setMode(next) {
      if (next === mode) return;
      arc.detachControl();
      walk.detachControl();
      mode = next;
      shell.setCutaway(mode === "orbit");
      keys.clear();
      if (mode === "walk") {
        walk.position = new Vector3(-0.6, 1.72, -5.9);
        walk.setTarget(new Vector3(-0.6, 1.65, 4.5));
        walk.attachControl(canvas, true);
        scene.activeCamera = walk;
      } else {
        arc.attachControl(canvas, true);
        scene.activeCamera = arc;
        setZone("all");
      }
      canvas.focus({ preventScroll: true });
    },
    move(x, z) {
      pad = { x, z };
    },
    setMarking(value) {
      marking = value;
      canvas.style.cursor = value ? "crosshair" : "grab";
    },
    setPaused(value) {
      paused = value;
      if (value) {
        keys.clear();
        pad = { x: 0, z: 0 };
        arc.detachControl();
        walk.detachControl();
      } else if (mode === "orbit") arc.attachControl(canvas, true);
      else walk.attachControl(canvas, true);
    },
    setChapter(value) {
      chapter = value;
      t = 0;
      lessonCart?.root.setEnabled(value === 2 || value === 3);
      lessonPerson?.root.setEnabled(value === 4);
      lessonNearCart?.root.setEnabled(value === 4);
      if (variant === "lecture") {
        const views: (Zone | "all")[] = ["all", "A", "C", "C", "A", "B", "all"];
        setZone(views[value] || "all");
      }
    },
    setLecturePlaying(value) {
      lecturePlaying = value;
    },
    dispose() {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("pointerdown", down);
      s.dispose();
    },
  };
}

function smooth(x: number) {
  return (
    Math.max(0, Math.min(1, x)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, x)))
  );
}
export function createEpisode(
  canvas: HTMLCanvasElement,
  id: "V1" | "V2",
  getTime: () => number,
  onSelect: (s: Selection) => void,
  onReady: () => void,
) {
  const s = studio(canvas);
  const { scene, engine, box, sign, tag } = s;
  box("episode-floor", [0, -0.12, 0], [18, 0.24, 13.8], palette.floor);
  const shell = buildWorkshopShell(s);
  shell.setCutaway(false);
  for (const x of [-1.5, 0.4])
    for (let z = -5.8; z < 5.5; z += 0.8)
      box("route-edge", [x, 0.018, z], [0.06, 0.018, 0.6], palette.ochre);
  const camera = new ArcRotateCamera(
    "episode-camera",
    id === "V1" ? -2.15 : -1.95,
    1.22,
    7.2,
    new Vector3(0, 0.85, 0.2),
    scene,
  );
  camera.minZ = 0.1;
  s.finishCameras([camera]);
  scene.activeCamera = camera;
  const cart = s.trolley("episode-cart", [-3, 0, 1], id === "V1");
  let person: ReturnType<typeof s.human> | undefined;
  let operator: ReturnType<typeof s.human> | undefined;
  if (id === "V1") {
    if (cart.load) tag(cart.load, "H5");
    for (const mesh of cart.root.getChildMeshes())
      if (mesh.name === "retaining-strap") tag(mesh as Mesh, "H5");
    box("loading-table", [-3, 1, 3.75], [3, 0.2, 1], palette.wood);
    for (const x of [-4.2, -1.8])
      for (const z of [3.4, 4.1])
        box("table-leg", [x, 0.5, z], [0.13, 1, 0.13], palette.steel);
    person = s.human("cart-operator", [-3, 0, 2]);
  } else {
    const shelf = new TransformNode("view-blocking-rack", scene);
    shelf.position = new Vector3(1.8, 0, -0.5);
    for (const x of [-0.85, 0.85])
      for (const z of [-0.65, 0.65])
        box("rack-post", [x, 1.6, z], [0.13, 3.2, 0.13], palette.steel, shelf);
    for (const y of [0.4, 1.4, 2.4]) {
      box("shelf", [0, y, 0], [1.9, 0.12, 1.5], palette.steel, shelf);
      box(
        "stored-material",
        [0, y + 0.38, 0],
        [1.65, 0.65, 1.3],
        palette.wood,
        shelf,
      );
    }
    person = s.human("pedestrian", [-0.6, 0, -3]);
    operator = s.human("cart-operator", [4.8, 0, 1], -Math.PI / 2);
    for (const mesh of person.root.getChildMeshes()) tag(mesh as Mesh, "H6");
    for (const mesh of cart.root.getChildMeshes()) tag(mesh as Mesh, "H6");
  }
  let marking = false;
  const pinMeshes: Mesh[] = [];
  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERTAP || !marking) return;
    const { pick, metadata } = pickObject(scene);
    const point = pick?.pickedPoint || Vector3.Zero();
    onSelect({
      objectId: metadata?.objectId || "D0",
      label: metadata?.label || "Участок эпизода",
      source: id,
      time: Math.round(getTime() * 100) / 100,
      position: [point.x, point.y, point.z],
    });
  });
  let lastPoseTime = -1;
  engine.runRenderLoop(() => {
    const time = getTime();
    if (time !== lastPoseTime) {
      lastPoseTime = time;
      if (id === "V1") {
        const pose = episode1Pose(time);
        cart.root.position.set(pose.x, 0, pose.z);
        cart.root.rotation.y = pose.angle;
        if (person) {
          const angle = cart.root.rotation.y;
          person.root.position.set(
            cart.root.position.x + Math.cos(angle) + Math.sin(angle) * 0.7,
            0,
            cart.root.position.z - Math.sin(angle) + Math.cos(angle) * 0.7,
          );
          person.root.rotation.y = angle;
          person.legs.forEach(
            (leg, i) =>
              (leg.rotation.x =
                time > 3 && time < 10
                  ? Math.sin(time * 6 + i * Math.PI) * 0.17
                  : 0),
          );
        }
      } else {
        const p = smooth(time / 6.7);
        cart.root.position.set(4 - 4.25 * p, 0, 1);
        cart.root.rotation.y = -Math.PI / 2;
        if (operator) {
          operator.root.position.set(cart.root.position.x + 1.1, 0, 1);
          operator.legs.forEach(
            (leg, i) =>
              (leg.rotation.x =
                time < 6.7 ? Math.sin(time * 6 + i * Math.PI) * 0.2 : 0),
          );
        }
        if (person) {
          let z = -3 + 3.0 * smooth(time / 6);
          if (time >= 6) z -= 0.8 * smooth((time - 6) / 0.7);
          person.root.position.set(-0.6, 0, z);
          person.legs.forEach(
            (leg, i) =>
              (leg.rotation.x =
                time < 6
                  ? Math.sin(time * 6 + i * Math.PI) * 0.25
                  : time < 6.8
                    ? Math.sin(time * 9 + i * Math.PI) * 0.2
                    : 0),
          );
          person.arms.forEach(
            (arm) => (arm.rotation.x = time >= 6 && time < 7 ? -0.65 : 0),
          );
        }
      }
    }
    s.render();
  });
  if (engine instanceof SoftwareEngine) requestAnimationFrame(onReady);
  else scene.executeWhenReady(onReady);
  return {
    setMarking(value: boolean) {
      marking = value;
      canvas.style.cursor = value ? "crosshair" : "default";
    },
    pin(position: Point) {
      pinMeshes.splice(0).forEach((m) => m.dispose());
      const p = sign(
        "•",
        [position[0], position[1] + 0.3, position[2]],
        0.4,
        0.4,
        "#e2be70",
      );
      p.billboardMode = Mesh.BILLBOARDMODE_ALL;
      pinMeshes.push(p);
    },
    dispose: s.dispose,
  };
}
