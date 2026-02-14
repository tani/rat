import { renderMermaidAscii } from "beautiful-mermaid";
import type { Code, Nodes, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

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
