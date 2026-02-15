#!/usr/bin/env bun
import * as arktype from "arktype";
import { renderLatex } from "@rat/latex-unicode";
import { renderMarkdown } from "@rat/markdown-unicode";
import { createUnicodeSourcemap } from "@rat/unicode-sourcemap";

async function readStdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text();
}

function resolveInputFile(argv: string[]): string | null {
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--language") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) continue;
    return arg;
  }
  return null;
}

async function readCliInput(argv: string[]): Promise<string> {
  const inputFile = resolveInputFile(argv);
  if (!inputFile) return await readStdin();
  return await Bun.file(inputFile).text();
}

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

interface Cursor {
  line: number;
  column: number;
}

interface CursorMapping {
  sourceLine: number;
  sourceColumn: number;
  renderedLine: number;
  renderedColumn: number;
  strategy: string;
  confidence: number;
}

interface RenderParams {
  text: string;
  cursor?: Cursor;
  language?: "markdown" | "latex";
}

const CursorSchema = arktype.type({
  line: "number.integer >= 1",
  column: "number.integer >= 1",
});

const RenderParamsSchema = arktype.type({
  text: "string",
  "cursor?": CursorSchema,
  "language?": "'markdown' | 'latex'",
});

const JsonRpcRequestSchema = arktype.type({
  "jsonrpc?": "string",
  "id?": "string | number | null",
  "method?": "string",
  "params?": "unknown",
});

function parseCursor(value: unknown): Cursor | undefined {
  const parsed = CursorSchema(value);
  if (parsed instanceof arktype.type.errors) return undefined;
  return parsed;
}

function parseRenderParams(value: unknown): RenderParams | undefined {
  const parsed = RenderParamsSchema(value);
  if (parsed instanceof arktype.type.errors) return undefined;
  return {
    text: parsed.text,
    cursor: parseCursor(parsed.cursor),
    language: parsed.language,
  };
}

function resolveCursorMapping(
  sourceText: string,
  renderedText: string,
  cursor: Cursor,
): CursorMapping {
  const mapper = createUnicodeSourcemap(sourceText, renderedText);
  const mapped = mapper.mapCursor(cursor);
  return {
    sourceLine: mapped.sourceLine,
    sourceColumn: mapped.sourceColumn,
    renderedLine: mapped.targetLine,
    renderedColumn: mapped.targetColumn,
    strategy: mapped.strategy,
    confidence: mapped.confidence,
  };
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
  writeJson({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return !(JsonRpcRequestSchema(value) instanceof arktype.type.errors);
}

async function handleRenderRequest(id: JsonRpcId, paramsValue: unknown): Promise<void> {
  const params = parseRenderParams(paramsValue);
  if (!params) {
    writeJsonRpcError(id ?? null, -32602, "Invalid params");
    return;
  }

  if (params.language === "latex") {
    const rendered = await renderLatex(params.text);
    const cursorMapping = params.cursor
      ? resolveCursorMapping(params.text, rendered.text, params.cursor)
      : null;
    writeJsonRpcResult(id, {
      text: rendered.text,
      cursorMapping,
    });
    return;
  }

  const rendered = await renderMarkdown(params.text);
  const cursorMapping = params.cursor
    ? resolveCursorMapping(params.text, rendered.markdown, params.cursor)
    : null;

  writeJsonRpcResult(id, {
    text: rendered.markdown,
    cursorMapping,
  });
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
    for (;;) {
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
      if (!isJsonRpcRequest(parsed)) {
        writeJsonRpcError(null, -32600, "Invalid Request");
        continue;
      }
      requestQueue = requestQueue.then(() => handleJsonRpcRequest(parsed));
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
  const inputFile = resolveInputFile(argv);
  if (inputFile) {
    const lower = inputFile.toLowerCase();
    if (lower.endsWith(".tex") || lower.endsWith(".latex")) return "latex";
  }
  return "markdown";
}

async function main(): Promise<void> {
  if (process.argv.includes("--json-rpc")) {
    await runJsonRpcMode();
    return;
  }
  const input = await readCliInput(process.argv);
  const language = resolveCliLanguage(process.argv);
  if (language === "latex") {
    const rendered = await renderLatex(input);
    process.stdout.write(rendered.text);
  } else {
    const { markdown } = await renderMarkdown(input);
    process.stdout.write(markdown);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
