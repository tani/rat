export type TerminalSize = { lines: number; cols: number };
export type PreviewViewport = {
  text: string;
  startLine: number;
  endLine: number;
};
export type PreviewResult = {
  viewport: PreviewViewport;
  outputLine: number;
  terminal: TerminalSize;
};
export type Cursor = { line: number };
export type Source =
  | { kind: "text"; content: string }
  | { kind: "path"; path: string };

export const DEFAULT_PORT = 8787;
export const MIN_LINES = 6;
export const MIN_COLS = 20;
export const MIN_VIEW_LINES = 6;

export const clampMin = (value: number, min: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min;

export const toPosInt = (value: unknown, fallback = 1): number =>
  clampMin(Number(value ?? fallback), 1);

export const normalizeTerminal = (
  lines: number,
  cols: number,
): TerminalSize => ({
  lines: clampMin(lines, MIN_LINES),
  cols: clampMin(cols, MIN_COLS),
});

export const normalizeNewlines = (s: string): string =>
  s.replace(/\r\n/g, "\n");

export const normalizeText = (s: string, lower = false): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return lower ? t.toLowerCase() : t;
};

export function splitLines(text: string): string[] {
  const lines = normalizeNewlines(text).split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}
