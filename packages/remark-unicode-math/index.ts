import { CString, cc } from "bun:ffi";
import unicodeit from "unicodeit";
import type { Code, InlineCode, Parent, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { getStagedBridgeSourceFile } from "./libtexprintf/assets";

type Renderer = (latex: string) => string;
export type RemarkUnicodeMathOptions = {
  displayRenderer?: (latex: string) => string | Promise<string>;
};
let rendererPromise: Promise<Renderer> | undefined;
const encoder = new TextEncoder();

async function createNativeRenderer(): Promise<Renderer> {
  const bridgeSourceFile = await getStagedBridgeSourceFile();
  const {
    symbols: { mdd_texfree, mdd_texstring },
  } = cc({
    source: bridgeSourceFile,
    flags: ["-w"],
    symbols: {
      mdd_texstring: {
        args: ["cstring"],
        returns: "ptr",
      },
      mdd_texfree: {
        args: ["ptr"],
        returns: "void",
      },
    },
  });

  return (latex: string) => {
    const outputPtr = mdd_texstring(encoder.encode(`${latex}\0`));
    if (!outputPtr) {
      return "";
    }

    try {
      return new CString(outputPtr).toString();
    } finally {
      mdd_texfree(outputPtr);
    }
  };
}

function getRenderer(): Promise<Renderer> {
  if (!rendererPromise) {
    rendererPromise = createNativeRenderer();
  }
  return rendererPromise;
}

function toInlineCode(value: string): InlineCode {
  return { type: "inlineCode", value };
}

function toCode(value: string): Code {
  return { type: "code", value };
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
    const output = displayRenderer ? await displayRenderer(value) : (await getRenderer())(value);
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
      if (node.type === "inlineMath") {
        const inlineValue = unicodeit.replace(node.value);
        (parent as Parent).children[index] = toInlineCode(inlineValue);
        return;
      }
      if (node.type === "math") {
        jobs.push(
          displayToUnicode(node.value, options.displayRenderer).then((displayValue) => {
            (parent as Parent).children[index] = toCode(displayValue);
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
