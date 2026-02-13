import type { Nodes, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import {
  remarkPrettier,
  remarkRenderMath,
  remarkRenderMermaidAscii,
  remarkShortenLinks,
} from "./plugins.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("remarkRenderMath rewrites inline and block math nodes", () => {
  const parser = unified().use(remarkParse).use(remarkMath);
  const tree = parser.parse(`inline $\\alpha$

$$
\\beta
$$
`) as Root;
  const transformed = unified().use(remarkRenderMath).runSync(tree) as Root;

  const inlineValues: string[] = [];
  const blockValues: string[] = [];
  visit(transformed, "text", (node) => {
    inlineValues.push(String((node as { value?: string }).value ?? ""));
  });
  visit(transformed, "code", (node) => {
    blockValues.push(String((node as { value?: string }).value ?? ""));
  });
  const inlineText = inlineValues.join("");
  assert(
    inlineText.includes("α"),
    `inline math should be replaced with unicode text: ${inlineText}`,
  );
  assert(
    blockValues.length > 0,
    "block math should be converted to code node",
  );

  const markdown = String(
    unified().use(remarkStringify, { fences: true }).stringify(transformed),
  );
  assert(
    markdown.includes("α"),
    `inline math should be plain text: ${markdown}`,
  );
  assert(
    markdown.includes("```"),
    `block math should be wrapped in fenced code when fences are enabled: ${markdown}`,
  );
});

Deno.test("remarkRenderMermaidAscii processes mermaid code blocks safely", async () => {
  const out = await unified()
    .use(remarkParse)
    .use(remarkRenderMermaidAscii)
    .use(remarkStringify, { fences: true })
    .process("```mermaid\\ngraph TD\\nA-->B\\n```\\n");
  const text = String(out);
  assert(text.length > 0, "processor output should not be empty");
  assert(
    text.includes("`"),
    `code formatting should remain markdown code: ${text}`,
  );
});

Deno.test("remarkPrettier formats markdown content via prettified reparse", async () => {
  const out = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkPrettier, { printWidth: 80 })
    .use(remarkStringify, {
      fences: false,
      bullet: "-",
      incrementListMarker: false,
    })
    .process("# T\n\n-    one\n-   two\n\n|a|b|\n|-|-:|\n|1|2|\n");

  const text = String(out);
  assert(text.includes("- one"), `list item should be normalized: ${text}`);
  assert(text.includes("| a |"), `table should be normalized: ${text}`);
  assert(text.includes("| 1 |"), `table row should be normalized: ${text}`);
});

Deno.test("remarkPrettier preserves source position with fuzzy mdast mapping", async () => {
  const input = [
    "# T",
    "",
    "This paragraph is intentionally long so prettier wraps it into multiple lines when print width is small.",
    "",
  ].join("\n");
  const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  const original = parser.parse(input) as Root;
  const rebuilt = await unified().use(remarkPrettier, { printWidth: 20 }).run(
    original,
  ) as Root;

  let originalLine = -1;
  visit(original as Nodes, "paragraph", (node) => {
    if (toString(node).includes("intentionally long")) {
      originalLine =
        (node as { position?: { end?: { line?: number } } }).position?.end
          ?.line ?? -1;
    }
  });
  let rebuiltLine = -1;
  visit(rebuilt as Nodes, "paragraph", (node) => {
    if (toString(node).includes("intentionally long")) {
      rebuiltLine =
        (node as { position?: { end?: { line?: number } } }).position?.end
          ?.line ?? -1;
    }
  });

  assert(originalLine > 0, "original paragraph should have end line");
  assert(
    rebuiltLine === originalLine,
    `rebuilt paragraph should keep line ${originalLine}, got ${rebuiltLine}`,
  );
});

Deno.test("remarkShortenLinks rewrites markdown link destinations", async () => {
  const out = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkShortenLinks)
    .use(remarkStringify, { fences: true })
    .process(
      "[OpenAI](https://openai.com)\n\n[ref-link][id]\n\n[id]: https://example.com/path\n",
    );

  const text = String(out);
  assert(
    text.includes("[OpenAI](...)"),
    `inline link should be shortened: ${text}`,
  );
  assert(
    text.includes("[id]: ..."),
    `reference link definition should be shortened: ${text}`,
  );
});
