import { test } from "node:test";
import assert from "node:assert/strict";
import { clipNearPlane } from "./render-math";

test("a triangle crossing the camera near plane remains a visible clipped polygon", () => {
  const result = clipNearPlane(
    [
      { x: -1, y: 0, z: -1, u: 0, v: 0 },
      { x: 1, y: 0, z: 1, u: 1, v: 0 },
      { x: 0, y: 1, z: 1, u: 0.5, v: 1 },
    ],
    0.1,
  );
  assert.equal(result.length, 4);
  assert.ok(
    result.every(
      (p) => p.z >= 0.1 && Number.isFinite(p.x) && Number.isFinite(p.y),
    ),
  );
  assert.equal(result.filter((p) => p.z === 0.1).length, 2);
  assert.ok(
    result.every((p) => p.u! >= 0 && p.u! <= 1 && p.v! >= 0 && p.v! <= 1),
  );
});
test("a triangle fully behind the near plane is discarded while a visible triangle is unchanged", () => {
  assert.deepEqual(
    clipNearPlane(
      [
        { x: 0, y: 0, z: -1 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: -2 },
      ],
      0.1,
    ),
    [],
  );
  const visible = [
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 1 },
    { x: 0, y: 1, z: 1 },
  ];
  assert.deepEqual(clipNearPlane(visible, 0.1), visible);
});
