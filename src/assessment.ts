import content from "./content.json";
import { EPISODE_WINDOWS } from "./episode-timeline";

export const SCENARIO_VERSION = "workshop-01.1";
export const TIME_LIMIT_MS = 240_000;
export type Category = "C1" | "C2" | "C3" | "C4";
export type Zone = "A" | "B" | "C";
export type Source = "world" | "V1" | "V2";
export interface Selection {
  objectId: string;
  label: string;
  source: Source;
  position?: [number, number, number];
  time?: number;
}
export interface Mark extends Selection {
  key: string;
  hazardId: string | null;
  category: Category;
  createdAt: number;
}
export interface Attempt {
  id: string;
  version: string;
  startedAt: number;
  deadline: number | null;
  finishedAt?: number;
  reason?: "manual" | "timeout";
  marks: Mark[];
  videosSeen: string[];
}
const WINDOWS: Record<string, { source: Source; from: number; to: number }> =
  EPISODE_WINDOWS;

export function evaluateSelection(selection: Selection): {
  key: string;
  hazardId: string | null;
} {
  const hazard = content.hazards.find((h) => h.id === selection.objectId);
  let valid = !!hazard;
  const window = WINDOWS[selection.objectId];
  if (window)
    valid =
      selection.source === window.source &&
      selection.time !== undefined &&
      selection.time >= window.from &&
      selection.time <= window.to;
  else valid = valid && selection.source === "world";
  return valid
    ? { key: selection.objectId, hazardId: selection.objectId }
    : {
        key: `false:${selection.source}:${selection.objectId}`,
        hazardId: null,
      };
}
export function createAttempt(timed: boolean, now = Date.now()): Attempt {
  return {
    id: globalThis.crypto?.randomUUID?.() || `attempt-${now}`,
    version: SCENARIO_VERSION,
    startedAt: now,
    deadline: timed ? now + TIME_LIMIT_MS : null,
    marks: [],
    videosSeen: [],
  };
}
export function confirmMark(
  attempt: Attempt,
  selection: Selection,
  category: Category,
  now = Date.now(),
): Attempt {
  if (
    attempt.finishedAt ||
    (attempt.deadline !== null && now >= attempt.deadline)
  )
    return attempt;
  const evaluated = evaluateSelection(selection);
  const existing = attempt.marks.find((m) => m.key === evaluated.key);
  const mark: Mark = {
    ...selection,
    ...evaluated,
    category,
    createdAt: existing?.createdAt ?? now,
  };
  return {
    ...attempt,
    marks: existing
      ? attempt.marks.map((m) => (m.key === mark.key ? mark : m))
      : [...attempt.marks, mark],
  };
}
export function calculateResult(attempt: Attempt) {
  const unique = [...new Map(attempt.marks.map((m) => [m.key, m])).values()];
  const found = unique.filter((m) => m.hazardId !== null);
  const correct = found.filter(
    (m) =>
      content.hazards.find((h) => h.id === m.hazardId)?.category === m.category,
  );
  const falseMarks = unique.filter((m) => m.hazardId === null);
  const score = Math.max(
    0,
    found.length * 10 + correct.length * 5 - falseMarks.length * 5,
  );
  const badge =
    attempt.deadline !== null &&
    found.length === 6 &&
    correct.length === 6 &&
    falseMarks.length === 0 &&
    found.every((m) => m.createdAt < attempt.deadline!);
  return {
    found: found.length,
    correct: correct.length,
    falseCount: falseMarks.length,
    score,
    max: 90,
    badge,
    marks: unique,
  };
}
export function remainingMilliseconds(attempt: Attempt, now = Date.now()) {
  return attempt.deadline === null ? null : Math.max(0, attempt.deadline - now);
}
export function finishAttempt(
  attempt: Attempt,
  reason: "manual" | "timeout" = "manual",
  now = Date.now(),
): Attempt {
  return attempt.finishedAt ? attempt : { ...attempt, finishedAt: now, reason };
}
export const objectLabels: Record<string, string> = {
  H1: "Кабель на полу",
  H2: "Участок пола",
  H3: "Ящик на верхней полке",
  H4: "Кабель у станка",
  H5: "Деталь на тележке",
  H6: "Участок движения",
  D1: "Кожух станка",
  D2: "Ящик с инструментами",
  D3: "Кабельный канал",
  D0: "Участок цеха",
};

export interface PracticeFeedback {
  kind: "correct" | "category" | "unconfirmed";
  title: string;
  body: string;
  category: Category | null;
  mark: Mark;
}

/** Immediate explanations belong to untimed practice only. */
export function practiceFeedbackFor(
  attempt: Attempt,
  key: string,
): PracticeFeedback | null {
  if (attempt.deadline !== null || attempt.finishedAt) return null;
  const mark = attempt.marks.find((m) => m.key === key);
  if (!mark) return null;
  const hazard = content.hazards.find((h) => h.id === mark.hazardId);
  if (hazard) {
    const correct = mark.category === hazard.category;
    return {
      kind: correct ? "correct" : "category",
      title: correct
        ? "Наблюдение подтверждено"
        : "Опасность найдена. Уточните тип.",
      body: hazard.feedback,
      category: hazard.category as Category,
      mark,
    };
  }
  const distractor = content.distractors.find((d) => d.id === mark.objectId);
  return {
    kind: "unconfirmed",
    title: "Для отметки не хватает основания",
    body:
      distractor?.feedback ||
      (mark.source !== "world"
        ? "В выбранном месте и моменте не показан предусмотренный признак. Пересмотрите движение: опасность может появляться только на части эпизода."
        : "В этом участке учебной сцены нет предусмотренного наблюдаемого признака опасности. Сравните своё предположение с тем, что действительно видно."),
    category: null,
    mark,
  };
}
