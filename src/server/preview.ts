import { renderMarkdown } from "../markdown/processors.ts";
import type { PositionMapEntry } from "../markdown/types.ts";
import {
  MIN_COLS,
  MIN_VIEW_LINES,
  normalizeText,
  type PreviewResult,
  type PreviewViewport,
  splitLines,
  type TerminalSize,
} from "../core/shared.ts";

function buildLineMapping(
  inputText: string,
  outputText: string,
  positionMap: PositionMapEntry[],
): Array<number | null> {
  const inLines = splitLines(inputText);
  const outLines = splitLines(outputText).map((l) => normalizeText(l));
  const map = new Array<number | null>(inLines.length).fill(null);

  for (const entry of positionMap) {
    const a = entry.original;
    const b = entry.formatted;
    const aStart = a?.start?.line;
    const aEnd = a?.end?.line;
    const bStart = b?.start?.line;
    const bEnd = b?.end?.line;
    if (!aStart || !aEnd || !bStart || !bEnd) {
      continue;
    }
    const aLen = Math.max(1, aEnd - aStart);
    const bLen = Math.max(1, bEnd - bStart);
    for (let line = aStart; line <= aEnd; line++) {
      const t = (line - aStart) / aLen;
      map[line - 1] = Math.round(bStart + t * bLen);
    }
  }

  applyExactLineFallback(map, inLines, outLines);
  fillMappingGaps(map);

  return map;
}

function applyExactLineFallback(
  map: Array<number | null>,
  inLines: string[],
  outLines: string[],
): void {
  for (let i = 0; i < inLines.length; i++) {
    if (map[i] !== null) continue;
    const t = normalizeText(inLines[i]);
    if (!t.length) continue;
    const hit = outLines.findIndex((line) => line === t);
    if (hit >= 0) map[i] = hit + 1;
  }
}

function fillMappingGaps(map: Array<number | null>): void {
  for (let i = 0, last = 0; i < map.length; i++) {
    if (map[i] !== null) {
      last = map[i] ?? last;
      continue;
    }
    let next: number | null = null;
    for (let k = i + 1; k < map.length; k++) {
      if (map[k] !== null) {
        next = map[k];
        break;
      }
    }
    map[i] = last === 0
      ? (next === null ? null : Math.max(1, next - 1))
      : (next === null ? last : Math.floor((last + next) / 2));
  }
}

function makeViewport(
  output: string,
  outputLine: number,
  termLines: number,
): PreviewViewport {
  const lines = splitLines(output);
  const maxLine = Math.max(1, lines.length);
  const currentLine = Math.max(1, Math.min(maxLine, outputLine));
  const viewHeight = Math.min(
    maxLine,
    Math.max(MIN_VIEW_LINES, termLines),
  );
  const half = Math.floor(viewHeight / 2);
  let startLine = Math.max(1, currentLine - half);
  const endLine = Math.min(maxLine, startLine + viewHeight - 1);
  startLine = Math.max(1, endLine - viewHeight + 1);
  const clipped = lines.slice(startLine - 1, endLine);

  return {
    text: clipped.join("\n"),
    startLine,
    endLine,
  };
}

export async function buildPreview(
  input: string,
  srcLine: number,
  terminal: TerminalSize,
): Promise<PreviewResult> {
  const rendered = await renderMarkdown(
    input,
    Math.max(MIN_COLS, terminal.cols),
  );
  const output = rendered.markdown;
  const mapping = buildLineMapping(input, output, rendered.positionMap);
  const outputLine = mapping[Math.max(0, srcLine - 1)] ?? srcLine;
  const viewport = makeViewport(
    output,
    outputLine,
    terminal.lines,
  );
  return { viewport, outputLine, terminal };
}
