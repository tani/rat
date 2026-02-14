import type { Nodes, Root, RootContent } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { renderBlockMath, renderInlineMath } from "../math-renderer.ts";

type ParentLike = { children: RootContent[] };

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
      type: "code",
      lang: null,
      meta: null,
      value: rendered,
    } as RootContent);
  });
};
