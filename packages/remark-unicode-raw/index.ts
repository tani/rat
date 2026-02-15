import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

function isRawLang(lang: string | null | undefined): boolean {
  return typeof lang === "string" && lang.toLowerCase() === "raw";
}

const remarkUnicodeRaw: Plugin<[], Root> = function remarkUnicodeRaw() {
  return function transform(tree) {
    visit(tree, "code", (node: Code) => {
      if (!isRawLang(node.lang)) return;
      node.lang = null;
      node.meta = null;
    });
  };
};

export default remarkUnicodeRaw;
