import { renderMermaidAscii } from "beautiful-mermaid";
import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export interface RemarkUnicodeMermaidOptions {
  render?: (source: string) => string | Promise<string>;
}

function preprocess(source: string): string {
  return source
    .replace(
      /(\b[\w-]*\w)\s*(?:\[{2}[\s\S]*?\]{2}|\[[\s\S]*?\]|\({2}[\s\S]*?\){2}|\([\s\S]*?\)|\{{2}[\s\S]*?\}\}|\{[\s\S]*?\}|>[\s\S]*?\])/g,
      "$1",
    )
    .replace(/(participant|actor)\s+([\w-]+)\s+as\s+[^\n]+/gi, "$1 $2");
}

const remarkUnicodeMermaid: Plugin<[RemarkUnicodeMermaidOptions?], Root> = (options = {}) => {
  const render = options.render ?? renderMermaidAscii;

  return async (tree) => {
    const tasks: Promise<void>[] = [];

    visit(tree, "code", (node: Code) => {
      if (node.lang?.toLowerCase() !== "mermaid") return;

      const original = node.value;
      tasks.push(
        (async () => {
          try {
            node.value = await render(preprocess(original));
            node.lang = "raw";
            node.meta = null;
          } catch {
            node.value = original;
          }
        })(),
      );
    });

    await Promise.all(tasks);
  };
};

export default remarkUnicodeMermaid;
