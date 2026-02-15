import memoizeOne from "memoize-one";

const COMBINING_STRIKE = 0x0336;
const COMBINING_UNDERLINE = 0x0332;

export interface Cursor {
  line: number;
  column: number;
}

export type MappingStrategy = "diff" | "line-anchor" | "line-similarity";

export interface OffsetMapping {
  sourceOffset: number;
  sourceLine: number;
  sourceColumn: number;
  targetOffset: number;
  targetLine: number;
  targetColumn: number;
  strategy: MappingStrategy;
  confidence: number;
}

export interface LineMapping {
  sourceLine: number;
  targetLine: number;
  strategy: MappingStrategy;
  confidence: number;
}

export interface UnicodeSourcemap {
  mapOffset(sourceOffset: number): OffsetMapping;
  mapCursor(cursor: Cursor): OffsetMapping;
  mapLine(sourceLine: number): LineMapping;
  mapLines(): number[];
}

interface NormalizedString {
  text: string;
  mapToOriginal: number[];
  mapToNormalized: number[];
}

function at(matrix: Int32Array[], row: number, col: number): number {
  return matrix[row]?.[col] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getNormalizedChar(code: number): string | null {
  if (code === COMBINING_STRIKE || code === COMBINING_UNDERLINE) return null;

  if (code >= 0x1d5d4 && code <= 0x1d5ed) return String.fromCharCode(code - 120275);
  if (code >= 0x1d5ee && code <= 0x1d607) return String.fromCharCode(code - 120269);
  if (code >= 0x1d7ec && code <= 0x1d7f5) return String.fromCharCode(code - 120764);

  if (code >= 0x1d608 && code <= 0x1d621) return String.fromCharCode(code - 120263);
  if (code >= 0x1d622 && code <= 0x1d63b) return String.fromCharCode(code - 120257);

  if (code >= 0x1d63c && code <= 0x1d655) return String.fromCharCode(code - 120251);
  if (code >= 0x1d656 && code <= 0x1d66f) return String.fromCharCode(code - 120245);

  if (code >= 0x1d670 && code <= 0x1d689) return String.fromCharCode(code - 120239);
  if (code >= 0x1d68a && code <= 0x1d6a3) return String.fromCharCode(code - 120233);
  if (code >= 0x1d7f6 && code <= 0x1d7ff) return String.fromCharCode(code - 120774);

  return String.fromCodePoint(code);
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetToLine(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineStart = lineStarts[mid] ?? 0;
    if (lineStart <= offset) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best + 1;
}

function offsetToColumn(text: string, lineStarts: number[], offset: number): number {
  const line = offsetToLine(lineStarts, offset);
  const lineStart = lineStarts[line - 1] ?? 0;
  const lineEndStart = lineStarts[line] ?? text.length;
  const lineEnd =
    lineEndStart > 0 && text[lineEndStart - 1] === "\n" ? lineEndStart - 1 : lineEndStart;
  return clamp(offset - lineStart + 1, 1, Math.max(1, lineEnd - lineStart + 1));
}

function cursorToOffset(text: string, lineStarts: number[], cursor: Cursor): number {
  if (text.length === 0) return 0;
  const lineIndex = Math.min(Math.max(0, cursor.line - 1), lineStarts.length - 1);
  const lineStart = lineStarts[lineIndex] ?? 0;
  const nextLineStart = lineStarts[lineIndex + 1] ?? text.length;
  const lineEnd =
    nextLineStart > 0 && text[nextLineStart - 1] === "\n" ? nextLineStart - 1 : nextLineStart;
  return Math.min(lineStart + Math.max(0, cursor.column - 1), lineEnd);
}

function lineRange(
  text: string,
  lineStarts: number[],
  line: number,
): { start: number; end: number } {
  const lineIndex = clamp(line - 1, 0, lineStarts.length - 1);
  const start = lineStarts[lineIndex] ?? 0;
  const nextStart = lineStarts[lineIndex + 1] ?? text.length;
  const end = nextStart > 0 && text[nextStart - 1] === "\n" ? nextStart - 1 : nextStart;
  return { start, end };
}

function lineText(text: string, lineStarts: number[], line: number): string {
  const { start, end } = lineRange(text, lineStarts, line);
  return text.slice(start, end);
}

function findLineAnchorOffset(text: string, lineStarts: number[], line: number): number {
  const { start, end } = lineRange(text, lineStarts, line);
  for (let i = start; i < end; i += 1) {
    const char = text[i] ?? "";
    if (/[\p{L}\p{N}]/u.test(char)) return i;
  }
  for (let i = start; i < end; i += 1) {
    const char = text[i] ?? "";
    if (!/\s/.test(char)) return i;
  }
  return start;
}

function normalize(s: string): NormalizedString {
  let text = "";
  const mapToOriginal: number[] = [];
  const mapToNormalized: number[] = Array<number>(s.length).fill(-1);

  let originalIndex = 0;
  for (const char of s) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      originalIndex += char.length;
      continue;
    }

    const normChar = getNormalizedChar(code);

    if (normChar === null) {
      const targetIndex = Math.max(0, text.length - 1);
      for (let k = 0; k < char.length; k += 1) {
        mapToNormalized[originalIndex + k] = targetIndex;
      }
    } else {
      const currentIndex = text.length;
      mapToOriginal.push(...Array<number>(normChar.length).fill(originalIndex));

      text += normChar;

      for (let k = 0; k < char.length; k += 1) {
        mapToNormalized[originalIndex + k] = currentIndex;
      }
    }

    originalIndex += char.length;
  }

  return { text, mapToOriginal, mapToNormalized };
}

function buildEditDistanceTable(a: string, b: string): Int32Array[] {
  const m = a.length;
  const n = b.length;
  const dp: Int32Array[] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 0; i <= m; i += 1) {
    const row = dp[i];
    if (row) row[0] = i;
  }

  const firstRow = dp[0];
  if (firstRow) {
    for (let j = 0; j <= n; j += 1) firstRow[j] = j;
  }

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = dp[i];
      if (!row) continue;
      row[j] = Math.min(at(dp, i - 1, j) + 1, at(dp, i, j - 1) + 1, at(dp, i - 1, j - 1) + cost);
    }
  }

  return dp;
}

const getEditDistanceTable = memoizeOne(buildEditDistanceTable);

function coreTextSourcemap(a: string, b: string, apos: number): number {
  if (apos < 0 || apos >= a.length) {
    if (apos < 0) return 0;
    return b.length;
  }

  const dp = getEditDistanceTable(a, b);

  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (at(dp, i, j) === at(dp, i - 1, j - 1) + cost) {
        if (i - 1 === apos) return j - 1;
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && at(dp, i, j) === at(dp, i - 1, j) + 1) {
      if (i - 1 === apos) return j;
      i -= 1;
      continue;
    }

    if (j > 0 && at(dp, i, j) === at(dp, i, j - 1) + 1) {
      j -= 1;
      continue;
    }

    break;
  }

  return 0;
}

function mapOffsetByDiff(a: string, b: string, apos: number): number {
  const normA = normalize(a);
  const normB = normalize(b);

  let normAPos = 0;
  if (apos >= 0 && apos < normA.mapToNormalized.length) {
    normAPos = normA.mapToNormalized[apos] ?? 0;
  } else if (apos >= normA.mapToNormalized.length) {
    normAPos = normA.text.length;
  }

  const normBPos = coreTextSourcemap(normA.text, normB.text, normAPos);

  if (normBPos >= normB.text.length) return b.length;
  if (normBPos < 0) return 0;

  return normB.mapToOriginal[normBPos] ?? 0;
}

function tokenizeLine(line: string): string[] {
  return line
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function lineSimilarity(sourceLineText: string, targetLineText: string): number {
  const sourceTrimmed = sourceLineText.trim();
  const targetTrimmed = targetLineText.trim();

  if (sourceTrimmed.length === 0 && targetTrimmed.length === 0) return 1;
  if (sourceTrimmed.length === 0 || targetTrimmed.length === 0) return 0;

  if (sourceTrimmed === targetTrimmed) return 1;

  const sourceTokens = tokenizeLine(sourceTrimmed);
  const targetTokens = tokenizeLine(targetTrimmed);

  if (sourceTokens.length === 0 || targetTokens.length === 0) return 0;

  const sourceSet = new Set(sourceTokens);
  const targetSet = new Set(targetTokens);

  let intersection = 0;
  for (const token of sourceSet) {
    if (targetSet.has(token)) intersection += 1;
  }

  const union = sourceSet.size + targetSet.size - intersection;
  if (union === 0) return 0;

  let score = intersection / union;

  const sourceNormalized = sourceTokens.join(" ");
  const targetNormalized = targetTokens.join(" ");
  if (
    sourceNormalized.length >= 4 &&
    (targetNormalized.includes(sourceNormalized) || sourceNormalized.includes(targetNormalized))
  ) {
    score += 0.25;
  }

  return clamp(score, 0, 1);
}

function chooseBestTargetLine(
  sourceLineText: string,
  baseLine: number,
  targetText: string,
  targetLineStarts: number[],
): { targetLine: number; strategy: MappingStrategy; confidence: number } {
  const lineCount = targetLineStarts.length;
  const clampedBaseLine = clamp(baseLine, 1, lineCount);
  const sourceTrimmed = sourceLineText.trim();

  if (sourceTrimmed.length === 0) {
    return { targetLine: clampedBaseLine, strategy: "line-anchor", confidence: 0.5 };
  }

  const windowStart = clamp(clampedBaseLine - 80, 1, lineCount);
  const windowEnd = clamp(clampedBaseLine + 120, 1, lineCount);

  let bestLine = clampedBaseLine;
  let bestScore = -Infinity;
  let bestSimilarity = 0;

  for (let line = windowStart; line <= windowEnd; line += 1) {
    const targetCandidate = lineText(targetText, targetLineStarts, line);
    const similarity = lineSimilarity(sourceLineText, targetCandidate);
    if (similarity === 0) continue;

    const distancePenalty = Math.abs(line - clampedBaseLine) / 220;
    const score = similarity - distancePenalty;

    if (score > bestScore) {
      bestScore = score;
      bestSimilarity = similarity;
      bestLine = line;
    }
  }

  if (bestSimilarity < 0.17) {
    return { targetLine: clampedBaseLine, strategy: "line-anchor", confidence: 0.35 };
  }

  if (bestLine === clampedBaseLine) {
    return { targetLine: clampedBaseLine, strategy: "line-anchor", confidence: bestSimilarity };
  }

  return { targetLine: bestLine, strategy: "line-similarity", confidence: bestSimilarity };
}

export function createUnicodeSourcemap(sourceText: string, targetText: string): UnicodeSourcemap {
  const sourceLineStarts = buildLineStarts(sourceText);
  const targetLineStarts = buildLineStarts(targetText);

  const lineMappingsCache = new Map<number, LineMapping>();

  const mapOffset = (sourceOffset: number): OffsetMapping => {
    const clampedSourceOffset = clamp(sourceOffset, 0, sourceText.length);
    const targetOffset = mapOffsetByDiff(sourceText, targetText, clampedSourceOffset);

    return {
      sourceOffset: clampedSourceOffset,
      sourceLine: offsetToLine(sourceLineStarts, clampedSourceOffset),
      sourceColumn: offsetToColumn(sourceText, sourceLineStarts, clampedSourceOffset),
      targetOffset,
      targetLine: offsetToLine(targetLineStarts, targetOffset),
      targetColumn: offsetToColumn(targetText, targetLineStarts, targetOffset),
      strategy: "diff",
      confidence: 0.25,
    };
  };

  const mapLine = (sourceLine: number): LineMapping => {
    const sourceLineCount = sourceLineStarts.length;
    const clampedSourceLine = clamp(sourceLine, 1, sourceLineCount);

    const cached = lineMappingsCache.get(clampedSourceLine);
    if (cached) return cached;

    const anchorOffset = findLineAnchorOffset(sourceText, sourceLineStarts, clampedSourceLine);
    const anchorMapping = mapOffset(anchorOffset);
    const sourceLineValue = lineText(sourceText, sourceLineStarts, clampedSourceLine);

    const refined = chooseBestTargetLine(
      sourceLineValue,
      anchorMapping.targetLine,
      targetText,
      targetLineStarts,
    );

    const mapping: LineMapping = {
      sourceLine: clampedSourceLine,
      targetLine: refined.targetLine,
      strategy: refined.strategy,
      confidence: refined.confidence,
    };

    lineMappingsCache.set(clampedSourceLine, mapping);
    return mapping;
  };

  const mapCursor = (cursor: Cursor): OffsetMapping => {
    const sourceOffset = cursorToOffset(sourceText, sourceLineStarts, cursor);
    const offsetMapping = mapOffset(sourceOffset);

    if (cursor.column > 1) return offsetMapping;

    const lineMapping = mapLine(cursor.line);
    const { start } = lineRange(targetText, targetLineStarts, lineMapping.targetLine);
    const lineStartColumn = offsetToColumn(targetText, targetLineStarts, start);

    return {
      ...offsetMapping,
      targetOffset: start,
      targetLine: lineMapping.targetLine,
      targetColumn: lineStartColumn,
      strategy: lineMapping.strategy,
      confidence: lineMapping.confidence,
    };
  };

  const mapLines = (): number[] => {
    const sourceLineCount = sourceLineStarts.length;
    const result: number[] = Array<number>(sourceLineCount).fill(1);

    let previous = 1;
    for (let line = 1; line <= sourceLineCount; line += 1) {
      const mapping = mapLine(line);
      const monotonicTarget = Math.max(previous, mapping.targetLine);
      result[line - 1] = monotonicTarget;
      previous = monotonicTarget;
    }

    return result;
  };

  return {
    mapOffset,
    mapCursor,
    mapLine,
    mapLines,
  };
}
