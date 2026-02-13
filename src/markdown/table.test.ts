import { parseMarkdownTable, renderMarkdownTable } from "./table.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("parseMarkdownTable detects table and escaped pipes", () => {
  const lines = [
    "| Name | Type |",
    "|:-----|-----:|",
    "| a | A \\| B |",
  ];
  const t = parseMarkdownTable(lines, 0);
  assert(!!t, "table should parse");
  if (!t) return;
  assert(t.align[0] === "left", "first column should be left aligned");
  assert(t.align[1] === "right", "second column should be right aligned");
  assert(
    t.rows[0][1].includes("A ¦ B"),
    `escaped pipe should stay in cell: ${t.rows[0][1]}`,
  );
});

Deno.test("parseMarkdownTable accepts short separator rows", () => {
  const t = parseMarkdownTable(
    [
      "| a | b |",
      "| :- | - |",
      "| c | c |",
    ],
    0,
  );
  assert(!!t, "short separator row should still parse as table");
});

Deno.test("renderMarkdownTable applies header emphasis, alignment, and wrapping", () => {
  const t = parseMarkdownTable(
    [
      "| Name | Value |",
      "|:-----|-----:|",
      "| alpha | this is a very long value that must wrap |",
      "| beta | 42 |",
    ],
    0,
  );
  assert(!!t, "table should parse");
  if (!t) return;
  const out = renderMarkdownTable(t, { maxWidth: 52, maxCellWidth: 14 });
  assert(out.includes("\u001b[1m"), `header should be bold: ${out}`);
  assert(out.includes("\u001b[4m"), `header should be underlined: ${out}`);
  assert(out.includes("\n│ alpha"), `left alignment expected: ${out}`);
  assert(
    out.includes("│ beta  │             42 │"),
    `right alignment expected: ${out}`,
  );
  assert(
    out.split("\n").length > 6,
    `wrapped table should produce multiple lines: ${out}`,
  );
});

Deno.test("renderMarkdownTable supports border presets", () => {
  const t = parseMarkdownTable(["| A | B |", "|---|---|", "| 1 | 2 |"], 0);
  assert(!!t, "table should parse");
  if (!t) return;
  const single = renderMarkdownTable(t, { style: "single" });
  const double = renderMarkdownTable(t, { style: "double" });
  const rounded = renderMarkdownTable(t, { style: "rounded" });
  assert(
    single.includes("┌") && single.includes("┘"),
    `single style mismatch: ${single}`,
  );
  assert(
    double.includes("╔") && double.includes("╝"),
    `double style mismatch: ${double}`,
  );
  assert(
    rounded.includes("╭") && rounded.includes("╯"),
    `rounded style mismatch: ${rounded}`,
  );
});
