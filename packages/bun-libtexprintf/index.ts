import { CString, cc } from "bun:ffi";
import memoizeOne from "memoize-one";
import { stageBridgeSourceFile } from "./assets.ts";

export type LibtexprintfRenderer = (latex: string) => string;

const encoder = new TextEncoder();

export const getLibtexprintfRenderer = memoizeOne(async (): Promise<LibtexprintfRenderer> => {
  await using stagedBridgeSource = await stageBridgeSourceFile();
  const {
    symbols: { rat_texfree, rat_texstring },
  } = cc({
    source: stagedBridgeSource.bridgeSourceFile,
    flags: ["-w"],
    symbols: {
      rat_texstring: {
        args: ["cstring"],
        returns: "ptr",
      },
      rat_texfree: {
        args: ["ptr"],
        returns: "void",
      },
    },
  });

  return (latex: string) => {
    const outputPtr = rat_texstring(encoder.encode(`${latex}\0`));
    if (!outputPtr) {
      return "";
    }

    try {
      return new CString(outputPtr).toString();
    } finally {
      rat_texfree(outputPtr);
    }
  };
});
