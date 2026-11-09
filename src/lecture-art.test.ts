import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import content from "./content.json";
import { artView, lectureArt, panArt } from "./lecture-art";

test("every lecture scene uses a shipped image and ties every clickable object to that chapter", () => {
  assert.equal(lectureArt.length, content.lecture.length);
  const ids = new Set<string>();
  lectureArt.forEach((scene, i) => {
    assert.equal(scene.chapter, content.lecture[i].id);
    assert.ok(existsSync(`public${scene.image}`), scene.image);
    assert.ok(scene.hotspots.length > 0);
    for (const h of scene.hotspots) {
      assert.ok(!ids.has(h.id), h.id);
      ids.add(h.id);
      assert.ok(content.lecture[i].voice.includes(h.sourceQuote), `${scene.chapter}: ${h.id}`);
      const [x, y, w, height] = h.bounds;
      assert.ok(x >= 0 && y >= 0 && w > 0 && height > 0 && x + w <= 1 && y + height <= 1, h.id);
      assert.ok(h.focus.every(v => v >= 0 && v <= 1), h.id);
      assert.ok(h.zoom > 1 && h.zoom <= 4);
    }
  });
});

test("zoom and pan keep the image covering the frame, including targets near its edges", () => {
  assert.deepEqual(artView(1, 0.9, 0.1), { scale: 1, x: 0, y: 0 });
  for (const scene of lectureArt) for (const h of scene.hotspots) {
    const v = artView(h.zoom, ...h.focus);
    for (const p of [v, panArt(v, 100, -100), panArt(v, -100, 100)]) {
      assert.ok(p.x <= 0 && p.x >= 1 - p.scale);
      assert.ok(p.y <= 0 && p.y >= 1 - p.scale);
    }
  }
  assert.equal(artView(20, 0.5, 0.5).scale, 4);
  assert.equal(artView(-1, 0.5, 0.5).scale, 1);
});
