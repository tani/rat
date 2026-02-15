import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkStringify from "remark-stringify";
import remarkUnicodeInline from "@rat/remark-unicode-inline";
import remarkUnicodeBussproofs from "@rat/remark-unicode-bussproofs";
import remarkUnicodeMath from "@rat/remark-unicode-math";
import remarkUnicodeMermaid from "@rat/remark-unicode-mermaid";
import remarkUnicodeTable from "@rat/remark-unicode-table";
import remarkUnicodeCodeblock from "@rat/remark-unicode-codeblock";
import remarkUnicodeRaw from "@rat/remark-unicode-raw";

export interface RenderedMarkdown {
  markdown: string;
}

export async function renderMarkdown(input: string): Promise<RenderedMarkdown> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkUnicodeBussproofs)
    .use(remarkUnicodeMath)
    .use(remarkUnicodeMermaid)
    .use(remarkUnicodeInline)
    .use(remarkUnicodeTable)
    .use(remarkUnicodeCodeblock)
    .use(remarkUnicodeRaw)
    .use(remarkStringify, {
      bullet: "-",
      bulletOther: "*",
      fences: false,
      setext: true,
      incrementListMarker: true,
    })
    .process(input);

  return {
    markdown: String(file),
  };
}

export default renderMarkdown;
