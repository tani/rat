import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { remarkRenderTable, renderMarkdownTable } from "./table.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("renderMarkdownTable applies header emphasis, alignment, and wrapping", () => {
  const out = renderMarkdownTable(
    {
      header: ["Name", "Value"],
      align: ["left", "right"],
      rows: [["alpha", "this is a very long value that must wrap"], [
        "beta",
        "42",
      ]],
    },
    { maxWidth: 52, maxCellWidth: 14 },
  );
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
  const model = {
    header: ["A", "B"],
    align: ["left", "left"],
    rows: [["1", "2"]],
  } satisfies Parameters<typeof renderMarkdownTable>[0];
  const single = renderMarkdownTable(model, { style: "single" });
  const double = renderMarkdownTable(model, { style: "double" });
  const rounded = renderMarkdownTable(model, { style: "rounded" });
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

Deno.test("remarkRenderTable rewrites mdast table into unicode code block", async () => {
  const out = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRenderTable, { style: "single", maxWidth: 40 })
    .use(remarkStringify, { fences: false })
    .process("| A | B |\n|---|---:|\n| c | 3 |\n");
  const text = String(out);
  assert(
    text.includes("┌") && text.includes("┘"),
    `rendered table border expected: ${text}`,
  );
  assert(
    !text.includes("| A | B |"),
    `original markdown table should be replaced: ${text}`,
  );
});
