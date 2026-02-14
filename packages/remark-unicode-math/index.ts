import unicodeit from "unicodeit";
import type { Code, InlineCode, Parent, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { createRendererFromExports } from "./libtexprintf/libtexprintf";

const wasiSnapshotPreview1 = {
  proc_exit(code: number): never {
    throw new Error(`WASM requested proc_exit(${code})`);
  },
  fd_close(_fd: number): number {
    return 0;
  },
  fd_write(_fd: number, _iovs: number, _iovsLen: number, _nwritten: number): number {
    return 0;
  },
  fd_seek(
    _fd: number,
    _offsetLow: number,
    _offsetHigh: number,
    _whence: number,
    _newOffset: number,
  ): number {
    return 0;
  },
};

type Renderer = (latex: string) => string;
export type RemarkUnicodeMathOptions = {
  displayRenderer?: (latex: string) => string | Promise<string>;
};
let rendererPromise: Promise<Renderer> | undefined;

function getRenderer(): Promise<Renderer> {
  if (!rendererPromise) {
    rendererPromise = (async () => {
      const wasmUrl = new URL("./libtexprintf/libtexprintf.wasm", import.meta.url);
      const bytes = await Bun.file(wasmUrl).arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {
        wasi_snapshot_preview1: wasiSnapshotPreview1,
      });
      return createRendererFromExports(instance.exports as never);
    })();
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
