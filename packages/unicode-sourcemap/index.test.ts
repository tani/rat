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
  expect(map.mapLine(11).targetLine).toBe(15);

  const cursor = map.mapCursor({ line: 7, column: 1 });
  expect(cursor.targetLine).toBe(10);
});

test("mapLines is monotonic", () => {
  const map = createUnicodeSourcemap("a\n\n## H\n", "a\n\nH\n-\n");
  const lines = map.mapLines();
  for (let i = 1; i < lines.length; i += 1) {
    expect((lines[i] ?? 0) >= (lines[i - 1] ?? 0)).toBe(true);
  }
});

test("mapCursor at line start avoids far jumps from line-similarity", () => {
  const source = "start\ncpfj ldw wmqwpcdy\nend\nxoeogyve\nmbanvvr";
  const target = [
    "start",
    "psssz celdt ukfhah",
    "end",
    "wyfwp idzcx",
    "lshdndg smffsw",
    "svkddoq ltlbcvzu",
    "khmv fingkaqj",
    "gpsop jkyg",
    "yoyagony sviorbil",
    "zaohqrm snav",
    "xtnzzqu oqg",
    "ayljooa pbdcg",
    "olzr jshxwo",
    "tphdgc luqvh",
    "ljsntrh yuwepns",
    "lbv kzrp",
    "moy dvz",
    "dfuwwwc yqoxttl",
    "gmpgeld rffcvzk",
    "dcvgl jshgyt",
    "weh xumb",
    "lxbscth wsbv",
    "gtek tlnsfbnr",
    "gjwphyyr ziftoc",
    "swq ltddjnh",
    "batj lvkow",
    "penf gzkuz",
    "vhkxpf hzidsu",
    "orevkjxw hpedbtf",
    "mqsdbos ijzhufyh",
    "hwuh jbbwnl",
    "kwdkmexh ipcbudxs",
    "kgbiul booi",
    "cpfj ldw wmqwpcdy",
    "wbz",
  ].join("\n");

  const map = createUnicodeSourcemap(source, target);

  const offsetAtLineStart = map.mapOffset(source.indexOf("cpfj ldw wmqwpcdy"));
  const cursorAtLineStart = map.mapCursor({ line: 2, column: 1 });
  const lineLevel = map.mapLine(2);

  expect(lineLevel.strategy).toBe("line-similarity");
  expect(Math.abs(lineLevel.targetLine - offsetAtLineStart.targetLine)).toBeGreaterThan(6);
  expect(cursorAtLineStart.targetLine).toBe(offsetAtLineStart.targetLine);
});
