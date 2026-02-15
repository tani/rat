#!/usr/bin/env bun
import { renderLatex } from "@rat/latex-unicode";
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
  language?: "markdown" | "latex";
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
  const languageRaw = value.language;
  let language: "markdown" | "latex" | undefined;
  if (languageRaw !== undefined) {
    if (languageRaw !== "markdown" && languageRaw !== "latex") return undefined;
    language = languageRaw;
  }
  return {
    text: value.text,
    cursor: parseCursor(value.cursor),
    language,
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

function writeJsonRpcResult(id: JsonRpcId, result: unknown): void {
  if (id === undefined) return;
  writeJson({
    jsonrpc: "2.0",
    id,
    result,
  });
}

async function handleRenderRequest(id: JsonRpcId, paramsValue: unknown): Promise<void> {
  const params = parseRenderParams(paramsValue);
  if (!params) {
    writeJsonRpcError(id ?? null, -32602, "Invalid params");
    return;
  }
  if (params.language === "latex") {
    const text = await renderLatex(params.text);
    writeJsonRpcResult(id, { text });
    return;
  }
  const rendered = await renderMarkdown(params.text);
  const previewLine = params.cursor
    ? resolvePreviewLine(rendered.sourcemap, params.cursor.line)
    : null;
  writeJsonRpcResult(id, {
    markdown: rendered.markdown,
    sourcemap: rendered.sourcemap,
    previewLine,
  });
}

async function handleRenderLatexRequest(id: JsonRpcId, paramsValue: unknown): Promise<void> {
  const params = parseRenderParams(paramsValue);
  if (!params) {
    writeJsonRpcError(id ?? null, -32602, "Invalid params");
    return;
  }
  const rendered = await renderLatex(params.text);
  writeJsonRpcResult(id, { text: rendered });
}

function handleShutdownRequest(id: JsonRpcId): void {
  writeJsonRpcResult(id, null);
  process.exit(0);
}

async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<void> {
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    writeJsonRpcError(request.id ?? null, -32600, "Invalid Request");
    return;
  }

  if (request.method === "render") {
    await handleRenderRequest(request.id ?? null, request.params);
    return;
  }

  if (request.method === "renderLatex") {
    await handleRenderLatexRequest(request.id ?? null, request.params);
    return;
  }

  if (request.method === "shutdown") {
    handleShutdownRequest(request.id ?? null);
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

function resolveCliLanguage(argv: string[]): "markdown" | "latex" {
  const eq = argv.find((arg) => arg.startsWith("--language="));
  if (eq) {
    const lang = eq.slice("--language=".length);
    if (lang === "markdown" || lang === "latex") return lang;
    throw new Error(`invalid --language value: ${lang}`);
  }
  const idx = argv.indexOf("--language");
  if (idx !== -1) {
    const lang = argv[idx + 1];
    if (lang === "markdown" || lang === "latex") return lang;
    throw new Error(`invalid --language value: ${lang ?? ""}`);
  }
  // Backward compatibility.
  if (argv.includes("--latex")) return "latex";
  return "markdown";
}

async function main(): Promise<void> {
  if (process.argv.includes("--json-rpc")) {
    await runJsonRpcMode();
    return;
  }
  const input = await readStdin();
  const language = resolveCliLanguage(process.argv);
  if (language === "latex") {
    const rendered = await renderLatex(input);
    process.stdout.write(rendered);
  } else {
    const { markdown } = await renderMarkdown(input);
    process.stdout.write(markdown);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
