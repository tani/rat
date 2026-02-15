import { describe, expect, test } from "bun:test";

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
      sourcemap: {
        version: number;
        segments: unknown[];
      };
      previewLine: number | null;
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
      sourcemap: {
        version: number;
        segments: unknown[];
      };
      previewLine: number | null;
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

  proc.stdin.write(`${JSON.stringify(request)}\n`);
  proc.stdin.end();

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
    sourcemap: {
      version: number;
      segments: unknown[];
    };
    previewLine: number | null;
  };
} {
  return JSON.parse(line) as {
    jsonrpc: string;
    id: number;
    result: {
      text: string;
      sourcemap: {
        version: number;
        segments: unknown[];
      };
      previewLine: number | null;
    };
  };
}

describe("@rat/cli markdown", () => {
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
    expect(parsed.result.sourcemap.version).toBe(2);
    expect(Array.isArray(parsed.result.sourcemap.segments)).toBe(true);
    expect(typeof parsed.result.previewLine).toBe("number");
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

describe("@rat/cli latex stdin", () => {
  test("supports --language=latex mode from stdin", async () => {
    const { out, err, code } = await runStdioRenderLatex("Term: \\(\\alpha^2 + \\beta\\)\n");

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(out).toContain("Term: α² + β");
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
    proc.stdin.write(`${JSON.stringify(request)}\n`);
    proc.stdin.end();
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    const code = await proc.exited;
    const firstLine = out.trim().split("\n")[0] ?? "";
    const parsed = JSON.parse(firstLine) as {
      jsonrpc: string;
      id: number;
      result: {
        text: string;
        sourcemap: { version: number; segments: unknown[] };
        previewLine: number | null;
      };
    };

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(2);
    expect(parsed.result.text).toContain("A: α+β");
    expect(parsed.result.sourcemap.version).toBe(2);
    expect(Array.isArray(parsed.result.sourcemap.segments)).toBe(true);
    expect(typeof parsed.result.previewLine).toBe("number");
  });
});
