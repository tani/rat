import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import ffiBridgeSource from "./ffi_bridge.c" with { type: "file" };
import boxesCSource from "./libtexprintf/src/boxes.c" with { type: "file" };
import boxesHSource from "./libtexprintf/src/boxes.h" with { type: "file" };
import drawboxCSource from "./libtexprintf/src/drawbox.c" with { type: "file" };
import drawboxHSource from "./libtexprintf/src/drawbox.h" with { type: "file" };
import drawcharsHSource from "./libtexprintf/src/drawchars.h" with { type: "file" };
import errorCSource from "./libtexprintf/src/error.c" with { type: "file" };
import errorHSource from "./libtexprintf/src/error.h" with { type: "file" };
import errorFlagsHSource from "./errorflags.h" with { type: "file" };
import errorMessagesHSource from "./errormessages.h" with { type: "file" };
import lexerCSource from "./libtexprintf/src/lexer.c" with { type: "file" };
import lexerHSource from "./libtexprintf/src/lexer.h" with { type: "file" };
import mapUnicodeHSource from "./libtexprintf/src/mapunicode.h" with { type: "file" };
import parseDefHSource from "./libtexprintf/src/parsedef.h" with { type: "file" };
import parserCSource from "./libtexprintf/src/parser.c" with { type: "file" };
import parserHSource from "./libtexprintf/src/parser.h" with { type: "file" };
import stringUtilsCSource from "./libtexprintf/src/stringutils.c" with { type: "file" };
import stringUtilsHSource from "./libtexprintf/src/stringutils.h" with { type: "file" };
import texprintfCSource from "./libtexprintf/src/texprintf.c" with { type: "file" };
import unicodeBlocksHSource from "./libtexprintf/src/unicodeblocks.h" with { type: "file" };

interface AssetFile {
  from: string;
  to: string;
}

const assetFiles: AssetFile[] = [
  { from: ffiBridgeSource, to: "ffi_bridge.c" },
  { from: boxesCSource, to: "src/boxes.c" },
  { from: boxesHSource, to: "src/boxes.h" },
  { from: drawboxCSource, to: "src/drawbox.c" },
  { from: drawboxHSource, to: "src/drawbox.h" },
  { from: drawcharsHSource, to: "src/drawchars.h" },
  { from: errorCSource, to: "src/error.c" },
  { from: errorHSource, to: "src/error.h" },
  { from: errorFlagsHSource, to: "src/errorflags.h" },
  { from: errorMessagesHSource, to: "src/errormessages.h" },
  { from: lexerCSource, to: "src/lexer.c" },
  { from: lexerHSource, to: "src/lexer.h" },
  { from: mapUnicodeHSource, to: "src/mapunicode.h" },
  { from: parseDefHSource, to: "src/parsedef.h" },
  { from: parserCSource, to: "src/parser.c" },
  { from: parserHSource, to: "src/parser.h" },
  { from: stringUtilsCSource, to: "src/stringutils.c" },
  { from: stringUtilsHSource, to: "src/stringutils.h" },
  { from: texprintfCSource, to: "src/texprintf.c" },
  { from: unicodeBlocksHSource, to: "src/unicodeblocks.h" },
];

let stagedBridgeSourcePromise: Promise<string> | undefined;

function createHeaderGuardName(path: string): string {
  return `RAT_LIBTEXPRINTF_${path.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_`;
}

async function stageAssetFile(rootDir: string, assetFile: AssetFile): Promise<void> {
  const outputPath = join(rootDir, assetFile.to);
  await mkdir(dirname(outputPath), { recursive: true });
  if (assetFile.to === "src/lexer.c") {
    const lexerSource = await Bun.file(assetFile.from).text();
    await Bun.write(outputPath, lexerSource.replace("#include <math.h>\n", ""));
    return;
  }

  if (assetFile.to.endsWith(".h")) {
    const headerText = await Bun.file(assetFile.from).text();
    const guardName = createHeaderGuardName(assetFile.to);
    const wrappedHeader = `#ifndef ${guardName}\n#define ${guardName}\n${headerText}\n#endif\n`;
    await Bun.write(outputPath, wrappedHeader);
    return;
  }

  await Bun.write(outputPath, Bun.file(assetFile.from));
}

export function getStagedBridgeSourceFile(): Promise<string> {
  stagedBridgeSourcePromise ??= (async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "rat-libtexprintf-"));
    await Promise.all(assetFiles.map((assetFile) => stageAssetFile(rootDir, assetFile)));
    return join(rootDir, "ffi_bridge.c");
  })();

  return stagedBridgeSourcePromise;
}
