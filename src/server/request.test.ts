import { parseRenderRequest } from "./request.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("parseRenderRequest validates source and cursor", () => {
  const ok = parseRenderRequest(
    new URL("http://127.0.0.1/render?b=IyB0ZXN0&l=3"),
  );
  assert(ok.ok, "base64 request should parse");
  if (!ok.ok) return;
  assert(ok.source.kind === "text", "source should be text");
  assert(ok.cursor.line === 3, `line should parse: ${ok.cursor.line}`);

  const bad = parseRenderRequest(new URL("http://127.0.0.1/render?l=1"));
  assert(!bad.ok, "missing source should fail");
  if (bad.ok) return;
  assert(
    bad.error === "bad_request",
    `bad request should be bad_request: ${bad.error}`,
  );
});
