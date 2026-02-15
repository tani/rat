import { expect, test } from "bun:test";
import { createUnicodeSourcemap } from "./index.ts";

test("mapOffset keeps direct matches stable", () => {
  const map = createUnicodeSourcemap("abc", "abc");
  expect(map.mapOffset(0).targetOffset).toBe(0);
  expect(map.mapOffset(1).targetOffset).toBe(1);
  expect(map.mapOffset(2).targetOffset).toBe(2);
});

test("mapOffset supports unicode normalization", () => {
  const map = createUnicodeSourcemap("\u{1d5d4}B", "AB");
  expect(map.mapOffset(0).targetOffset).toBe(0);
  expect(map.mapOffset(1).targetOffset).toBe(0);
  expect(map.mapOffset(2).targetOffset).toBe(1);
});

test("mapLine prefers semantic heading lines over transformed table body", () => {
  const source = [
    "## Table",
    "",
    "| A | B |",
    "| - | - |",
    "| x | y |",
    "",
    "## Horizontal Rule",
    "",
    "---",
    "",
    "## End",
    "",
  ].join("\n");

  const target = [
    "Table",
    "-----",
    "",
    "    ┌───┬───┐",
    "    │ A │ B │",
    "    ├───┼───┤",
    "    │ x │ y │",
    "    └───┴───┘",
    "",
    "Horizontal Rule",
    "---------------",
    "",
    "***",
    "",
    "End",
    "---",
    "",
  ].join("\n");

  const map = createUnicodeSourcemap(source, target);

  expect(map.mapLine(1).targetLine).toBe(1);
  expect(map.mapLine(7).targetLine).toBe(10);
  expect(map.mapLine(11).targetLine).toBe(16);

  const cursor = map.mapCursor({ line: 7, column: 1 });
  expect(cursor.targetLine).toBe(10);
});

test("mapLine is monotonic", () => {
  const map = createUnicodeSourcemap("a\n\n## H\n", "a\n\nH\n-\n");
  const lines = [1, 2, 3, 4];
  let previous = 0;
  for (const line of lines) {
    const target = map.mapLine(line).targetLine;
    expect(target).toBeGreaterThanOrEqual(previous);
    previous = target;
  }
});
