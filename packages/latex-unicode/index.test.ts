import { describe, expect, test } from "bun:test";
import { renderLatex } from "./index";

describe("latex-unicode inline", () => {
  test("renders inline text commands with unicode styling", async () => {
    const out = await renderLatex("A \\textbf{abc123} and \\textit{XYZ}.");
    expect(out).toContain("𝗮𝗯𝗰𝟭𝟮𝟯");
    expect(out).toContain("𝘟𝘠𝘡");
  });

  test("renders inline math with unicodeit", async () => {
    const out = await renderLatex("Energy: $E=mc^2$ and $\\alpha+\\beta$.");
    expect(out).toContain("E=mc²");
    expect(out).toContain("α+β");
  });

  test("renders inline parenthesized math with unicodeit", async () => {
    const out = await renderLatex("Term: \\(\\alpha^2 + \\beta\\).");
    expect(out).toContain("α² + β");
  });
});

describe("latex-unicode display", () => {
  test("renders display math with display renderer strategy", async () => {
    const out = await renderLatex("before $$\\frac{1}{2}$$ after");
    expect(out).not.toContain("\\frac");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  test("renders multiline $$ display blocks", async () => {
    const source = "before\n$$\n\\frac{1}{2} + \\sum_{k=1}^{n} k\n$$\nafter";
    const out = await renderLatex(source);
    expect(out).not.toContain("\\frac");
    expect(out).not.toContain("$$");
    const lines = out.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]).toContain("before");
    expect(lines[lines.length - 1]).toContain("after");
    expect(lines.slice(1, -1).join("\n").trim().length).toBeGreaterThan(0);
  });

  test("renders multiline \\[ \\] display blocks", async () => {
    const source = "x\n\\[\n\\frac{a}{b}\n\\]\ny";
    const out = await renderLatex(source);
    expect(out).not.toContain("\\frac");
    expect(out).not.toContain("\\[");
    expect(out).not.toContain("\\]");
    const lines = out.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain("x");
    expect(lines[lines.length - 1]).toContain("y");
    expect(lines.slice(1, -1).join("\n").trim().length).toBeGreaterThan(0);
  });

  test("renders align/aligned environments as display math", async () => {
    const source = String.raw`\begin{aligned}
a &= b \\
c &= d
\end{aligned}`;
    const out = await renderLatex(source);
    expect(out).not.toContain("\\begin{aligned}");
    const lines = out.split("\n").filter((line) => line.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.join("\n")).toContain("a");
    expect(lines.join("\n")).toContain("c");
  });
});
