import {
  clampMin,
  normalizeNewlines,
  normalizeTerminal,
  normalizeText,
  splitLines,
  toPosInt,
} from "./shared.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("shared helpers normalize values and text", () => {
  assert(clampMin(3.9, 5) === 5, "clampMin should floor and clamp");
  assert(clampMin(12.9, 5) === 12, "clampMin should floor finite values");
  assert(toPosInt("0", 1) === 1, "toPosInt should clamp to min 1");
  assert(toPosInt("4", 1) === 4, "toPosInt should parse positive integer");

  const terminal = normalizeTerminal(2, 8);
  assert(terminal.lines >= 6, "normalizeTerminal should enforce minimum lines");
  assert(terminal.cols >= 20, "normalizeTerminal should enforce minimum cols");

  assert(normalizeNewlines("a\r\nb") === "a\nb", "CRLF should normalize to LF");
  assert(
    normalizeText("  A   B\n C ", true) === "a b c",
    "normalizeText should condense whitespace and lowercase",
  );

  const lines = splitLines("a\nb\n");
  assert(lines.length === 2, "splitLines should drop trailing empty line");
  assert(lines[1] === "b", "splitLines should preserve content lines");
});
