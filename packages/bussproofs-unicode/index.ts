import * as arktype from "arktype";
import unicodeit from "unicodeit";

interface ProofNode {
  conclusion: string;
  premises: ProofNode[];
  leftRuleLabel: string | null;
  rightRuleLabel: string | null;
}

interface RenderBlock {
  lines: string[];
  width: number;
  coreStart: number;
  coreWidth: number;
}

const START = "\\begin{prooftree}";
const END = "\\end{prooftree}";

type ArityCommand = "AxiomC" | "UnaryInfC" | "BinaryInfC" | "TrinaryInfC" | "QuaternaryInfC";
type ProofCommand = ArityCommand | "LeftLabel" | "RightLabel";

const ProofCommandSchema = arktype.type(
  "'AxiomC' | 'UnaryInfC' | 'BinaryInfC' | 'TrinaryInfC' | 'QuaternaryInfC' | 'LeftLabel' | 'RightLabel'",
);
const ArityCommandSchema = arktype.type(
  "'AxiomC' | 'UnaryInfC' | 'BinaryInfC' | 'TrinaryInfC' | 'QuaternaryInfC'",
);

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
    if (depth === 0) return { content: source.slice(openBraceIndex + 1, i), end: i + 1 };
    i += 1;
  }
  return null;
}

function cleanLabel(raw: string): string {
  const trimmed = raw.trim();
  const unwrapped =
    trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length >= 2
      ? trimmed.slice(1, -1)
      : trimmed;
  return unicodeit.replace(unwrapped);
}

function visualWidth(value: string): number {
  return Array.from(value).length;
}

function padEndToWidth(value: string, width: number): string {
  const diff = Math.max(0, width - visualWidth(value));
  return `${value}${" ".repeat(diff)}`;
}

function drawAt(cells: string[], x: number, value: string): void {
  const chars = Array.from(value);
  for (let i = 0; i < chars.length; i += 1) {
    const pos = x + i;
    if (pos < 0 || pos >= cells.length) continue;
    cells[pos] = chars[i] ?? " ";
  }
}

function parseProofCommand(value: unknown): ProofCommand | undefined {
  const parsed = ProofCommandSchema(value);
  if (parsed instanceof arktype.type.errors) return undefined;
  return parsed;
}

function parseArityCommand(value: unknown): ArityCommand | undefined {
  const parsed = ArityCommandSchema(value);
  if (parsed instanceof arktype.type.errors) return undefined;
  return parsed;
}

function combineChildren(blocks: RenderBlock[]): RenderBlock {
  if (blocks.length === 0) return { lines: [], width: 0, coreStart: 0, coreWidth: 0 };
  const gap = "   ";
  const maxHeight = Math.max(...blocks.map((b) => b.lines.length));
  const positions: number[] = [];
  let cursor = 0;
  for (const block of blocks) {
    positions.push(cursor);
    cursor += block.width + gap.length;
  }
  const width = Math.max(0, cursor - gap.length);

  const lines: string[] = [];
  for (let row = 0; row < maxHeight; row += 1) {
    const cells = Array.from({ length: width }, () => " ");
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (!block) continue;
      const topPad = maxHeight - block.lines.length;
      const contentRow = row - topPad;
      const value = contentRow >= 0 ? (block.lines[contentRow] ?? "") : "";
      drawAt(cells, positions[i] ?? 0, padEndToWidth(value, block.width));
    }
    lines.push(cells.join("").replace(/\s+$/u, ""));
  }

  let leftCore = Number.POSITIVE_INFINITY;
  let rightCore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) continue;
    const x = positions[i] ?? 0;
    leftCore = Math.min(leftCore, x + block.coreStart);
    rightCore = Math.max(rightCore, x + block.coreStart + block.coreWidth);
  }
  if (!Number.isFinite(leftCore) || !Number.isFinite(rightCore)) {
    return { lines, width, coreStart: 0, coreWidth: 0 };
  }
  return { lines, width, coreStart: leftCore, coreWidth: Math.max(0, rightCore - leftCore) };
}

function renderNaturalDeductionBlock(node: ProofNode): RenderBlock {
  if (node.premises.length === 0) {
    const coreWidth = visualWidth(node.conclusion);
    return { lines: [node.conclusion], width: coreWidth, coreStart: 0, coreWidth };
  }

  const childBlocks = node.premises.map((child) => renderNaturalDeductionBlock(child));
  const premises = combineChildren(childBlocks);
  const conclusionWidth = visualWidth(node.conclusion);
  const leftLabel = node.leftRuleLabel;
  const rightLabel = node.rightRuleLabel;
  const leftLabelWidth = leftLabel ? visualWidth(leftLabel) : 0;
  const rightLabelWidth = rightLabel ? visualWidth(rightLabel) : 0;
  const baseCoreWidth = Math.max(3, premises.coreWidth, conclusionWidth);
  const barCoreWidth = baseCoreWidth + (node.premises.length >= 2 ? 1 : 0);
  const premisesCenter = premises.coreStart + premises.coreWidth / 2;
  const barCoreStart = Math.round(premisesCenter - barCoreWidth / 2);
  const ruleLeftStart = barCoreStart - (leftLabel ? leftLabelWidth + 1 : 0);
  const shift = Math.max(0, -Math.min(0, ruleLeftStart));
  const coreStart = barCoreStart + shift;
  const premisesOffset = shift;
  const rightEdge = coreStart + barCoreWidth + (rightLabel ? 1 + rightLabelWidth : 0);
  const width = Math.max(premises.width + premisesOffset, rightEdge);

  const lines: string[] = [];
  for (const line of premises.lines) {
    lines.push(`${" ".repeat(premisesOffset)}${line}`.replace(/\s+$/u, ""));
  }
  const ruleCells = Array.from({ length: width }, () => " ");
  if (leftLabel) drawAt(ruleCells, coreStart - leftLabelWidth - 1, leftLabel);
  drawAt(ruleCells, coreStart, "─".repeat(barCoreWidth));
  if (rightLabel) drawAt(ruleCells, coreStart + barCoreWidth + 1, rightLabel);
  lines.push(ruleCells.join("").replace(/\s+$/u, ""));

  const conclusionCells = Array.from({ length: width }, () => " ");
  const conclusionStart = coreStart + Math.floor((barCoreWidth - conclusionWidth) / 2);
  drawAt(conclusionCells, conclusionStart, node.conclusion);
  lines.push(conclusionCells.join("").replace(/\s+$/u, ""));

  return { lines, width, coreStart, coreWidth: barCoreWidth };
}

function renderNaturalDeduction(node: ProofNode): string {
  const block = renderNaturalDeductionBlock(node);
  return block.lines.join("\n");
}

function commandArity(cmd: ArityCommand): number {
  if (cmd === "AxiomC") return 0;
  if (cmd === "UnaryInfC") return 1;
  if (cmd === "BinaryInfC") return 2;
  if (cmd === "TrinaryInfC") return 3;
  return 4;
}

function parseProoftreeBody(source: string): ProofNode | null {
  const stack: ProofNode[] = [];
  let pendingLeftLabel: string | null = null;
  let pendingRightLabel: string | null = null;
  let i = 0;

  while (i < source.length) {
    if (source[i] !== "\\") {
      i += 1;
      continue;
    }

    const cmdMatch =
      /^(AxiomC|UnaryInfC|BinaryInfC|TrinaryInfC|QuaternaryInfC|LeftLabel|RightLabel)/.exec(
        source.slice(i + 1),
      );
    if (!cmdMatch) {
      i += 1;
      continue;
    }

    const cmd = parseProofCommand(cmdMatch[1]);
    if (!cmd) {
      i += 1;
      continue;
    }
    const cmdLen = cmd.length;
    const braceStart = i + 1 + cmdLen;
    const parsed = parseBraced(source, braceStart);
    if (!parsed) {
      i += 1;
      continue;
    }

    if (cmd === "LeftLabel") {
      pendingLeftLabel = cleanLabel(parsed.content);
      i = parsed.end;
      continue;
    }
    if (cmd === "RightLabel") {
      pendingRightLabel = cleanLabel(parsed.content);
      i = parsed.end;
      continue;
    }

    const arityCmd = parseArityCommand(cmd);
    if (!arityCmd) {
      i = parsed.end;
      continue;
    }

    const arity = commandArity(arityCmd);
    const conclusion = cleanLabel(parsed.content);

    if (arity === 0) {
      stack.push({
        conclusion,
        premises: [],
        leftRuleLabel: null,
        rightRuleLabel: null,
      });
      i = parsed.end;
      continue;
    }

    if (stack.length < arity) return null;
    const premises = stack.splice(stack.length - arity, arity);
    stack.push({
      conclusion,
      premises,
      leftRuleLabel: pendingLeftLabel,
      rightRuleLabel: pendingRightLabel,
    });
    pendingLeftLabel = null;
    pendingRightLabel = null;
    i = parsed.end;
  }

  if (stack.length === 0) return null;
  return stack[stack.length - 1] ?? null;
}

function renderSingleProoftree(source: string): string | null {
  const node = parseProoftreeBody(source);
  if (!node) return null;
  return renderNaturalDeduction(node);
}

export function renderBussproofs(input: string): string {
  let out = "";
  let cursor = 0;

  while (cursor < input.length) {
    const begin = input.indexOf(START, cursor);
    if (begin === -1) {
      out += input.slice(cursor);
      break;
    }

    out += input.slice(cursor, begin);
    const end = input.indexOf(END, begin + START.length);
    if (end === -1) {
      out += input.slice(begin);
      break;
    }

    const bodyStart = begin + START.length;
    const body = input.slice(bodyStart, end);
    const rendered = renderSingleProoftree(body);
    out += rendered ?? input.slice(begin, end + END.length);
    cursor = end + END.length;
  }

  return out;
}

export default renderBussproofs;
