import { renderMarkdownToTerminalText } from "./terminal.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("renderMarkdownToTerminalText keeps already-rendered unicode table block", () => {
  const out = renderMarkdownToTerminalText(
    [
      "    ╭───┬───╮",
      "    │ A │ B │",
      "    ╰───┴───╯",
      "",
    ].join("\n"),
  );
  assert(out.includes("╭"), `expected table border: ${out}`);
  assert(out.includes("│ A │"), `expected table text: ${out}`);
  assert(out.includes("╯"), `expected table end: ${out}`);
});

Deno.test("renderMarkdownToTerminalText applies unicode-rich inline and block decoration", () => {
  const out = renderMarkdownToTerminalText(
    [
      "# Heading",
      "",
      "- [x] **done** and *slanted* with ~~old~~",
      "- item",
      "> quote",
      "",
      "plain **bold** text",
      "",
      '    const x = "**keep**";',
    ].join("\n"),
  );
  assert(out.includes("▌"), `expected heading marker: ${out}`);
  assert(out.includes("\u001b[1m"), `expected ANSI bold sequence: ${out}`);
  assert(out.includes("\u001b[3m"), `expected ANSI italic sequence: ${out}`);
  assert(
    out.includes("\u001b[9m") || out.includes("\u001b[53m"),
    `expected ANSI strikethrough sequence: ${out}`,
  );
  assert(out.includes("☑ "), `expected checkbox symbol: ${out}`);
  assert(out.includes("• item"), `expected bullet symbol: ${out}`);
  assert(out.includes("▌ quote"), `expected blockquote symbol: ${out}`);
  assert(
    out.includes('    const x = "**keep**";'),
    `code block content should be indented: ${out}`,
  );
});

Deno.test("renderMarkdownToTerminalText styles links with underline ANSI only", () => {
  const out = renderMarkdownToTerminalText(
    "Inline [OpenAI](...) and ref [Docs][id]\n\n[id]: ...\n",
  );
  assert(out.includes("\u001b[4m"), `underline ANSI should be used: ${out}`);
  assert(!out.includes("\u001b[36m"), `cyan ANSI should not be used: ${out}`);
});
