import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

type Point = [number, number, number];
interface Builders {
  scene: Scene;
  shadows: ShadowGenerator;
  box: (
    name: string,
    pos: Point,
    size: Point,
    hex: string,
    parent?: TransformNode,
  ) => Mesh;
  cylinder: (
    name: string,
    pos: Point,
    height: number,
    diameter: number,
    hex: string,
    parent?: TransformNode,
    tessellation?: number,
  ) => Mesh;
  tube: (
    name: string,
    points: Point[],
    radius: number,
    hex: string,
    id?: string,
    parent?: TransformNode,
  ) => Mesh;
  sign: (
    text: string,
    pos: Point,
    width?: number,
    height?: number,
    hex?: string,
    parent?: TransformNode,
    flat?: boolean,
  ) => Mesh;
  material: (hex: string, alpha?: number) => PBRMaterial;
}

/** A complete room in walking mode; the near walls and ceiling lift for overview. */
export function buildWorkshopShell(s: Builders) {
  const { scene, box, cylinder, tube, sign, material } = s;
  const cutaway: Mesh[] = [];
  box("back-wall-lower", [0, 0.84, 6.72], [18, 1.68, 0.24], "#d2cfc1");
  box("back-wall-upper", [0, 5.7, 6.72], [18, 2.2, 0.24], "#d2cfc1");
  box("wall-lower-band", [0, 0.74, 6.565], [17.8, 1.48, 0.035], "#84917d");
  box("left-wall-lower", [-8.85, 0.84, 0], [0.24, 1.68, 13.7], "#d2cfc1");
  box("left-wall-upper", [-8.85, 5.7, 0], [0.24, 2.2, 13.7], "#d2cfc1");
  box("wall-lower-band", [-8.7, 0.74, 0], [0.035, 1.48, 13.5], "#84917d");
  const glass = material("#cad6d3", 0.28);
  glass.roughness = 0.32;
  glass.metallic = 0;
  const daylight = new StandardMaterial("daylight-beyond-windows", scene);
  daylight.diffuseColor = Color3.FromHexString("#d4dde0");
  daylight.emissiveColor = Color3.FromHexString("#b7c4c5");
  daylight.disableLighting = true;
  function windowFrame(axis: "left" | "back", centre: number, width: number) {
    const left = axis === "left";
    const p = (horizontal: number, y: number, depth: number): Point =>
      left ? [depth, y, horizontal] : [horizontal, y, depth];
    const size = (w: number, h: number, d: number): Point =>
      left ? [d, h, w] : [w, h, d];
    const depth = left ? -8.68 : 6.55;
    for (const h of [-width / 2, 0, width / 2])
      box(
        "window-mullion",
        p(centre + h, 3.15, depth),
        size(0.055, 2.94, 0.09),
        "#4a514b",
      );
    for (const y of [1.69, 2.65, 3.62, 4.61])
      box(
        "window-transom",
        p(centre, y, depth),
        size(width + 0.1, 0.055, 0.09),
        "#4a514b",
      );
    for (const h of [-width / 4, width / 4])
      for (const y of [2.17, 3.14, 4.12]) {
        const pane = box(
          "window-glass",
          p(centre + h, y, depth + (left ? -0.055 : 0.055)),
          size(width / 2 - 0.06, 0.91, 0.015),
          "#ced9d4",
        );
        pane.material = glass;
        s.shadows.removeShadowCaster(pane);
        pane.checkCollisions = false;
      }
    const outside = box(
      "window-daylight",
      p(centre, 3.15, depth + (left ? -0.22 : 0.22)),
      size(width, 2.87, 0.015),
      "#d4dde0",
    );
    outside.material = daylight;
    s.shadows.removeShadowCaster(outside);
    outside.dispose();
    box(
      "window-sill",
      p(centre, 1.65, depth + (left ? 0.05 : -0.05)),
      size(width + 0.18, 0.09, 0.3),
      "#c0bfb0",
    );
  }
  for (const z of [-4.95, -1.65, 1.65, 4.95]) windowFrame("left", z, 2.72);
  for (const z of [-6.65, -3.3, 0, 3.3, 6.65])
    box("left-wall-pier", [-8.85, 3.15, z], [0.24, 3.0, 0.53], "#d2cfc1");
  for (const x of [-5.5, -1.4]) windowFrame("back", x, 3.35);
  // A modest yard beyond the real window openings provides depth and context.
  // These are distant 3D structures, not a flat workshop background.
  for (const [position, size] of [
    [
      [-38, 12, 0],
      [0.2, 32, 90],
    ],
    [
      [0, 12, 38],
      [90, 32, 0.2],
    ],
  ] as [Point, Point][]) {
    const sky = box("courtyard-sky", position, size, "#cdd7d7");
    sky.material = daylight;
    sky.checkCollisions = false;
    s.shadows.removeShadowCaster(sky);
  }
  box("courtyard-building-wall", [-29, 2.5, 0], [3, 5, 76], "#b8b6a8");
  box("courtyard-building-wall", [0, 2.7, 26], [76, 5.4, 4], "#b8b6a8");
  box("courtyard-roof", [0, 5.5, 26], [77, 0.16, 4.5], "#6b746d");
  for (let x = -30; x <= 30; x += 4) {
    box("courtyard-window", [x, 3.05, 23.98], [2.4, 2, 0.025], "#899d9b");
    box("courtyard-window-bar", [x, 3.05, 23.95], [0.07, 2, 0.025], "#56645d");
  }
  for (let z = -30; z <= 30; z += 4)
    box("courtyard-window", [-27.48, 2.8, z], [0.025, 2.1, 2.4], "#899d9b");
  cylinder(
    "courtyard-stack",
    [-7.2, 8.5, 29],
    17,
    1.25,
    "#c4c2b6",
    undefined,
    20,
  );
  for (const y of [12.4, 15.4])
    cylinder(
      "courtyard-stack-band",
      [-7.2, y, 29],
      1.2,
      1.265,
      "#a06f5f",
      undefined,
      20,
    );
  for (const [x, w] of [
    [-8.17, 1.65],
    [-3.45, 0.75],
    [4.5625, 8.575],
  ])
    box("back-wall-pier", [x, 3.15, 6.72], [w, 3.0, 0.24], "#d2cfc1");

  cutaway.push(box("right-wall", [8.85, 3.4, 0], [0.24, 6.8, 13.8], "#d2cfc1"));
  cutaway.push(
    box("wall-lower-band", [8.7, 0.74, 0], [0.035, 1.48, 13.5], "#84917d"),
  );
  cutaway.push(
    box("entry-wall", [-5.15, 3.4, -6.76], [7.4, 6.8, 0.2], "#d2cfc1"),
  );
  cutaway.push(
    box("entry-wall", [5.55, 3.4, -6.76], [6.6, 6.8, 0.2], "#d2cfc1"),
  );
  cutaway.push(
    box("entry-wall-header", [0.55, 5.0, -6.76], [3.9, 3.6, 0.2], "#d2cfc1"),
  );
  cutaway.push(
    box("ceiling-panel", [0, 6.84, 0], [17.9, 0.13, 13.7], "#cac7b9"),
  );
  // Steel frame, baseplates, I sections and roof ties.
  for (const x of [-8.5, 8.5])
    for (const z of [-6.4, 0, 6.4]) {
      box("column-web", [x, 3.35, z], [0.13, 6.7, 0.28], "#414c46");
      for (const dx of [-0.15, 0.15])
        box("column-flange", [x + dx, 3.35, z], [0.045, 6.7, 0.35], "#414c46");
      box("column-baseplate", [x, 0.06, z], [0.55, 0.12, 0.6], "#3b443e");
      for (const dx of [-0.19, 0.19])
        for (const dz of [-0.21, 0.21])
          cylinder(
            "column-bolt",
            [x + dx, 0.14, z + dz],
            0.05,
            0.065,
            "#6f736a",
            undefined,
            8,
          );
    }
  for (const z of [-5.5, 0, 5.5]) {
    box("roof-web", [0, 6.34, z], [17.4, 0.28, 0.065], "#454c45");
    for (const y of [6.19, 6.49])
      box("roof-flange", [0, y, z], [17.4, 0.045, 0.25], "#454c45");
    for (const x of [-6, -2, 2, 6])
      tube(
        "roof-brace",
        [
          [x - 1.8, 6.52, z],
          [x, 6.78, z],
          [x + 1.8, 6.52, z],
        ],
        0.035,
        "#525b51",
      );
  }
  for (const x of [-5.8, 1.0, 6])
    tube(
      "ceiling-conduit",
      [
        [x, 6.66, -6.5],
        [x, 6.66, 6.5],
      ],
      0.025,
      "#666d61",
    );
  // Ducting and supported service pipes stay outside the walking route.
  tube(
    "ventilation-duct",
    [
      [7.9, 5.9, -6.2],
      [7.9, 5.9, 4.7],
      [7.9, 5.3, 5.9],
      [2.1, 5.3, 5.9],
    ],
    0.23,
    "#999e95",
  );
  for (const z of [-4, -1, 2, 4]) {
    const collar = cylinder(
      "duct-collar",
      [7.9, 5.9, z],
      0.06,
      0.49,
      "#737a70",
    );
    collar.rotation.x = Math.PI / 2;
    tube(
      "duct-hanger",
      [
        [7.55, 6.75, z],
        [7.55, 5.85, z],
        [8.25, 5.85, z],
        [8.25, 6.75, z],
      ],
      0.014,
      "#575f55",
    );
  }
  tube(
    "service-pipe",
    [
      [-8.55, 5.1, -6.3],
      [-8.55, 5.1, 6.3],
      [8.4, 5.1, 6.3],
    ],
    0.055,
    "#5d6a5d",
  );
  for (const z of [-5, -1, 3, 5])
    box("pipe-bracket", [-8.54, 5.1, z], [0.28, 0.25, 0.04], "#4c574d");
  // Radiator fins beneath windows, with supported closed pipes.
  for (const z of [-1.6, 4.8]) {
    tube(
      "radiator-pipe",
      [
        [-8.48, 0.3, z - 1.1],
        [-8.48, 1.03, z - 1.1],
        [-8.48, 1.03, z + 1.1],
        [-8.48, 0.3, z + 1.1],
      ],
      0.028,
      "#bcbcaf",
    );
    for (let i = 0; i < 15; i++)
      box(
        "radiator-fin",
        [-8.42, 0.65, z - 0.98 + i * 0.14],
        [0.18, 0.72, 0.065],
        "#c4c3b5",
      );
  }
  for (const z of [-3.4, 2.3])
    for (const x of [-3.8, 3.5]) {
      tube(
        "luminaire-hanger",
        [
          [x, 6.7, z],
          [x, 5.65, z],
        ],
        0.013,
        "#4c534b",
      );
      const shade = MeshBuilder.CreateCylinder(
        "pendant-shade",
        {
          height: 0.18,
          diameterTop: 0.18,
          diameterBottom: 0.5,
          tessellation: 20,
        },
        scene,
      );
      shade.position.set(x, 5.56, z);
      shade.material = material("#676f6b");
      shade.isPickable = false;
      const diffuser = cylinder(
        "light-diffuser",
        [x, 5.46, z],
        0.025,
        0.43,
        "#e4dfc5",
      );
      const glow = new StandardMaterial("warm-light-diffuser", scene);
      glow.diffuseColor = Color3.FromHexString("#fff1d3");
      glow.emissiveColor = Color3.FromHexString("#fff1d3");
      glow.disableLighting = true;
      diffuser.material = glow;
    }
  // Closed electrical cabinet and neat wall conduits.
  box("electrical-cabinet", [2.0, 1.35, 6.16], [2.15, 2.7, 0.65], "#858e79");
  for (const x of [1.47, 2.53]) {
    box("cabinet-door", [x, 1.39, 5.815], [1.02, 2.56, 0.025], "#858e79");
    for (let i = 0; i < 5; i++)
      box(
        "cabinet-vent",
        [x, 2.26 - i * 0.065, 5.791],
        [0.55, 0.022, 0.009],
        "#3a4339",
      );
    box(
      "cabinet-handle",
      [x + 0.34, 1.25, 5.764],
      [0.045, 0.21, 0.045],
      "#3d463b",
    );
  }
  sign("⚡", [2.0, 1.8, 5.775], 0.25, 0.32, "#e3c45f");
  for (const x of [0.75, 3.3])
    tube(
      "wall-conduit",
      [
        [x, 0.3, 6.49],
        [x, 4.9, 6.49],
        [x - 1.3, 4.9, 6.49],
      ],
      0.025,
      "#8c9486",
    );
  sign("УЧАСТОК № 03", [5.3, 4.35, 6.52], 2.7, 0.4, "#c4c5b4");
  return {
    setCutaway(value: boolean) {
      for (const mesh of cutaway) mesh.setEnabled(!value);
    },
  };
}

/** Subtle baked contact darkening, also available in the software renderer. */
export function contactShadow(
  scene: Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  opacity = 0.27,
) {
  // Concentric transparent meshes avoid a texture-dependent shadow in fallback mode.
  for (let i = 0; i < 5; i++) {
    const mat = new StandardMaterial("contact-shadow-" + i, scene);
    mat.diffuseColor = Color3.FromHexString("#24291e");
    mat.emissiveColor = Color3.FromHexString("#24291e");
    mat.disableLighting = true;
    mat.alpha = opacity * 0.16;
    mat.backFaceCulling = false;
    const disc = MeshBuilder.CreateDisc(
      "contact-shadow",
      { radius: 1, tessellation: 32 },
      scene,
    );
    const scale = 1 - i * 0.11;
    disc.scaling.set(width * 0.5 * scale, depth * 0.5 * scale, 1);
    disc.rotation.x = Math.PI / 2;
    disc.position = new Vector3(x, 0.006 + i * 0.001, z);
    disc.material = mat;
    disc.isPickable = false;
    disc.metadata = { nonOccluding: true };
  }
}
