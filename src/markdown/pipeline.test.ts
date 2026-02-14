import { renderMarkdown } from "./pipeline.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("renderMarkdown returns markdown and map with math/mermaid transform", async () => {
  const input = [
    "# T",
    "",
    "| A | B |",
    "|---|---:|",
    "| x | 1 |",
    "",
    "$\\alpha$",
    "",
    "```mermaid",
    "graph TD",
    "A-->B",
    "```",
    "",
    "[OpenAI](https://openai.com/research)",
    "",
  ].join("\n");

  const out = await renderMarkdown(input, 80);
  assert(
    out.markdown.includes("╭") || out.markdown.includes("┌"),
    `table should be rendered to unicode block: ${out.markdown}`,
  );
  assert(
    out.markdown.includes("α"),
    `inline math should be transformed: ${out.markdown}`,
  );
  assert(
    !out.markdown.includes("graph TD"),
    `mermaid source should be transformed: ${out.markdown}`,
  );
  assert(
    out.markdown.includes("[OpenAI](...)"),
    `link destination should be shortened: ${out.markdown}`,
  );
  assert(out.positionMap.length > 0, "positionMap should not be empty");
});

Deno.test("renderMarkdown returns markdown and position map", async () => {
  const input = [
    "# T",
    "",
    "A very long paragraph that is expected to wrap when print width is narrow for prettier formatting.",
    "",
  ].join("\n");
  const out = await renderMarkdown(input, 20);
  assert(
    out.markdown.includes("# T"),
    `markdown should be returned: ${out.markdown}`,
  );
  assert(out.positionMap.length > 0, "positionMap should not be empty");
  const first = out.positionMap[0];
  assert(typeof first.type === "string", "map entry should include node type");
  assert(
    typeof first.text === "string",
    "map entry should include normalized node text",
  );
  assert(
    first.original.start?.line !== undefined,
    "map entry should include original position",
  );
  assert(
    first.formatted.start?.line !== undefined,
    "map entry should include formatted position",
  );
});

Deno.test("renderMarkdown handles large markdown within guardrail", async () => {
  const large = Array.from(
    { length: 120 },
    (_, i) =>
      `- item ${i + 1}: this is a long line to stress formatting and mapping.`,
  ).join("\n");
  const start = Date.now();
  const out = await renderMarkdown(large, 72);
  const elapsed = Date.now() - start;
  assert(out.markdown.length > 0, "large input should produce markdown output");
  assert(
    out.positionMap.length > 0,
    "large input should produce mapping output",
  );
  assert(
    elapsed < 3000,
    `large input processing should stay under 3s, got ${elapsed}ms`,
  );
});

Deno.test("renderMarkdown decodes numeric HTML entities from math renderer", async () => {
  const input = ["$$", "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", "$$", ""].join(
    "\n",
  );
  const out = await renderMarkdown(input, 80);
  assert(
    !out.markdown.includes("&#x20;"),
    `math output should not contain hex space entities: ${out.markdown}`,
  );
  assert(
    !out.markdown.includes("&#32;"),
    `math output should not contain decimal space entities: ${out.markdown}`,
  );
});

Deno.test("renderMarkdown increments ordered list numbering", async () => {
  const input = ["1. one", "1. two", "1. three", ""].join("\n");
  const out = await renderMarkdown(input, 80);
  assert(
    out.markdown.includes("1. one"),
    `expected first item: ${out.markdown}`,
  );
  assert(
    out.markdown.includes("2. two"),
    `expected second item: ${out.markdown}`,
  );
  assert(
    out.markdown.includes("3. three"),
    `expected third item: ${out.markdown}`,
  );
});

Deno.test("renderMarkdown emits indented code blocks without fences", async () => {
  const input = [
    "```ts",
    "export const x = 1;",
    "```",
    "",
    "```bash",
    "echo hi",
    "```",
    "",
  ].join("\n");
  const out = await renderMarkdown(input, 80);
  assert(
    !out.markdown.includes("```"),
    `fences should be removed: ${out.markdown}`,
  );
  assert(
    out.markdown.includes("    export const x = 1;"),
    `ts code should be indented: ${out.markdown}`,
  );
  assert(
    out.markdown.includes("    echo hi"),
    `bash code should be indented: ${out.markdown}`,
  );
});
