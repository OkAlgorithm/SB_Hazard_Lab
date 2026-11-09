import { test } from "node:test";
import assert from "node:assert/strict";
import content from "./content.json";
import {
  createAttempt,
  confirmMark,
  calculateResult,
  remainingMilliseconds,
  finishAttempt,
  evaluateSelection,
  type Category,
  type Selection,
} from "./assessment";
import { episode1Pose } from "./episode-timeline";
const start = 1_000;
function selection(id: string): Selection {
  return {
    objectId: id,
    label: id,
    source: id === "H5" ? "V1" : id === "H6" ? "V2" : "world",
    time: id === "H5" ? 8 : id === "H6" ? 6 : undefined,
  };
}
test("six unique correct findings produce 90 points and the timed badge", () => {
  let a = createAttempt(true, start);
  for (const h of content.hazards)
    a = confirmMark(a, selection(h.id), h.category as Category, start + 100);
  assert.deepEqual(
    [
      calculateResult(a).found,
      calculateResult(a).correct,
      calculateResult(a).score,
      calculateResult(a).badge,
    ],
    [6, 6, 90, true],
  );
});
test("five findings, four correct categories and one false mark produce 65", () => {
  let a = createAttempt(true, start);
  for (const [i, h] of content.hazards.slice(0, 5).entries())
    a = confirmMark(
      a,
      selection(h.id),
      i === 0 ? "C4" : (h.category as Category),
      start + 100,
    );
  a = confirmMark(a, selection("D1"), "C4", start + 200);
  assert.equal(calculateResult(a).score, 65);
  assert.equal(calculateResult(a).falseCount, 1);
});
test("duplicates update categories without multiplying points or penalties", () => {
  let a = createAttempt(true, start);
  a = confirmMark(a, selection("H1"), "C4", start + 100);
  a = confirmMark(a, selection("H1"), "C1", start + 200);
  a = confirmMark(a, selection("D1"), "C1", start + 300);
  a = confirmMark(a, selection("D1"), "C4", start + 400);
  assert.equal(a.marks.length, 2);
  assert.equal(calculateResult(a).score, 10);
});
test("video selection requires both the right clip and the hazardous moment", () => {
  assert.equal(
    evaluateSelection({ ...selection("H5"), time: 2 }).hazardId,
    null,
  );
  assert.equal(
    evaluateSelection({ ...selection("H5"), source: "V2" }).hazardId,
    null,
  );
  assert.equal(
    evaluateSelection({ ...selection("H5"), time: 8 }).hazardId,
    "H5",
  );
  assert.equal(
    evaluateSelection({ ...selection("H6"), time: 6 }).hazardId,
    "H6",
  );
});
test("score cannot go below zero; practice has no timed badge", () => {
  let a = createAttempt(false, start);
  a = confirmMark(a, selection("D1"), "C1", start + 100);
  assert.equal(calculateResult(a).score, 0);
  assert.equal(calculateResult(a).badge, false);
  assert.equal(remainingMilliseconds(a, start + 500_000), null);
});
test("deadline uses elapsed wall time and rejects marks after expiration or finish", () => {
  let a = createAttempt(true, start);
  assert.equal(remainingMilliseconds(a, start + 60_000), 180_000);
  assert.equal(remainingMilliseconds(a, start + 300_000), 0);
  assert.equal(
    confirmMark(a, selection("H1"), "C1", start + 240_000).marks.length,
    0,
  );
  a = finishAttempt(a, "manual", start + 100);
  assert.equal(
    confirmMark(a, selection("H1"), "C1", start + 200).marks.length,
    0,
  );
});
test("visible load intrusion and accepted video interval match", () => {
  for (const t of [0, 3, 5.9, 10.1, 12]) {
    const p = episode1Pose(t);
    assert.equal(
      p.loadMaxX >= -1.5 && p.loadMinX <= 0.4,
      false,
      `outside at ${t}`,
    );
  }
  for (const t of [6.1, 7.5, 9.9]) {
    const p = episode1Pose(t);
    assert.equal(
      p.loadMaxX >= -1.5 && p.loadMinX <= 0.4,
      true,
      `inside at ${t}`,
    );
    assert.equal(
      evaluateSelection({ ...selection("H5"), time: t }).hazardId,
      "H5",
    );
  }
});

import { practiceFeedbackFor } from "./assessment";
test("timed assessment never exposes immediate grading feedback", () => {
  let a = createAttempt(true, start);
  a = confirmMark(a, selection("H1"), "C1", start + 100);
  assert.equal(practiceFeedbackFor(a, "H1"), null);
});
test("untimed practice distinguishes a category error from a false mark", () => {
  let a = createAttempt(false, start);
  a = confirmMark(a, selection("H1"), "C4", start + 100);
  assert.equal(practiceFeedbackFor(a, "H1")?.kind, "category");
  assert.equal(practiceFeedbackFor(a, "H1")?.category, "C1");
  a = confirmMark(a, selection("H1"), "C1", start + 200);
  assert.equal(practiceFeedbackFor(a, "H1")?.kind, "correct");
  a = confirmMark(a, selection("D1"), "C1", start + 300);
  assert.equal(practiceFeedbackFor(a, "false:world:D1")?.kind, "unconfirmed");
});
