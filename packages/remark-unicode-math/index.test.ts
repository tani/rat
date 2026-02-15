import { expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkMath from "remark-math";
import remarkUnicodeMath from "./index";

test("remark-unicode-math: converts inline math to inline code with unicodeit", async () => {
  const input = String.raw`Inline $\alpha + \beta$ test.`;
  const out = String(
    await unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkUnicodeMath)
      .use(remarkStringify)
      .process(input),
  );

  expect(out).toContain("`α + β`");
});

test("remark-unicode-math: converts display math to fenced code block", async () => {
  const input = String.raw`$$
\frac{1}{2}
$$
`;
  const out = String(
    await unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkUnicodeMath)
      .use(remarkStringify, { fences: true })
      .process(input),
  );

  expect(out).toContain("```raw\n");
  expect(out).toContain("\n```\n");
  expect(out).not.toContain("$$");
});

test("remark-unicode-math: falls back to unicodeit when display renderer fails", async () => {
  const input = String.raw`$$
\left( x
$$
`;
  const out = String(
    await unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkUnicodeMath, {
        displayRenderer() {
          throw new Error("forced failure");
        },
      })
      .use(remarkStringify, { fences: true })
      .process(input),
  );

  expect(out).toContain("```raw\n");
  expect(out).toContain("≤ft( x");
  expect(out).not.toContain("$$");
});
