import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeTable from "./index";

describe("remark-unicode-table", () => {
  test("converts gfm table to unicode box-drawing table", async () => {
    const input = `| Name | Score |\n| --- | --- |\n| Alice | 10 |\n| Bob | 9 |\n`;
    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkUnicodeTable)
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("┌");
    expect(out).toContain("┬");
    expect(out).toContain("┐");
    expect(out).toContain("│ Name");
    expect(out).toContain("│ Alice");
    expect(out).not.toContain("| Name |");
  });

  test("handles column alignment", async () => {
    const input = `| Left | Center | Right |\n| :--- | :----: | ----: |\n| a | bb | 1 |\n| ccc | d | 22 |\n`;
    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkUnicodeTable)
        .use(remarkStringify)
        .process(input),
    );

    const lines = out.split("\n");
    const dataLine = lines.find((line) => line.includes("bb"));
    expect(dataLine).toBeDefined();
    expect(out).toContain("│ a    │   bb   │     1 │");
    expect(out).toContain("│ ccc  │   d    │    22 │");
  });
});
