import { describe, expect, test } from "bun:test";
import * as arktype from "arktype";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const JsonRpcRenderResultSchema = arktype.type({
  jsonrpc: "string",
  id: "number",
  result: {
    text: "string",
    "cursorMapping?": "unknown",
  },
});

async function runStdioRender(input: string): Promise<{ out: string; err: string; code: number }> {
  const proc = Bun.spawn(["bun", "packages/cli/index.ts"], {
    stdin: new Response(input).body,
    stdout: "pipe",
    stderr: "pipe",
  });

  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { out, err, code };
}

async function runStdioRenderLatex(
  input: string,
): Promise<{ out: string; err: string; code: number }> {
  const proc = Bun.spawn(["bun", "packages/cli/index.ts", "--language=latex"], {
    stdin: new Response(input).body,
    stdout: "pipe",
    stderr: "pipe",
  });

  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { out, err, code };
}

async function runJsonRpcRender(): Promise<{
  parsed: {
    jsonrpc: string;
    id: number;
    result: {
      text: string;
      cursorMapping: {
        sourceLine: number;
        sourceColumn: number;
        renderedLine: number;
        renderedColumn: number;
        strategy: string;
        confidence: number;
      } | null;
    };
  };
  err: string;
  code: number;
}> {
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "render",
    params: {
      text: "# Title\n\n*abc*\n",
      cursor: { line: 1, column: 1 },
    },
  };
  return await runJsonRpcRenderWithRequest(request);
}

async function runJsonRpcRenderWithRequest(request: unknown): Promise<{
  parsed: {
    jsonrpc: string;
    id: number;
    result: {
      text: string;
      cursorMapping: {
        sourceLine: number;
        sourceColumn: number;
        renderedLine: number;
        renderedColumn: number;
        strategy: string;
        confidence: number;
      } | null;
    };
  };
  err: string;
  code: number;
}> {
  const proc = Bun.spawn(["bun", "packages/cli/index.ts", "--json-rpc"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.stdin.write(`${JSON.stringify(request)}\n`);
  await proc.stdin.end();

  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  const firstLine = out.trim().split("\n")[0] ?? "";
  const parsed = parseJsonRpcResult(firstLine);
  return { parsed, err, code };
}

function parseJsonRpcResult(line: string): {
  jsonrpc: string;
  id: number;
  result: {
    text: string;
    cursorMapping: {
      sourceLine: number;
      sourceColumn: number;
      renderedLine: number;
      renderedColumn: number;
      strategy: string;
      confidence: number;
    } | null;
  };
} {
  const isCursorMapping = (
    value: unknown,
  ): value is {
    sourceLine: number;
    sourceColumn: number;
    renderedLine: number;
    renderedColumn: number;
    strategy: string;
    confidence: number;
  } => {
    if (!value || typeof value !== "object") return false;
    return (
      typeof Reflect.get(value, "sourceLine") === "number" &&
      typeof Reflect.get(value, "sourceColumn") === "number" &&
      typeof Reflect.get(value, "renderedLine") === "number" &&
      typeof Reflect.get(value, "renderedColumn") === "number" &&
      typeof Reflect.get(value, "strategy") === "string" &&
      typeof Reflect.get(value, "confidence") === "number"
    );
  };

  const parsed: unknown = JSON.parse(line);
  const validated = JsonRpcRenderResultSchema(parsed);
  if (validated instanceof arktype.type.errors) {
    throw new Error("Invalid JSON-RPC result payload");
  }

  const cursorMapping = isCursorMapping(validated.result.cursorMapping)
    ? validated.result.cursorMapping
    : null;

  return {
    ...validated,
    result: {
      ...validated.result,
      cursorMapping,
    },
  };
}

describe("@rat/cli markdown stdin/json-rpc", () => {
  test("reads from stdin and writes rendered markdown to stdout", async () => {
    const { out, err, code } = await runStdioRender("# Title\n\n*abc*\n");

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(out).toContain("Title\n=====");
    expect(out).toContain("𝘢𝘣𝘤");
  });

  test("supports json-rpc render requests over stdio", async () => {
    const { parsed, err, code } = await runJsonRpcRender();

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result.text).toContain("Title\n=====");
    expect(parsed.result.text).toContain("𝘢𝘣𝘤");
    expect(typeof parsed.result.cursorMapping?.renderedLine).toBe("number");
  });

  test("maps heading cursors to rendered heading lines around transformed blocks", async () => {
    const request = {
      jsonrpc: "2.0",
      id: 3,
      method: "render",
      params: {
        text: "## Table\\n\\n| A | B |\\n| - | - |\\n| x | y |\\n\\n## Horizontal Rule\\n\\n---\\n",
        cursor: { line: 7, column: 1 },
      },
    };
    const { parsed, err, code } = await runJsonRpcRenderWithRequest(request);

    expect(code).toBe(0);
    expect(err).toBe("");
    const line = parsed.result.cursorMapping?.renderedLine ?? 1;
    const renderedLine = parsed.result.text.split("\n")[line - 1] ?? "";
    expect(renderedLine).toContain("Horizontal Rule");
  });

  test("supports --language=markdown from stdin", async () => {
    const proc = Bun.spawn(["bun", "packages/cli/index.ts", "--language=markdown"], {
      stdin: new Response("# Title\n\n*abc*\n").body,
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(out).toContain("Title\n=====");
  });
});

describe("@rat/cli markdown file", () => {
  test("supports markdown file argument", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rat-cli-md-"));
    const file = join(dir, "EXAMPLE_TEXT.md");
    try {
      writeFileSync(file, "# File Title\n\n*abc*\n");
      const proc = Bun.spawn(["bun", "packages/cli/index.ts", file], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      const code = await proc.exited;

      expect(code).toBe(0);
      expect(err).toBe("");
      expect(out).toContain("File Title\n==========");
      expect(out).toContain("𝘢𝘣𝘤");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("@rat/cli latex stdin", () => {
  test("supports --language=latex mode from stdin", async () => {
    const { out, err, code } = await runStdioRenderLatex("Term: \\(\\alpha^2 + \\beta\\)\n");

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(out).toContain("Term: α² + β");
  });

  test("supports latex file argument", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rat-cli-tex-"));
    const file = join(dir, "EXAMPLE_TEXT.md");
    try {
      writeFileSync(file, "Term: \\(\\alpha^2 + \\beta\\)\n");
      const proc = Bun.spawn(["bun", "packages/cli/index.ts", "--language=latex", file], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      const code = await proc.exited;

      expect(code).toBe(0);
      expect(err).toBe("");
      expect(out).toContain("Term: α² + β");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("auto-detects latex mode for .tex file argument", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rat-cli-tex-autodetect-"));
    const file = join(dir, "EXAMPLE_TEXT.tex");
    try {
      writeFileSync(file, "Term: \\(\\alpha^2 + \\beta\\)\n");
      const proc = Bun.spawn(["bun", "packages/cli/index.ts", file], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      const code = await proc.exited;

      expect(code).toBe(0);
      expect(err).toBe("");
      expect(out).toContain("Term: α² + β");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("@rat/cli latex json-rpc", () => {
  test("supports json-rpc render requests with language=latex", async () => {
    const request = {
      jsonrpc: "2.0",
      id: 2,
      method: "render",
      params: {
        text: "A: $\\alpha+\\beta$",
        language: "latex",
        cursor: { line: 1, column: 1 },
      },
    };
    const proc = Bun.spawn(["bun", "packages/cli/index.ts", "--json-rpc"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.stdin.write(`${JSON.stringify(request)}\n`);
    await proc.stdin.end();
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    const code = await proc.exited;
    const firstLine = out.trim().split("\n")[0] ?? "";
    const parsed = parseJsonRpcResult(firstLine);

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(2);
    expect(parsed.result.text).toContain("A: α+β");
    expect(typeof parsed.result.cursorMapping?.renderedLine).toBe("number");
  });
});
