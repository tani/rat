import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeBussproofs from "./index";

describe("remark-unicode-bussproofs", () => {
  test("renders bussproofs code blocks and strips language", async () => {
    const input = String.raw`~~~bussproofs
\AxiomC{$A$}
\AxiomC{$A \to B$}
\RightLabel{$\to E$}
\BinaryInfC{$B$}
~~~
`;

    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkUnicodeBussproofs)
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("A → B");
    expect(out).toContain("→ E");
    expect(out).toContain("─");
    expect(out).not.toContain("AxiomC");
    expect(out).not.toContain("~~~bussproofs");
  });

  test("renders prooftree content in generic code blocks", async () => {
    const input = String.raw`~~~text
\begin{prooftree}
\AxiomC{$P$}
\UnaryInfC{$P$}
\end{prooftree}
~~~
`;

    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkUnicodeBussproofs)
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("P");
    expect(out).toContain("─");
    expect(out).not.toContain("\\begin{prooftree}");
  });

  test("renders bussproofs inside display math blocks", async () => {
    const input = String.raw`$$
\begin{prooftree}
\AxiomC{$A$}
\AxiomC{$A \to B$}
\RightLabel{$\to E$}
\BinaryInfC{$B$}
\end{prooftree}
$$
`;

    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkUnicodeBussproofs)
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("A → B");
    expect(out).toContain("→ E");
    expect(out).toContain("─");
    expect(out).not.toContain("$$");
    expect(out).not.toContain("\\begin{prooftree}");
  });
});
