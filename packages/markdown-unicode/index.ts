import * as arktype from "arktype";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkStringify from "remark-stringify";
import remarkSourcemap, { type RemarkSourcemapData } from "@rat/remark-sourcemap";
import remarkUnicodeInline from "@rat/remark-unicode-inline";
import remarkUnicodeBussproofs from "@rat/remark-unicode-bussproofs";
import remarkUnicodeMath from "@rat/remark-unicode-math";
import remarkUnicodeMermaid from "@rat/remark-unicode-mermaid";
import remarkUnicodeTable from "@rat/remark-unicode-table";
import remarkUnicodeCodeblock from "@rat/remark-unicode-codeblock";

export interface RenderedMarkdown {
  markdown: string;
  sourcemap: RemarkSourcemapData;
}

const SourcemapSegmentSchema = arktype.type({
  nodeType: "string",
  output: {
    start: { line: "number", column: "number", "offset?": "number" },
    end: { line: "number", column: "number", "offset?": "number" },
  },
  input: {
    start: { line: "number", column: "number", "offset?": "number" },
    end: { line: "number", column: "number", "offset?": "number" },
  },
});

const SourcemapDataSchema = arktype.type({
  sourcemap: {
    version: "2",
    segments: "unknown[]",
  },
});

function readSourcemapFromFileData(data: unknown): RemarkSourcemapData | undefined {
  const sourcemapValue = SourcemapDataSchema(data);
  if (sourcemapValue instanceof arktype.type.errors) return undefined;
  const sourcemap = sourcemapValue.sourcemap;
  const segments = sourcemap.segments.flatMap((segment) => {
    const validated = SourcemapSegmentSchema(segment);
    if (validated instanceof arktype.type.errors) return [];
    return [validated];
  });
  return {
    version: 2,
    segments,
  };
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
    .use(remarkSourcemap)
    .use(remarkStringify, {
      bullet: "-",
      bulletOther: "*",
      fences: false,
      setext: true,
      incrementListMarker: true,
    })
    .process(input);

  const sourcemap = readSourcemapFromFileData(file.data) ?? {
    version: 2,
    segments: [],
  };

  return {
    markdown: String(file),
    sourcemap,
  };
}

export default renderMarkdown;
