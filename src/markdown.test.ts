import { renderMarkdown } from "./markdown/processors.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("markdown public exports remain usable", async () => {
  const out = await renderMarkdown("$\\alpha$\n", 40);
  assert(
    out.markdown.includes("α"),
    `expected transformed math from wrapper export: ${out.markdown}`,
  );
  assert(
    Array.isArray(out.positionMap),
    "renderMarkdown should return positionMap",
  );
});
