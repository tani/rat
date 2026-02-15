#!/usr/bin/env bun
import { renderMarkdown } from "@rat/markdown-unicode";

async function readStdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text();
}

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type Cursor = {
  line: number;
  column: number;
};

type RenderParams = {
  text: string;
  cursor?: Cursor;
};

type SourcemapSegment = {
  output: {
    start: {
      line: number;
    };
  };
  input: {
    start: {
      line: number;
    };
    end: {
      line: number;
    };
  };
};

type SourcemapData = {
  version: 2;
  segments: SourcemapSegment[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCursor(value: unknown): Cursor | undefined {
  if (!isObject(value)) return undefined;
  const line = value.line;
  const column = value.column;
  if (typeof line !== "number" || !Number.isFinite(line)) return undefined;
  if (typeof column !== "number" || !Number.isFinite(column)) return undefined;
  return {
    line: Math.max(1, Math.trunc(line)),
    column: Math.max(1, Math.trunc(column)),
  };
}

function parseRenderParams(value: unknown): RenderParams | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.text !== "string") return undefined;
  return {
    text: value.text,
    cursor: parseCursor(value.cursor),
  };
}

function resolvePreviewLine(sourcemap: SourcemapData, sourceLine: number): number {
  const candidate = sourcemap.segments.find((segment) => {
    const start = segment.input.start.line;
    const end = segment.input.end.line;
    return sourceLine >= start && sourceLine <= end;
  });
  if (candidate) return candidate.output.start.line;
  return sourceLine;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeJsonRpcError(id: JsonRpcId, code: number, message: string): void {
  writeJson({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<void> {
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    writeJsonRpcError(request.id ?? null, -32600, "Invalid Request");
    return;
  }

  if (request.method === "render") {
    const params = parseRenderParams(request.params);
    if (!params) {
      writeJsonRpcError(request.id ?? null, -32602, "Invalid params");
      return;
    }
    const rendered = await renderMarkdown(params.text);
    const previewLine = params.cursor
      ? resolvePreviewLine(rendered.sourcemap, params.cursor.line)
      : null;
    if (request.id !== undefined) {
      writeJson({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          markdown: rendered.markdown,
          sourcemap: rendered.sourcemap,
          previewLine,
        },
      });
    }
    return;
  }

  if (request.method === "shutdown") {
    if (request.id !== undefined) {
      writeJson({
        jsonrpc: "2.0",
        id: request.id,
        result: null,
      });
    }
    process.exit(0);
  }

  writeJsonRpcError(request.id ?? null, -32601, "Method not found");
}

async function runJsonRpcMode(): Promise<void> {
  const decoder = new TextDecoder();
  const reader = Bun.stdin.stream().getReader();
  let buffer = "";
  let requestQueue = Promise.resolve();

  const processBufferedLines = (): void => {
    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) return;
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length === 0) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        writeJsonRpcError(null, -32700, "Parse error");
        continue;
      }
      requestQueue = requestQueue.then(() => handleJsonRpcRequest(parsed as JsonRpcRequest));
    }
  };

  const readNext = async (): Promise<void> => {
    const { value, done } = await reader.read();
    if (done) {
      await requestQueue;
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    processBufferedLines();
    await readNext();
  };

  await readNext();
}

async function main(): Promise<void> {
  if (process.argv.includes("--json-rpc")) {
    await runJsonRpcMode();
    return;
  }
  const input = await readStdin();
  const { markdown } = await renderMarkdown(input);
  process.stdout.write(markdown);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
