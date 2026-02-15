import * as arktype from "arktype";
import { renderBussproofs } from "@rat/bussproofs-unicode";
import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const PROOFTREE_START = "\\begin{prooftree}";
const PROOFTREE_END = "\\end{prooftree}";
const ParentWithChildrenSchema = arktype.type({ children: "unknown[]" });

function isBussproofsLang(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const normalized = lang.toLowerCase();
  return normalized === "bussproofs" || normalized === "prooftree";
}

function ensureProoftreeWrapper(source: string): string {
  if (source.includes(PROOFTREE_START) && source.includes(PROOFTREE_END)) return source;
  return `${PROOFTREE_START}\n${source}\n${PROOFTREE_END}`;
}

const remarkUnicodeBussproofs: Plugin<[], Root> = function remarkUnicodeBussproofs() {
  return function transform(tree) {
    visit(tree, (node, index, parent) => {
      if (index === undefined || !parent) return;
      const parentWithChildren = ParentWithChildrenSchema(parent);
      if (parentWithChildren instanceof arktype.type.errors) return;

      if (node.type === "code") {
        const source = node.value;
        const hasTree = source.includes(PROOFTREE_START) && source.includes(PROOFTREE_END);
        if (!hasTree && !isBussproofsLang(node.lang)) return;

        const wrapped = ensureProoftreeWrapper(source);
        const rendered = renderBussproofs(wrapped);
        node.value = rendered;
        node.lang = "";
        node.meta = null;
        return;
      }

      if (node.type === "math") {
        const source = node.value;
        const hasTree = source.includes(PROOFTREE_START) && source.includes(PROOFTREE_END);
        if (!hasTree) return;

        const rendered = renderBussproofs(source);
        const code: Code = { type: "code", value: rendered, lang: "", meta: null };
        parentWithChildren.children[index] = code;
      }
    });
  };
};

export default remarkUnicodeBussproofs;
