import { CString, cc } from "bun:ffi";
import { getStagedBridgeSourceFile } from "./assets.ts";

export type LibtexprintfRenderer = (latex: string) => string;

const encoder = new TextEncoder();

export async function getLibtexprintfRenderer(): Promise<LibtexprintfRenderer> {
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
