import { describe, expect, test } from "bun:test";
import { renderLatex } from "./index";

describe("latex-unicode inline", () => {
  test("renders inline text commands with unicode styling", async () => {
    const out = await renderLatex("A \\textbf{abc123} and \\textit{XYZ} and \\texttt{Abc123}.");
    expect(out.text).toContain("𝗮𝗯𝗰𝟭𝟮𝟯");
    expect(out.text).toContain("𝘟𝘠𝘡");
    expect(out.text).toContain("𝙰𝚋𝚌𝟷𝟸𝟹");
    expect(out.sourcemap.version).toBe(2);
    expect(out.sourcemap.segments.length).toBeGreaterThan(0);
  });

  test("renders inline math with unicodeit", async () => {
    const out = await renderLatex("Energy: $E=mc^2$ and $\\alpha+\\beta$.");
    expect(out.text).toContain("E=mc²");
    expect(out.text).toContain("α+β");
  });

  test("renders inline parenthesized math with unicodeit", async () => {
    const out = await renderLatex("Term: \\(\\alpha^2 + \\beta\\).");
    expect(out.text).toContain("α² + β");
  });

  test("renders \\verb with typewriter style", async () => {
    const out = await renderLatex("Code: \\verb|Abc123| and \\verb*+Xy9+.");
    expect(out.text).toContain("Code: 𝙰𝚋𝚌𝟷𝟸𝟹 and 𝚇𝚢𝟿.");
  });
});

describe("latex-unicode display", () => {
  test("renders display math with display renderer strategy", async () => {
    const out = await renderLatex("before $$\\frac{1}{2}$$ after");
    expect(out.text).not.toContain("\\frac");
    expect(out.text).toContain("before");
    expect(out.text).toContain("after");
    expect(out.sourcemap.segments.length).toBeGreaterThan(0);
  });

  test("renders multiline $$ display blocks", async () => {
    const source = "before\n$$\n\\frac{1}{2} + \\sum_{k=1}^{n} k\n$$\nafter";
    const out = await renderLatex(source);
    expect(out.text).not.toContain("\\frac");
    expect(out.text).not.toContain("$$");
    const lines = out.text.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]).toContain("before");
    expect(lines[lines.length - 1]).toContain("after");
    expect(lines.slice(1, -1).join("\n").trim().length).toBeGreaterThan(0);
  });

  test("renders multiline \\[ \\] display blocks", async () => {
    const source = "x\n\\[\n\\frac{a}{b}\n\\]\ny";
    const out = await renderLatex(source);
    expect(out.text).not.toContain("\\frac");
    expect(out.text).not.toContain("\\[");
    expect(out.text).not.toContain("\\]");
    const lines = out.text.split("\n");
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
    expect(out.text).not.toContain("\\begin{aligned}");
    const lines = out.text.split("\n").filter((line) => line.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.join("\n")).toContain("a");
    expect(lines.join("\n")).toContain("c");
  });
});
