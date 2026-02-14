import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeInline from "./index";

describe("remark-unicode-inline", () => {
  test("italic, bold, and bold italic map to sans-serif mathematical alphabets", async () => {
    const input = "*abc* **abc123** ***abc***";
    const out = String(
      await unified().use(remarkParse).use(remarkUnicodeInline).use(remarkStringify).process(input),
    );

    expect(out.trim()).toBe("𝘢𝘣𝘤 𝗮𝗯𝗰𝟭𝟮𝟯 𝙖𝙗𝙘");
  });

  test("delete maps to combining long stroke overlay", async () => {
    const input = "~~abc~~";
    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkUnicodeInline)
        .use(remarkStringify)
        .process(input),
    );

    expect(out.trim()).toBe("a\u0336b\u0336c\u0336");
  });

  test("link removes url and underlines alt text", async () => {
    const input = "[alt_text](https://hostname/path/to/file)";
    const out = String(
      await unified().use(remarkParse).use(remarkUnicodeInline).use(remarkStringify).process(input),
    );

    expect(out.trim().replaceAll("\\", "")).toBe(
      "a\u0332l\u0332t\u0332_\u0332t\u0332e\u0332x\u0332t\u0332",
    );
    expect(out).not.toContain("https://hostname/path/to/file");
  });

  test("output inline content is plain text nodes", async () => {
    const processor = unified().use(remarkParse).use(remarkUnicodeInline);
    const tree = processor.parse("This is **bold** and [link](https://a.b)");
    const transformed = processor.runSync(tree);

    const paragraph = transformed.children[0] as {
      type: string;
      children: Array<{ type: string; value: string }>;
    };
    expect(paragraph.type).toBe("paragraph");
    expect(paragraph.children).toHaveLength(1);
    expect(paragraph.children[0].type).toBe("text");
  });
});
