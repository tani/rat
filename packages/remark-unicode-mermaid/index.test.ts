import { expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnicodeMermaid from "./index";

test("remark-unicode-mermaid: renders mermaid code fences into diagram text", async () => {
  const input = `
\`\`\`mermaid
flowchart LR
A-->B
\`\`\`
`;

  const out = String(
    await unified().use(remarkParse).use(remarkUnicodeMermaid).use(remarkStringify).process(input),
  );

  expect(out).toContain("```");
  expect(out).toContain("```raw");
  expect(out).toContain("A--");
  expect(out).not.toContain("```mermaid");
});

test("remark-unicode-mermaid: does not change non-mermaid code fences", async () => {
  const input = `
\`\`\`ts
const x = 1;
\`\`\`
`;

  const out = String(
    await unified().use(remarkParse).use(remarkUnicodeMermaid).use(remarkStringify).process(input),
  );

  expect(out).toContain("```ts");
  expect(out).toContain("const x = 1;");
});

test("remark-unicode-mermaid: keeps original mermaid source on renderer failure", async () => {
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

test("remark-unicode-mermaid: strips node labels from mermaid source code", async () => {
  const input = `
\`\`\`mermaid
flowchart LR
A[Input markdown] --> B(Parse mdast)
participant U as User
\`\`\`
`;

  let renderedSource = "";
  const out = String(
    await unified()
      .use(remarkParse)
      .use(remarkUnicodeMermaid, {
        render(source) {
          renderedSource = source;
          return "rendered";
        },
      })
      .use(remarkStringify)
      .process(input),
  );

  expect(renderedSource).toContain("A --> B");
  expect(renderedSource).not.toContain("[Input markdown]");
  expect(renderedSource).not.toContain("(Parse mdast)");
  expect(renderedSource).toContain("participant U");
  expect(renderedSource).not.toContain("as User");
  expect(out).toContain("rendered");
});
