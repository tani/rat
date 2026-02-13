import { renderBlockMath, renderInlineMath } from "./renderer-state.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("renderer-state renders with static renderer or unicode fallback", () => {
  const fallbackInline = renderInlineMath("\\alpha");
  assert(fallbackInline.includes("α"), "inline fallback should use unicodeit");

  const fallbackBlock = renderBlockMath("\\beta");
  assert(fallbackBlock.includes("β"), "block fallback should use unicodeit");
  const inline = renderInlineMath("x+y");
  assert(inline.length > 0, "inline renderer should return non-empty text");
  const block = renderBlockMath("x+y");
  assert(block.length > 0, "block renderer should return non-empty text");
});
