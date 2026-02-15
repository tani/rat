import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "./index";

describe("@rat/markdown-unicode renderMarkdown", () => {
  test("renders markdown via integrated pipeline", async () => {
    const input = `# Title\n\n*abc* and **abc123** and [alt_text](https://example.com/x)\n\n| A | B |\n| - | -: |\n| x | 1 |\n\n$$\n\\frac{1}{2}\n$$\n`;

    const out = await renderMarkdown(input);

    expect(out.markdown).toContain("Title");
    expect(out.markdown).toContain("𝘢𝘣𝘤");
    expect(out.markdown).toContain("𝗮𝗯𝗰𝟭𝟮𝟯");
    expect(out.markdown).toContain("a̲l̲t̲\\_̲t̲e̲x̲t̲");
    expect(out.markdown).toContain("┌");
    expect(out.markdown).toContain("─");
    expect(out.sourcemap.version).toBe(2);
    expect(out.sourcemap.segments.length).toBeGreaterThan(0);
  });

  test("uses setext headings and non-fenced code blocks", async () => {
    const input = "# Heading\n\n```mermaid\nflowchart LR\nA-->B\n```\n";
    const out = await renderMarkdown(input);

    expect(out.markdown).toContain("Heading\n=======");
    expect(out.markdown).not.toContain("```");
    expect(out.markdown).toContain("    ");
  });

  test("enumerates ordered lists correctly", async () => {
    const input = "1. first\n1. second\n1. third\n";
    const out = await renderMarkdown(input);

    expect(out.markdown).toContain("1. first");
    expect(out.markdown).toContain("2. second");
    expect(out.markdown).toContain("3. third");
  });

  test("autolinks bare http URLs", async () => {
    const input = "visit http://example.com now\n";
    const out = await renderMarkdown(input);

    expect(out.markdown).toContain("h̲t̲t̲p̲:̲/̲/̲e̲x̲a̲m̲p̲l̲e̲.̲c̲o̲m̲");
  });
});
