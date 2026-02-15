import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import type { Plugin } from "unified";
import type { Node } from "unist";
import type { Point, Position } from "unist";
import type { Root } from "mdast";
import type { VFile } from "vfile";

export interface RemarkSourcemapPoint {
  line: number;
  column: number;
  offset?: number;
}

export interface RemarkSourcemapRange {
  start: RemarkSourcemapPoint;
  end: RemarkSourcemapPoint;
}

export interface RemarkSourcemapSegment {
  nodeType: string;
  output: RemarkSourcemapRange;
  input: RemarkSourcemapRange;
}

export interface RemarkSourcemapData {
  version: 2;
  segments: RemarkSourcemapSegment[];
}

interface NodeRecord {
  node: Node;
  signature: string;
}

const TRACKED_TYPES = new Set([
  "root",
  "heading",
  "paragraph",
  "blockquote",
  "list",
  "listItem",
  "code",
  "html",
  "thematicBreak",
  "table",
  "tableRow",
  "definition",
  "math",
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function signatureOf(node: Node): string {
  return `${node.type}:${normalizeText(toString(node as never))}`;
}

function shouldTrackNode(node: Node): boolean {
  if (node.type === "root") return true;
  if (!node.position) return false;
  return TRACKED_TYPES.has(node.type);
}

function collectNodeRecords(root: Node): NodeRecord[] {
  const out: NodeRecord[] = [];

  const walk = (node: Node, hasUnstableOffset: boolean): void => {
    if (!hasUnstableOffset && shouldTrackNode(node)) {
      out.push({
        node,
        signature: signatureOf(node),
      });
    }

    const parent = node as Node & { children?: Node[] };
    const children = parent.children;
    if (!children || children.length === 0) return;

    let sawMissingPosition = false;
    for (const child of children) {
      walk(child, hasUnstableOffset || sawMissingPosition);
      if (!child.position) sawMissingPosition = true;
    }
  };

  walk(root, false);
  return out;
}

function tableAt(table: Uint32Array, index: number): number {
  return table[index] ?? 0;
}

function buildLcsTable(generated: NodeRecord[], current: NodeRecord[]): Uint32Array {
  const cols = current.length + 1;
  const table = new Uint32Array((generated.length + 1) * cols);

  for (let i = 1; i <= generated.length; i += 1) {
    for (let j = 1; j <= current.length; j += 1) {
      const idx = i * cols + j;
      if (generated[i - 1]?.signature === current[j - 1]?.signature) {
        table[idx] = tableAt(table, (i - 1) * cols + (j - 1)) + 1;
      } else {
        table[idx] = Math.max(
          tableAt(table, (i - 1) * cols + j),
          tableAt(table, i * cols + (j - 1)),
        );
      }
    }
  }

  return table;
}

function lcsMatch(currentNodes: NodeRecord[], generatedNodes: NodeRecord[]): [Node, Node][] {
  const table = buildLcsTable(generatedNodes, currentNodes);
  const cols = currentNodes.length + 1;
  const pairs: [Node, Node][] = [];
  let i = generatedNodes.length;
  let j = currentNodes.length;

  while (i > 0 && j > 0) {
    const gen = generatedNodes[i - 1];
    const cur = currentNodes[j - 1];
    if (gen?.signature === cur?.signature && gen && cur) {
      pairs.push([gen.node, cur.node]);
      i -= 1;
      j -= 1;
      continue;
    }

    if (tableAt(table, (i - 1) * cols + j) >= tableAt(table, i * cols + (j - 1))) i -= 1;
    else j -= 1;
  }

  return pairs.reverse();
}

function toSourcemapPoint(point: Point): RemarkSourcemapPoint {
  return {
    line: point.line,
    column: point.column,
    offset: point.offset,
  };
}

function toSourcemapRange(position: Position): RemarkSourcemapRange {
  return {
    start: toSourcemapPoint(position.start),
    end: toSourcemapPoint(position.end),
  };
}

function emitLineMap(currentTree: Root, generatedTree: Root, file: VFile): void {
  const currentNodes = collectNodeRecords(currentTree);
  const generatedNodes = collectNodeRecords(generatedTree);
  const pairs = lcsMatch(currentNodes, generatedNodes);

  const segments: RemarkSourcemapSegment[] = [];

  for (const [generated, current] of pairs) {
    const genPos = generated.position;
    const curPos = current.position;
    if (!genPos || !curPos) continue;

    segments.push({
      nodeType: generated.type,
      output: toSourcemapRange(genPos),
      input: toSourcemapRange(curPos),
    });
  }

  (file.data as { sourcemap?: RemarkSourcemapData }).sourcemap = {
    version: 2,
    segments,
  };
}

const remarkSourcemap: Plugin<[], Root> = function remarkSourcemap() {
  return function transform(tree, file) {
    const serializer = unified().use(remarkStringify);
    const parser = unified().use(remarkParse);

    const generatedMarkdown = serializer.stringify(tree);
    const generatedTree = parser.parse(generatedMarkdown);

    emitLineMap(tree, generatedTree, file);
  };
};

export default remarkSourcemap;
