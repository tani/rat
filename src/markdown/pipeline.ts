import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import {
  remarkNormalizeCodeBlocks,
  remarkPrettier,
  remarkRenderMath,
  remarkRenderMermaidAscii,
  remarkRenderTable,
  remarkShortenLinks,
} from "./plugins/index.ts";
import {
  type PositionMapEntry,
  REMARK_STRINGIFY_OPTIONS,
  type RenderMarkdownResult,
} from "./types.ts";
import { MIN_COLS, normalizeNewlines } from "../core/shared.ts";

function createMarkdownPipeline() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRenderMath)
    .use(remarkRenderMermaidAscii)
    .use(remarkRenderTable)
    .use(remarkNormalizeCodeBlocks)
    .use(remarkShortenLinks)
    .use(remarkPrettier)
    .use(remarkStringify, REMARK_STRINGIFY_OPTIONS);
}

function createMarkdownToMarkdownProcessor() {
  const processor = createMarkdownPipeline();
  return {
    async process(
      input: string,
      printWidth: number,
    ): Promise<RenderMarkdownResult> {
      const file = await processor.process({
        value: input,
        data: { printWidth: Math.max(MIN_COLS, printWidth) },
      });
      return {
        markdown: `${String(file).replace(/\n{3,}/g, "\n\n").trimEnd()}\n`,
        positionMap:
          ((file.data as { positionMap?: PositionMapEntry[] } | undefined)
            ?.positionMap ?? []),
      };
    },
  };
}

const markdownToMarkdownProcessor = createMarkdownToMarkdownProcessor();

function normalizeRenderedEntities(markdown: string): string {
  return markdown
    .replace(/&#x20;/gi, " ")
    .replace(/&#32;/g, " ");
}

export async function renderMarkdown(
  input: string,
  printWidth: number,
): Promise<RenderMarkdownResult> {
  const out = await markdownToMarkdownProcessor.process(
    normalizeNewlines(input),
    printWidth,
  );
  return {
    ...out,
    markdown: normalizeRenderedEntities(out.markdown),
  };
}
