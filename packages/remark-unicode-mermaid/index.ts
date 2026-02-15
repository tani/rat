import { renderMermaidAscii } from "beautiful-mermaid";
import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export interface RemarkUnicodeMermaidOptions {
  render?: (source: string) => string | Promise<string>;
}

function isMermaidCode(node: Code): boolean {
  return typeof node.lang === "string" && node.lang.toLowerCase() === "mermaid";
}

const remarkUnicodeMermaid: Plugin<[RemarkUnicodeMermaidOptions?], Root> =
  function remarkUnicodeMermaid(options = {}) {
    const render = options.render ?? ((source: string) => renderMermaidAscii(source));

    return async function transform(tree) {
      const tasks: Promise<void>[] = [];

      visit(tree, "code", (node: Code) => {
        if (!isMermaidCode(node)) return;

        const original = node.value;
        tasks.push(
          Promise.resolve()
            .then(() => render(original))
            .then((output) => {
              node.value = output;
              node.lang = "";
            })
            .catch(() => {
              node.value = original;
            }),
        );
      });

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
    };
  };

export default remarkUnicodeMermaid;
