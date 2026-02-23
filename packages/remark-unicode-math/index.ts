import * as arktype from "arktype";
import { createRender } from "libtexprintf";
import wasmPath from "libtexprintf/libtexprintf.wasm" with { type: "file" };
import { WASI } from "node:wasi";
import unicodeit from "unicodeit";
import type { Code, InlineCode, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export interface RemarkUnicodeMathOptions {
  displayRenderer?: (latex: string) => string | Promise<string>;
}

const wasi = new WASI({ version: "preview1" });
const wasmBytes = await Bun.file(wasmPath).arrayBuffer();
const { instance: libtexprintfInstance } = await WebAssembly.instantiate(wasmBytes, {
  wasi_snapshot_preview1: wasi.wasiImport,
});
const renderLibtexprintf = createRender(libtexprintfInstance);

function libtexprintfRenderer(latex: string): string {
  return renderLibtexprintf(latex).output;
}

const ParentWithChildrenSchema = arktype.type({
  children: "unknown[]",
});

function toInlineCode(value: string): InlineCode {
  return { type: "inlineCode", value };
}

function toCode(value: string): Code {
  return { type: "code", value, lang: "raw", meta: null };
}

function isLikelyFailedLibtexprintf(input: string, output: string): boolean {
  const inNorm = input.trim();
  const outNorm = output.trim();
  if (!outNorm) return true;
  if (inNorm === outNorm && /\\[A-Za-z]+/.test(inNorm)) return true;
  return false;
}

async function displayToUnicode(
  value: string,
  displayRenderer?: (latex: string) => string | Promise<string>,
): Promise<string> {
  try {
    const output = displayRenderer ? await displayRenderer(value) : libtexprintfRenderer(value);
    if (isLikelyFailedLibtexprintf(value, output)) {
      return unicodeit.replace(value);
    }
    return output;
  } catch {
    return unicodeit.replace(value);
  }
}

const remarkUnicodeMath: Plugin<[RemarkUnicodeMathOptions?], Root> = function remarkUnicodeMath(
  options = {},
) {
  return async function transform(tree) {
    const jobs: Promise<void>[] = [];

    visit(tree, (node, index, parent) => {
      if (index === undefined || !parent) return;
      const parentWithChildren = ParentWithChildrenSchema(parent);
      if (parentWithChildren instanceof arktype.type.errors) return;
      if (node.type === "inlineMath") {
        const inlineValue = unicodeit.replace(node.value);
        parentWithChildren.children[index] = toInlineCode(inlineValue);
        return;
      }
      if (node.type === "math") {
        jobs.push(
          displayToUnicode(node.value, options.displayRenderer).then((displayValue) => {
            parentWithChildren.children[index] = toCode(displayValue);
          }),
        );
      }
    });

    if (jobs.length > 0) {
      await Promise.all(jobs);
    }
  };
};

export default remarkUnicodeMath;
