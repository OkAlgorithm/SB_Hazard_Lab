import test from "node:test";
import assert from "node:assert/strict";
import { rasterShadowTriangle, shadowVisibility, workshopPixelRatio } from "./workshop-lighting";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { softwareShadows } from "./software-shadows";
import "./workshop";

test("retina resolution is sharper than CSS resolution and stays within the render budget", () => {
  assert.equal(workshopPixelRatio(800, 500, 1), 1);
  assert.equal(workshopPixelRatio(390, 600, 3), 1.75);
  const ratio = workshopPixelRatio(1600, 1000, 2);
  assert.ok(ratio > 1 && 1600 * 1000 * ratio * ratio <= 2_800_001);
  assert.equal(workshopPixelRatio(3840, 2160, 2), 1);
});

test("a surface behind an occluder is shaded; one in front or outside the map stays lit", () => {
  const depth = new Float32Array(16 * 16).fill(Infinity);
  rasterShadowTriangle(depth, 16, { x: 1, y: 1, z: 2 }, { x: 14, y: 1, z: 2 }, { x: 1, y: 14, z: 2 });
  assert.equal(shadowVisibility(depth, 16, 4, 4, 3), 0);
  assert.equal(shadowVisibility(depth, 16, 4, 4, 1), 1);
  assert.equal(shadowVisibility(depth, 16, 4, 4, 2), 1);
  assert.equal(shadowVisibility(depth, 16, 13, 13, 3), 1);
  assert.equal(shadowVisibility(depth, 16, -1, 4, 3), 1);
});

test("nearer geometry wins regardless of winding or draw order", () => {
  const depth = new Float32Array(16 * 16).fill(Infinity);
  const a = { x: 1, y: 1, z: 1 }, b = { x: 14, y: 1, z: 1 }, c = { x: 1, y: 14, z: 1 };
  rasterShadowTriangle(depth, 16, c, b, a);
  rasterShadowTriangle(depth, 16, { ...a, z: 4 }, { ...b, z: 4 }, { ...c, z: 4 });
  assert.ok(Math.abs(depth[4 * 16 + 4] - 1) < 0.00001);
});

test("a deferred shadow update is applied after an object stops moving", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const box = MeshBuilder.CreateBox("test-occluder", { size: 1 }, scene);
    box.computeWorldMatrix(true);
    const map = softwareShadows(scene);
    assert.equal(map.update(0), true);
    assert.ok(map.depth.some(Number.isFinite));
    box.position.x = 3;
    box.computeWorldMatrix(true);
    assert.equal(map.update(50), false);
    assert.equal(map.update(250), true);
    assert.equal(map.update(500), false);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test("the workshop entry can initialize its hardware ambient-shadow pipeline", () => {
  const engine = new NullEngine();
  // Exercise the graphics-only constructor without requiring a physical GPU.
  engine._features.supportSSAO2 = true;
  engine.getCaps().drawBuffersExtension = true;
  const scene = new Scene(engine);
  try {
    const camera = new FreeCamera("test-camera", Vector3.Zero(), scene);
    new SSAO2RenderingPipeline("test-ambient-shadow", scene, 0.5, [camera]);
    assert.ok(scene.prePassRenderer);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
