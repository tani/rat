import type { Code, Definition, Link, Nodes, Root, RootContent } from "mdast";
import { renderMermaidAscii } from "beautiful-mermaid";
import { toString } from "mdast-util-to-string";
import prettier from "prettier";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { Plugin } from "unified";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { renderBlockMath, renderInlineMath } from "./renderer-state.ts";
import {
  MARKDOWN_MAP_GAP,
  MARKDOWN_MAP_THRESHOLD,
  type PositionMapEntry,
  type PositionPoint,
  REMARK_STRINGIFY_OPTIONS,
} from "./types.ts";
import { clampMin, MIN_COLS, normalizeText } from "../core/shared.ts";

type ParentLike = { children: RootContent[] };
type PositionLike = {
  start?: PositionPoint;
  end?: PositionPoint;
};
type PositionedNode = { position?: PositionLike };
type Anchor = {
  type: string;
  text: string;
  position?: PositionLike;
  node: PositionedNode;
};

export type RemarkPrettierOptions = {
  printWidth?: number;
};

function nodeValue(node: RootContent & { value?: unknown }): string {
  return String(node.value ?? "").trim();
}

function replaceChildAt(
  parent: unknown,
  index: number | undefined,
  node: RootContent,
): void {
  if (!parent || index === undefined) return;
  (parent as ParentLike).children[index] = node;
}

export const remarkRenderMath: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree as Nodes, "inlineMath", (node, index, parent) => {
    const src = nodeValue(node as RootContent & { value?: unknown });
    const rendered = renderInlineMath(src).replace(/\$/g, "\\$");
    replaceChildAt(parent, index, {
      type: "text",
      value: rendered,
    } as RootContent);
  });

  visit(tree as Nodes, "math", (node, index, parent) => {
    const src = nodeValue(node as RootContent & { value?: unknown });
    const rendered = renderBlockMath(src).replace(/\$/g, "\\$");
    replaceChildAt(parent, index, {
      type: "paragraph",
      children: [
        {
          type: "text",
          value: rendered,
        },
      ],
    } as RootContent);
  });
};

export const remarkRenderMermaidAscii: Plugin<[], Root> =
  () => (tree: Root) => {
    visit(tree as Nodes, "code", (node) => {
      const code = node as Code;
      if (!/^mermaid$/i.test(String(code.lang ?? "").trim())) return;
      try {
        code.value = renderMermaidAscii(String(code.value ?? ""));
        code.lang = null;
      } catch {
        // keep original mermaid source
      }
    });
  };

export const remarkNormalizeCodeBlocks: Plugin<[], Root> =
  () => (tree: Root) => {
    visit(tree as Nodes, "code", (node) => {
      const code = node as Code;
      code.lang = null;
      code.meta = null;
    });
  };

export const remarkShortenLinks: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree as Nodes, "link", (node) => {
    (node as Link).url = "...";
  });
  visit(tree as Nodes, "definition", (node) => {
    (node as Definition).url = "...";
  });
};

function collectAnchors(tree: Root): Anchor[] {
  const out: Anchor[] = [];
  visit(tree as Nodes, (node: Nodes) => {
    if (node.type === "root") return;
    out.push({
      type: node.type,
      text: normalizeText(toString(node), true),
      position: (node as PositionedNode).position,
      node: node as PositionedNode,
    });
  });
  return out;
}

function bigrams(text: string): Set<string> {
  const t = normalizeText(text, true);
  if (!t.length) return new Set();
  if (t.length === 1) return new Set([t]);
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function textSimilarity(a: string, b: string): number {
  const x = normalizeText(a, true);
  const y = normalizeText(b, true);
  if (x === y) return 1;
  if (!x.length || !y.length) return 0;
  if (x.includes(y) || y.includes(x)) return 0.85;

  const gx = bigrams(x);
  const gy = bigrams(y);
  let inter = 0;
  for (const g of gx) if (gy.has(g)) inter++;
  const union = gx.size + gy.size - inter;
  return union > 0 ? inter / union : 0;
}

function anchorSimilarity(a: Anchor, b: Anchor): number {
  const score = textSimilarity(a.text, b.text) +
    (a.type === b.type ? 0.2 : -0.05);
  return Math.max(0, Math.min(1, score));
}

function fuzzyMatch(a: Anchor[], b: Anchor[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const dp: Float64Array[] = Array.from(
    { length: n + 1 },
    () => new Float64Array(m + 1),
  );
  const step: Uint8Array[] = Array.from(
    { length: n + 1 },
    () => new Uint8Array(m + 1),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const sim = anchorSimilarity(a[i], b[j]);
      const match = sim >= MARKDOWN_MAP_THRESHOLD
        ? dp[i + 1][j + 1] + sim
        : -1e9;
      const del = dp[i + 1][j] - MARKDOWN_MAP_GAP;
      const ins = dp[i][j + 1] - MARKDOWN_MAP_GAP;
      if (match >= del && match >= ins) {
        dp[i][j] = match;
        step[i][j] = 0;
      } else if (del >= ins) {
        dp[i][j] = del;
        step[i][j] = 1;
      } else {
        dp[i][j] = ins;
        step[i][j] = 2;
      }
    }
  }

  const pairs: Array<[number, number]> = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (
      step[i][j] === 0 && anchorSimilarity(a[i], b[j]) >= MARKDOWN_MAP_THRESHOLD
    ) {
      pairs.push([i++, j++]);
    } else if (step[i][j] === 1) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

function clonePosition(pos: PositionLike): PositionLike {
  return {
    start: pos.start ? { ...pos.start } : undefined,
    end: pos.end ? { ...pos.end } : undefined,
  };
}

function mapOriginalPositions(
  originalTree: Root,
  rebuiltTree: Root,
): PositionMapEntry[] {
  const originalAnchors = collectAnchors(originalTree);
  const rebuiltAnchors = collectAnchors(rebuiltTree);
  const pairs = fuzzyMatch(originalAnchors, rebuiltAnchors);
  const out: PositionMapEntry[] = [];
  for (const [i, j] of pairs) {
    const pos = originalAnchors[i].position;
    const formatted = rebuiltAnchors[j].node.position;
    if (!pos?.start || !pos?.end) continue;
    const original = clonePosition(pos);
    const formattedBeforeRewrite = formatted
      ? clonePosition(formatted)
      : { start: undefined, end: undefined };
    rebuiltAnchors[j].node.position = {
      start: { ...pos.start },
      end: { ...pos.end },
    };
    out.push({
      type: rebuiltAnchors[j].type,
      text: rebuiltAnchors[j].text,
      original,
      formatted: formattedBeforeRewrite,
    });
  }
  return out;
}

export const remarkPrettier: Plugin<[RemarkPrettierOptions?], Root> = (
  options,
) =>
  async function transformer(
    tree: Root,
    file?: { data?: Record<string, unknown> },
  ): Promise<Root> {
    const source = unified()
      .use(remarkGfm)
      .use(remarkStringify, REMARK_STRINGIFY_OPTIONS)
      .stringify(tree);
    const filePrintWidth = Number(file?.data?.printWidth);
    const width = Number.isFinite(filePrintWidth)
      ? filePrintWidth
      : options?.printWidth;
    const formatted = await prettier.format(String(source).trimEnd(), {
      parser: "markdown",
      printWidth: clampMin(width ?? MIN_COLS, MIN_COLS),
    });

    const rebuilt = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .parse(formatted) as Root;
    const positionMap = mapOriginalPositions(tree, rebuilt);
    if (file) file.data = { ...(file.data ?? {}), positionMap };

    return {
      ...rebuilt,
      data: { ...(rebuilt.data ?? {}), ...(tree.data ?? {}) },
    };
  };
