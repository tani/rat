import { main, parseArgs } from "./main.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("main module exports callable entrypoint and parses args", () => {
  assert(typeof main === "function", "main export should be a function");
  assert(
    parseArgs(["--port=8800"]).port === 8800,
    "parseArgs should parse explicit port",
  );
  assert(
    parseArgs(["--port=x"]).port > 0,
    "parseArgs should fallback for invalid port",
  );
});
