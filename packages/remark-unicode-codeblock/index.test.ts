import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeCodeblock from "./index";

describe("remark-unicode-codeblock", () => {
  test("converts code block content to mathematical monospace", async () => {
    const input = "```txt\nAbc123 +-*/\n```\n";
    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkUnicodeCodeblock)
        .use(remarkStringify, { fences: true })
        .process(input),
    );

    expect(out).toContain("𝙰𝚋𝚌𝟷𝟸𝟹 +-*/");
    expect(out).not.toContain("```txt");
  });
});
