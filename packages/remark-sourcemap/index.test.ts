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

function hasLineMapping(map: RemarkSourcemapData, outputLine: number, inputLine: number): boolean {
  return map.segments.some((segment) => {
    const out = segment.output;
    const input = segment.input;
    return (
      outputLine >= out.start.line &&
      outputLine <= out.end.line &&
      inputLine >= input.start.line &&
      inputLine <= input.end.line
    );
  });
}

describe("remark-sourcemap", () => {
  test("emits v2 range segments that cover expected line mappings", async () => {
    const input = "# Title\n\nParagraph line.\n\n- a\n- b\n";
    const file = new VFile({ value: input });

    await unified().use(remarkParse).use(remarkSourcemap).use(remarkStringify).process(file);

    const map = readSourcemap(file);
    expect(map.version).toBe(2);
    expect(map.segments.length).toBeGreaterThan(0);
    expect(hasLineMapping(map, 1, 1)).toBeTrue();
    expect(hasLineMapping(map, 3, 3)).toBeTrue();
    expect(hasLineMapping(map, 5, 5)).toBeTrue();
  });

  test("keeps stable mappings after inserting unpositioned nodes", async () => {
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
    expect(hasLineMapping(map, 3, 2)).toBeTrue();
    expect(hasLineMapping(map, 4, 2)).toBeTrue();
  });
});
