import { resolveCliMode } from "./mdd.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("resolveCliMode detects server mode", () => {
  const mode = resolveCliMode(["--server", "--port=8800"]);
  assert(mode.kind === "server", `expected server mode, got ${mode.kind}`);
});

Deno.test("resolveCliMode detects file mode", () => {
  const mode = resolveCliMode(["README.md"]);
  assert(mode.kind === "file", `expected file mode, got ${mode.kind}`);
  if (mode.kind !== "file") return;
  assert(
    mode.path === "README.md",
    `expected README.md path, got ${mode.path}`,
  );
});

Deno.test("resolveCliMode detects stdin mode", () => {
  const mode = resolveCliMode([]);
  assert(mode.kind === "stdin", `expected stdin mode, got ${mode.kind}`);
});

Deno.test("resolveCliMode rejects multiple positional args", () => {
  const mode = resolveCliMode(["a.md", "b.md"]);
  assert(mode.kind === "error", `expected error mode, got ${mode.kind}`);
});
