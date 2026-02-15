export type LatexSourcemapPoint = {
  line: number;
  column: number;
  offset?: number;
};

export type LatexSourcemapRange = {
  start: LatexSourcemapPoint;
  end: LatexSourcemapPoint;
};

export type LatexSourcemapSegment = {
  nodeType: string;
  output: LatexSourcemapRange;
  input: LatexSourcemapRange;
};

export type LatexSourcemapData = {
  version: 2;
  segments: LatexSourcemapSegment[];
};

export function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function pointFromOffset(offset: number, lineStarts: number[]): LatexSourcemapPoint {
  let lineIndex = 0;
  for (let i = 0; i < lineStarts.length; i += 1) {
    if ((lineStarts[i] ?? 0) <= offset) lineIndex = i;
    else break;
  }
  const lineStart = lineStarts[lineIndex] ?? 0;
  return {
    line: lineIndex + 1,
    column: offset - lineStart + 1,
    offset,
  };
}

export function rangeFromOffsets(
  start: number,
  end: number,
  lineStarts: number[],
): LatexSourcemapRange {
  return {
    start: pointFromOffset(start, lineStarts),
    end: pointFromOffset(Math.max(start, end), lineStarts),
  };
}
