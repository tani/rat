import { expect, test } from "bun:test";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeInline from "./index";

test("remark-unicode-inline: italic, bold, and bold italic map to sans-serif mathematical alphabets", async () => {
  const input = "*abc* **abc123** ***abc***";
  const out = String(
    await unified().use(remarkParse).use(remarkUnicodeInline).use(remarkStringify).process(input),
  );

  expect(out.trim()).toBe("𝘢𝘣𝘤 𝗮𝗯𝗰𝟭𝟮𝟯 𝙖𝙗𝙘");
});

test("remark-unicode-inline: delete maps to combining long stroke overlay", async () => {
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

test("remark-unicode-inline: link removes url and underlines alt text", async () => {
  const input = "[alt_text](https://hostname/path/to/file)";
  const out = String(
    await unified().use(remarkParse).use(remarkUnicodeInline).use(remarkStringify).process(input),
  );

  expect(out.trim().replaceAll("\\", "")).toBe(
    "a\u0332l\u0332t\u0332_\u0332t\u0332e\u0332x\u0332t\u0332",
  );
  expect(out).not.toContain("https://hostname/path/to/file");
});

test("remark-unicode-inline: output inline content is plain text nodes", () => {
  const processor = unified().use(remarkParse).use(remarkUnicodeInline);
  const tree = processor.parse("This is **bold** and [link](https://a.b)");
  const transformed = processor.runSync(tree);

  const paragraph = transformed.children[0];
  if (!paragraph) throw new Error("missing paragraph");
  expect(paragraph.type).toBe("paragraph");
  if (!("children" in paragraph) || !Array.isArray(paragraph.children)) {
    throw new Error("paragraph node should have children");
  }
  expect(paragraph.children).toHaveLength(1);
  const firstChild = paragraph.children[0];
  expect(firstChild).toBeDefined();
  expect(firstChild?.type).toBe("text");
});

test("remark-unicode-inline: inline code maps to mathematical monospace", async () => {
  const input = "`Abc123`";
  const out = String(
    await unified().use(remarkParse).use(remarkUnicodeInline).use(remarkStringify).process(input),
  );

  expect(out.trim()).toBe("𝙰𝚋𝚌𝟷𝟸𝟹");
});
