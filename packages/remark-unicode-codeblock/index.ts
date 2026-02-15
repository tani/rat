import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

function mapMonospace(ch: string): string {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return ch;
  if (cp >= 0x41 && cp <= 0x5a) return String.fromCodePoint(0x1d670 + (cp - 0x41));
  if (cp >= 0x61 && cp <= 0x7a) return String.fromCodePoint(0x1d68a + (cp - 0x61));
  if (cp >= 0x30 && cp <= 0x39) return String.fromCodePoint(0x1d7f6 + (cp - 0x30));
  return ch;
}

function toMonospace(value: string): string {
  let out = "";
  for (const ch of value) out += mapMonospace(ch);
  return out;
}

const remarkUnicodeCodeblock: Plugin<[], Root> = function remarkUnicodeCodeblock() {
  return function transform(tree) {
    visit(tree, "code", (node: Code) => {
      if (typeof node.lang === "string" && node.lang.toLowerCase() === "raw") return;
      node.value = toMonospace(node.value);
      node.lang = null;
      node.meta = null;
    });
  };
};

export default remarkUnicodeCodeblock;
