import { getLibtexprintfRenderer } from "@rat/bun-libtexprintf";
import unicodeit from "unicodeit";
import { type InlineStyle, stylizeMath } from "./style";
import {
  buildLineStarts,
  type LatexSourcemapData,
  type LatexSourcemapSegment,
  rangeFromOffsets,
} from "./sourcemap";

export type {
  LatexSourcemapData,
  LatexSourcemapPoint,
  LatexSourcemapRange,
  LatexSourcemapSegment,
} from "./sourcemap";

interface ParsedSpan {
  value: string;
  end: number;
}

interface Segment {
  type: "text" | "inlineMath" | "displayMath";
  value: string;
  start: number;
  end: number;
}

export interface RenderedLatex {
  text: string;
  sourcemap: LatexSourcemapData;
}

export interface RenderLatexOptions {
  displayRenderer?: (latex: string) => string | Promise<string>;
}

const INLINE_COMMANDS: readonly { cmd: string; style: InlineStyle }[] = [
  { cmd: "\\textbf", style: "bold" },
  { cmd: "\\textit", style: "italic" },
  { cmd: "\\emph", style: "italic" },
];

const DISPLAY_ENVS = ["aligned", "align*", "align"] as const;

function parseBraced(
  source: string,
  openBraceIndex: number,
): { content: string; end: number } | null {
  if (source[openBraceIndex] !== "{") return null;
  let depth = 1;
  let i = openBraceIndex + 1;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    if (depth === 0) {
      return { content: source.slice(openBraceIndex + 1, i), end: i + 1 };
    }
    i += 1;
  }

  return null;
}

function renderInlineCommands(input: string): string {
  let out = "";
  let i = 0;

  while (i < input.length) {
    let matched = false;
    for (const { cmd, style } of INLINE_COMMANDS) {
      if (!input.startsWith(cmd, i)) continue;
      const parsed = parseBraced(input, i + cmd.length);
      if (!parsed) break;
      out += stylizeMath(renderInlineCommands(parsed.content), style);
      i = parsed.end;
      matched = true;
      break;
    }

    if (!matched) {
      out += input[i] ?? "";
      i += 1;
    }
  }

  return out;
}

function isEscapedDollar(source: string, index: number): boolean {
  let backslashes = 0;
  let i = index - 1;
  while (i >= 0 && source[i] === "\\") {
    backslashes += 1;
    i -= 1;
  }
  return backslashes % 2 === 1;
}

function findUnescaped(source: string, needle: string, from: number): number {
  let i = from;
  while (i < source.length) {
    const at = source.indexOf(needle, i);
    if (at === -1) return -1;
    if (!isEscapedDollar(source, at)) return at;
    i = at + needle.length;
  }
  return -1;
}

function tryParseEnv(source: string, from: number): ParsedSpan | null {
  for (const env of DISPLAY_ENVS) {
    const begin = `\\begin{${env}}`;
    if (!source.startsWith(begin, from)) continue;
    const endToken = `\\end{${env}}`;
    const end = source.indexOf(endToken, from + begin.length);
    if (end === -1) return null;
    return { value: source.slice(from, end + endToken.length), end: end + endToken.length };
  }
  return null;
}

function tryParseDoubleDollar(input: string, from: number): ParsedSpan | null {
  if (!input.startsWith("$$", from) || isEscapedDollar(input, from)) return null;
  const end = findUnescaped(input, "$$", from + 2);
  if (end === -1) return null;
  return { value: input.slice(from + 2, end), end: end + 2 };
}

function tryParseBracketDisplay(input: string, from: number): ParsedSpan | null {
  if (!input.startsWith("\\[", from)) return null;
  const end = input.indexOf("\\]", from + 2);
  if (end === -1) return null;
  return { value: input.slice(from + 2, end), end: end + 2 };
}

function tryParseInlineDollar(input: string, from: number): ParsedSpan | null {
  if (input[from] !== "$" || isEscapedDollar(input, from) || input.startsWith("$$", from))
    return null;
  const end = findUnescaped(input, "$", from + 1);
  if (end === -1 || input.startsWith("$$", end)) return null;
  return { value: input.slice(from + 1, end), end: end + 1 };
}

function tryParseInlineParen(input: string, from: number): ParsedSpan | null {
  if (!input.startsWith("\\(", from)) return null;
  const end = input.indexOf("\\)", from + 2);
  if (end === -1) return null;
  return { value: input.slice(from + 2, end), end: end + 2 };
}

function splitSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let textStart = 0;

  const pushText = (end: number): void => {
    if (end > textStart) {
      segments.push({ type: "text", value: input.slice(textStart, end), start: textStart, end });
    }
  };

  while (i < input.length) {
    const display =
      tryParseEnv(input, i) ?? tryParseDoubleDollar(input, i) ?? tryParseBracketDisplay(input, i);
    if (display) {
      pushText(i);
      segments.push({ type: "displayMath", value: display.value, start: i, end: display.end });
      i = display.end;
      textStart = i;
      continue;
    }

    const inline = tryParseInlineDollar(input, i) ?? tryParseInlineParen(input, i);
    if (inline) {
      pushText(i);
      segments.push({ type: "inlineMath", value: inline.value, start: i, end: inline.end });
      i = inline.end;
      textStart = i;
      continue;
    }

    i += 1;
  }

  pushText(input.length);
  return segments;
}

function isLikelyFailedLibtexprintf(input: string, output: string): boolean {
  const inNorm = input.trim();
  const outNorm = output.trim();
  if (!outNorm) return true;
  if (inNorm === outNorm && /\\[A-Za-z]+/.test(inNorm)) return true;
  return false;
}

async function displayToUnicode(
  value: string,
  displayRenderer?: (latex: string) => string | Promise<string>,
): Promise<string> {
  const input = value.replaceAll("\r\n", "\n").trim();
  const render = async (latex: string): Promise<string> =>
    displayRenderer ? await displayRenderer(latex) : (await getLibtexprintfRenderer())(latex);

  try {
    const output = await render(input);
    if (!isLikelyFailedLibtexprintf(input, output)) return output;

    const flattened = input.replaceAll("\n", " ");
    if (flattened !== input) {
      const retry = await render(flattened);
      if (!isLikelyFailedLibtexprintf(flattened, retry)) return retry;
    }

    return unicodeit.replace(input);
  } catch {
    return unicodeit.replace(input);
  }
}

export async function renderLatex(
  input: string,
  options: RenderLatexOptions = {},
): Promise<RenderedLatex> {
  const segments = splitSegments(input);
  const renderedSegments: string[] = [];
  for (const segment of segments) {
    if (segment.type === "text") {
      renderedSegments.push(renderInlineCommands(segment.value));
      continue;
    }
    if (segment.type === "inlineMath") {
      renderedSegments.push(unicodeit.replace(segment.value));
      continue;
    }
    renderedSegments.push(await displayToUnicode(segment.value, options.displayRenderer));
  }

  const text = renderedSegments.join("");
  const inputLineStarts = buildLineStarts(input);
  const outputLineStarts = buildLineStarts(text);
  const sourcemapSegments: LatexSourcemapSegment[] = [];

  let outputOffset = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const sourceSegment = segments[i];
    const rendered = renderedSegments[i] ?? "";
    const outputStart = outputOffset;
    const outputEnd = outputOffset + rendered.length;
    outputOffset = outputEnd;

    if (!sourceSegment || rendered.length === 0) continue;

    sourcemapSegments.push({
      nodeType: sourceSegment.type,
      input: rangeFromOffsets(sourceSegment.start, sourceSegment.end, inputLineStarts),
      output: rangeFromOffsets(outputStart, outputEnd, outputLineStarts),
    });
  }

  return {
    text,
    sourcemap: { version: 2, segments: sourcemapSegments },
  };
}
