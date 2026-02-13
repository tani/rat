import unicodeit from "unicodeit";
import { createRendererFromExports } from "../../libtexprintf/libtexprintf.js";
import * as texWasm from "../../libtexprintf/libtexprintf.wasm";

const texRenderer: ((latex: string) => string) | null = (() => {
  try {
    return createRendererFromExports(texWasm);
  } catch {
    return null;
  }
})();

function decodeNumericEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(String(hex), 16))
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(String(dec), 10))
    );
}

export function renderInlineMath(src: string): string {
  try {
    if (!texRenderer) return unicodeit.replace(src);
    const out = decodeNumericEntities(texRenderer(src));
    return out.includes("\n") ? unicodeit.replace(src) : out;
  } catch {
    return unicodeit.replace(src);
  }
}

export function renderBlockMath(src: string): string {
  try {
    if (texRenderer) return decodeNumericEntities(texRenderer(src));
    return unicodeit.replace(src);
  } catch {
    return src;
  }
}
