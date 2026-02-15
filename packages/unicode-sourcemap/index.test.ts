import { expect, test } from "bun:test";
import { unicodeSourcemap } from "./index.ts";

test("exact match", () => {
  const a = "abc";
  const b = "abc";
  expect(unicodeSourcemap(a, b, 0)).toBe(0);
  expect(unicodeSourcemap(a, b, 1)).toBe(1);
  expect(unicodeSourcemap(a, b, 2)).toBe(2);
});

test("deletion", () => {
  const a = "abc";
  const b = "ac";
  // 'b' is deleted
  expect(unicodeSourcemap(a, b, 0)).toBe(0); // a -> a
  expect(unicodeSourcemap(a, b, 1)).toBe(1); // b -> (deleted at 1) maps to next char 'c' which is at 1
  expect(unicodeSourcemap(a, b, 2)).toBe(1); // c -> c
});

test("insertion", () => {
  const a = "ac";
  const b = "abc";
  // 'b' is inserted at 1
  expect(unicodeSourcemap(a, b, 0)).toBe(0); // a -> a
  expect(unicodeSourcemap(a, b, 1)).toBe(2); // c -> c
});

test("substitution", () => {
  const a = "abc";
  const b = "abd";
  // c -> d
  expect(unicodeSourcemap(a, b, 0)).toBe(0);
  expect(unicodeSourcemap(a, b, 1)).toBe(1);
  expect(unicodeSourcemap(a, b, 2)).toBe(2);
});

test("unicode normalization (Bold)", () => {
  // "𝐀" (Bold A) -> "A"
  const a = "\u{1d5d4}";
  const b = "A";
  expect(unicodeSourcemap(a, b, 0)).toBe(0);
  expect(unicodeSourcemap(a, b, 1)).toBe(0); // Surrogate pair, both point to same normalized char
});

test("unicode normalization (Italic)", () => {
  // "𝐴" (Italic A) -> "A"
  const a = "\u{1d608}";
  const b = "A";
  expect(unicodeSourcemap(a, b, 0)).toBe(0);
});

test("unicode normalization (Combining)", () => {
  // "A\u0336" (A with strike) -> "A"
  const a = "A\u0336";
  const b = "A";

  // a[0] ('A') -> b[0] ('A')
  expect(unicodeSourcemap(a, b, 0)).toBe(0);

  // a[1] ('\u0336') -> should map to 'A' as it is attached to it?
  // Normalized 'a' is "A". '\u0336' is removed.
  // apos=1 maps to norm_apos=0.
  // norm_apos=0 maps to norm_bpos=0.
  // norm_bpos=0 maps to b[0].
  expect(unicodeSourcemap(a, b, 1)).toBe(0);
});

test("unicode match", () => {
  // "𝐀" -> "𝐀"
  // Both normalize to "A".
  const a = "\u{1d5d4}";
  const b = "\u{1d5d4}";

  // a[0] -> A -> A -> b[0]
  expect(unicodeSourcemap(a, b, 0)).toBe(0);
});

test("mixed normalization", () => {
  // a = "𝐀B" (Bold A, B)
  // b = "AB" (Normal A, B)
  const a = "\u{1d5d4}B";
  const b = "AB";

  // a[0] (Bold A high surrogate) -> A -> A -> b[0]
  expect(unicodeSourcemap(a, b, 0)).toBe(0);
  // a[1] (Bold A low surrogate) -> A -> A -> b[0]
  expect(unicodeSourcemap(a, b, 1)).toBe(0);
  // a[2] ('B') -> B -> B -> b[1]
  expect(unicodeSourcemap(a, b, 2)).toBe(1);
});

test("out of bounds", () => {
  expect(unicodeSourcemap("abc", "abc", -1)).toBe(0);
  expect(unicodeSourcemap("abc", "abc", 100)).toBe(3);
});
