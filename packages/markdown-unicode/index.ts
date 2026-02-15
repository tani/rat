import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkStringify from "remark-stringify";
import remarkSourcemap, { type RemarkSourcemapData } from "@rat/remark-sourcemap";
import remarkUnicodeInline from "@rat/remark-unicode-inline";
import remarkUnicodeMath from "@rat/remark-unicode-math";
import remarkUnicodeMermaid from "@rat/remark-unicode-mermaid";
import remarkUnicodeTable from "@rat/remark-unicode-table";

export interface RenderedMarkdown {
  markdown: string;
  sourcemap: RemarkSourcemapData;
}

export async function renderMarkdown(input: string): Promise<RenderedMarkdown> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkUnicodeMath)
    .use(remarkUnicodeMermaid)
    .use(remarkUnicodeInline)
    .use(remarkUnicodeTable)
    .use(remarkSourcemap)
    .use(remarkStringify, {
      bullet: "-",
      bulletOther: "*",
      fences: false,
      setext: true,
      incrementListMarker: true,
    })
    .process(input);

  const sourcemap = (file.data as { sourcemap?: RemarkSourcemapData }).sourcemap ?? {
    version: 2,
    segments: [],
  };

  return {
    markdown: String(file),
    sourcemap,
  };
}

export default renderMarkdown;
