import { describe, expect, test } from "bun:test";
import { renderBussproofs } from "./index";

function width(value: string): number {
  return Array.from(value).length;
}

describe("bussproofs-unicode", () => {
  test("renders unary proof in natural deduction style", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$A \to B$}
\UnaryInfC{$A \to B$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    expect(out).toContain("A → B");
    expect(out).toContain("─");
    expect(out).not.toContain("└─");
    expect(out).not.toContain("├─");
  });

  test("renders binary proof in natural deduction style", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$A$}
\AxiomC{$B$}
\BinaryInfC{$A \land B$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    expect(out).toContain("A ∧ B");
    expect(out).toContain("A");
    expect(out).toContain("B");
    expect(out).toContain("─");
    expect(out).not.toContain("├─");
    expect(out).not.toContain("└─");

    const lines = out.split("\n");
    const premiseLine = lines[0]?.trim() ?? "";
    const ruleLine = lines.find((line) => line.includes("─")) ?? "";
    const bar = /─+/u.exec(ruleLine)?.[0] ?? "";
    expect(width(bar)).toBeGreaterThanOrEqual(width(premiseLine) + 1);
  });

  test("applies left/right labels to next inference", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$A$}
\RightLabel{$r$}
\UnaryInfC{$B$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    const lines = out.split("\n");
    const ruleLine = lines.find((line) => line.includes("─")) ?? "";
    const conclusion = lines[lines.length - 1] ?? "";
    expect(ruleLine).toContain("r");
    expect(conclusion.trim()).toBe("B");
    expect(conclusion).not.toContain("r");
  });

  test("places right label on binary inference line", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$A$}
\AxiomC{$A \to B$}
\RightLabel{$\to E$}
\BinaryInfC{$B$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    const lines = out.split("\n");
    const ruleLine = lines.find((line) => line.includes("─")) ?? "";
    const conclusion = lines[lines.length - 1] ?? "";
    expect(ruleLine).toContain("→ E");
    expect(ruleLine.trimEnd()).toMatch(/─+\s+→ E$/u);
    expect(conclusion.trim()).toBe("B");
    expect(conclusion).not.toContain("→ E");
  });

  test("places left label on binary inference line", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$P$}
\AxiomC{$Q$}
\LeftLabel{$\land I$}
\BinaryInfC{$P \land Q$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    const lines = out.split("\n");
    const ruleLine = lines.find((line) => line.includes("─")) ?? "";
    const conclusion = lines[lines.length - 1] ?? "";
    expect(ruleLine).toContain("∧ I");
    expect(ruleLine).toMatch(/^∧ I\s+─+/u);
    expect(conclusion.trim()).toBe("P ∧ Q");
    expect(conclusion).not.toContain("∧ I");
  });

  test("supports both left and right labels on the same inference line", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$A$}
\LeftLabel{$L$}
\RightLabel{$R$}
\UnaryInfC{$B$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    const lines = out.split("\n");
    const ruleLine = lines.find((line) => line.includes("─")) ?? "";
    const conclusion = lines[lines.length - 1] ?? "";
    expect(ruleLine).toContain("L");
    expect(ruleLine).toContain("R");
    expect(ruleLine).toMatch(/^L\s+─+/u);
    expect(ruleLine.trimEnd()).toMatch(/─+\s+R$/u);
    expect(conclusion.trim()).toBe("B");
    expect(conclusion).not.toContain("L");
    expect(conclusion).not.toContain("R");
  });

  test("consumes a label on the next inference only", () => {
    const input = String.raw`\begin{prooftree}
\AxiomC{$A$}
\RightLabel{$r$}
\UnaryInfC{$B$}
\UnaryInfC{$C$}
\end{prooftree}`;

    const out = renderBussproofs(input);
    const ruleLines = out.split("\n").filter((line) => line.includes("─"));
    expect(ruleLines.length).toBe(2);
    expect(ruleLines[0]).toContain("r");
    expect(ruleLines[1]).not.toContain("r");
  });
});
