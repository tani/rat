import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeMermaid from "./index";

describe("remark-unicode-mermaid", () => {
  test("renders mermaid code fences into diagram text", async () => {
    const input = `
\`\`\`mermaid
flowchart LR
A-->B
\`\`\`
`;

    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkUnicodeMermaid)
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("```");
    expect(out).toContain("A--");
    expect(out).not.toContain("```mermaid");
  });

  test("does not change non-mermaid code fences", async () => {
    const input = `
\`\`\`ts
const x = 1;
\`\`\`
`;

    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkUnicodeMermaid)
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("```ts");
    expect(out).toContain("const x = 1;");
  });

  test("keeps original mermaid source on renderer failure", async () => {
    const input = `
\`\`\`mermaid
flowchart LR
A-->B
\`\`\`
`;

    const out = String(
      await unified()
        .use(remarkParse)
        .use(remarkUnicodeMermaid, {
          render() {
            throw new Error("forced failure");
          },
        })
        .use(remarkStringify)
        .process(input),
    );

    expect(out).toContain("```mermaid");
    expect(out).toContain("flowchart LR");
    expect(out).toContain("A-->B");
  });
});
