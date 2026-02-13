import fs from "node:fs";

import { buildPreview } from "./preview.ts";
import {
  MIN_COLS,
  normalizeTerminal,
  type PreviewResult,
  type Source,
  type TerminalSize,
} from "../core/shared.ts";

function readSource(source: Source): string {
  if (source.kind === "text") return source.content;
  return fs.readFileSync(source.path, "utf8");
}

function readTerminalSize(fallback: TerminalSize): TerminalSize {
  try {
    const { rows, columns } = Deno.consoleSize();
    return normalizeTerminal(rows, columns);
  } catch {
    return fallback;
  }
}

export function createRefresh() {
  let currentTerminal: TerminalSize = normalizeTerminal(24, 80);
  return async function refresh(
    source: Source,
    line: number,
    onViewportText?: (text: string) => void,
  ): Promise<PreviewResult> {
    currentTerminal = readTerminalSize(currentTerminal);
    const normalizedTerminal = {
      lines: currentTerminal.lines,
      cols: Math.max(MIN_COLS, currentTerminal.cols),
    };
    const preview = await buildPreview(
      readSource(source),
      line,
      normalizedTerminal,
    );
    onViewportText?.(preview.viewport.text);
    return preview;
  };
}
