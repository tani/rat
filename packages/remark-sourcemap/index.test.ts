import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { VFile } from "vfile";
import type { Root } from "mdast";
import remarkSourcemap, { type RemarkSourcemapData } from "./index";

function readSourcemap(file: VFile): RemarkSourcemapData {
  const data = (file.data as { sourcemap?: RemarkSourcemapData }).sourcemap;
  if (!data) throw new Error("missing sourcemap");
  return data;
}

describe("remark-sourcemap", () => {
  test("emits generated/current line-number correspondence", async () => {
    const input = "# Title\n\nParagraph line.\n\n- a\n- b\n";
    const file = new VFile({ value: input });

    await unified().use(remarkParse).use(remarkSourcemap).use(remarkStringify).process(file);

    const map = readSourcemap(file);
    expect(map.generatedToCurrent[1]).toBe(1);
    expect(map.generatedToCurrent[3]).toBe(3);
    expect(map.currentToGenerated[5]).toBe(5);
  });

  test("maps shifted generated lines back to original lines", async () => {
    const input = "Paragraph line.\n";
    const file = new VFile({ value: input });

    const prependHeading = () => {
      return (tree: Root) => {
        tree.children.unshift({
          type: "heading",
          depth: 1,
          children: [{ type: "text", value: "Inserted" }],
        });
      };
    };

    await unified()
      .use(remarkParse)
      .use(prependHeading)
      .use(remarkSourcemap)
      .use(remarkStringify)
      .process(file);

    const map = readSourcemap(file);
    expect(map.generatedToCurrent[3]).toBe(2);
    expect(map.currentToGenerated[2]).toBe(4);
  });
});
