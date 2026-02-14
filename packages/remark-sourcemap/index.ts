import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { Node } from "unist";
import type { Root } from "mdast";
import type { VFile } from "vfile";

export type RemarkSourcemapData = {
  generatedToCurrent: Record<number, number>;
  currentToGenerated: Record<number, number>;
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (a.length === 1 || b.length === 1) return a === b ? 1 : 0;

  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const pair = a.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (a.length + b.length - 2);
}

function collectNodes(root: Node): Node[] {
  const out: Node[] = [];
  visit(root, (node) => out.push(node));
  return out;
}

function fuzzyMatch(currentNodes: Node[], generatedNodes: Node[]): Array<[Node, Node]> {
  const byType = new Map<string, Node[]>();
  for (const node of currentNodes) {
    const list = byType.get(node.type);
    if (list) list.push(node);
    else byType.set(node.type, [node]);
  }

  const consumed = new WeakSet<Node>();
  const pairs: Array<[Node, Node]> = [];

  for (const generated of generatedNodes) {
    const pool = byType.get(generated.type);
    if (!pool || pool.length === 0) continue;

    const genText = normalizeText(toString(generated as never));
    let best: Node | undefined;
    let bestScore = -1;

    for (const current of pool) {
      if (consumed.has(current)) continue;
      const score = diceCoefficient(genText, normalizeText(toString(current as never)));
      if (score > bestScore) {
        best = current;
        bestScore = score;
      }
    }

    if (!best) continue;
    consumed.add(best);
    pairs.push([generated, best]);
  }

  return pairs;
}

function addLineMap(
  map: Record<number, number>,
  fromStart: number,
  fromEnd: number,
  toStart: number,
  toEnd: number,
): void {
  const fromSpan = Math.max(1, fromEnd - fromStart + 1);
  const toSpan = Math.max(1, toEnd - toStart + 1);
  const span = Math.max(fromSpan, toSpan);

  for (let i = 0; i < span; i += 1) {
    const fromLine = Math.min(fromEnd, fromStart + Math.floor((i * fromSpan) / span));
    const toLine = Math.min(toEnd, toStart + Math.floor((i * toSpan) / span));
    map[fromLine] = toLine;
  }
}

function emitLineMap(currentTree: Root, generatedTree: Root, file: VFile): void {
  const currentNodes = collectNodes(currentTree);
  const generatedNodes = collectNodes(generatedTree);
  const pairs = fuzzyMatch(currentNodes, generatedNodes);

  const generatedToCurrent: Record<number, number> = {};
  const currentToGenerated: Record<number, number> = {};

  for (const [generated, current] of pairs) {
    const genPos = generated.position;
    const curPos = current.position;
    if (!genPos || !curPos) continue;

    addLineMap(
      generatedToCurrent,
      genPos.start.line,
      genPos.end.line,
      curPos.start.line,
      curPos.end.line,
    );
    addLineMap(
      currentToGenerated,
      curPos.start.line,
      curPos.end.line,
      genPos.start.line,
      genPos.end.line,
    );
  }

  (file.data as { sourcemap?: RemarkSourcemapData }).sourcemap = {
    generatedToCurrent,
    currentToGenerated,
  };
}

const remarkSourcemap: Plugin<[], Root> = function remarkSourcemap() {
  return function transform(tree, file) {
    const serializer = unified().use(remarkStringify);
    const parser = unified().use(remarkParse);

    const generatedMarkdown = serializer.stringify(tree);
    const generatedTree = parser.parse(generatedMarkdown) as Root;

    emitLineMap(tree, generatedTree, file);
  };
};

export default remarkSourcemap;
