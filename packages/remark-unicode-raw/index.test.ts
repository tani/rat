import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeRaw from "./index";

describe("remark-unicode-raw", () => {
  test("removes raw language from code blocks", async () => {
    const input = "~~~raw\nA -> B\n~~~\n";
    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkUnicodeRaw)
        .use(remarkStringify, { fences: true })
        .process(input),
    );

    expect(out).toContain("```\nA -> B");
    expect(out).not.toContain("```raw");
  });

  test("keeps non-raw language untouched", async () => {
    const input = "~~~mermaid\nA-->B\n~~~\n";
    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkUnicodeRaw)
        .use(remarkStringify, { fences: true })
        .process(input),
    );

    expect(out).toContain("```mermaid");
  });
});
