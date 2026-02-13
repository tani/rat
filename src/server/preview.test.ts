import { buildPreview } from "./preview.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("buildPreview returns mapped viewport and output line", async () => {
  const input = [
    "# Title",
    "",
    "Line A",
    "",
    "$\\alpha$",
    "",
    "| C1 | C2 |",
    "|---|---:|",
    "| x | 3 |",
    "",
  ].join("\n");

  const preview = await buildPreview(input, 5, { lines: 8, cols: 60 });
  assert(
    preview.outputLine >= 1,
    `output line should be positive: ${preview.outputLine}`,
  );
  assert(preview.viewport.startLine >= 1, "viewport start should be >= 1");
  assert(
    preview.viewport.endLine >= preview.viewport.startLine,
    "viewport range invalid",
  );
  assert(
    !preview.viewport.text.endsWith("\n"),
    "viewport text should not end with newline",
  );
  assert(
    preview.viewport.text.includes("α"),
    `expected transformed math in viewport: ${preview.viewport.text}`,
  );
});
