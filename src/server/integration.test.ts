import { parseRenderRequest } from "./request.ts";
import { buildPreview } from "./preview.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("request + preview integration maps and renders", async () => {
  const md = "# T\n\n$\\alpha$\n\n- one\n";
  const encoded = btoa(md);
  const parsed = parseRenderRequest(
    new URL(`http://127.0.0.1/render?b=${encoded}&l=3`),
  );
  assert(parsed.ok, "request should parse");
  if (!parsed.ok) return;
  assert(parsed.source.kind === "text", "expected text source");
  if (parsed.source.kind !== "text") return;
  const preview = await buildPreview(
    parsed.source.content,
    parsed.cursor.line,
    { lines: 8, cols: 60 },
  );
  assert(
    preview.outputLine >= 1,
    `output line should be >=1: ${preview.outputLine}`,
  );
  assert(
    preview.viewport.text.includes("α"),
    `expected rendered alpha: ${preview.viewport.text}`,
  );
});
