import { main } from "./server/main.ts";
import { renderMarkdownToInkText } from "./markdown/ink.ts";
import { renderMarkdown } from "./markdown/processors.ts";
import { MIN_COLS } from "./core/shared.ts";

type CliMode =
  | { kind: "server" }
  | { kind: "file"; path: string }
  | { kind: "stdin" }
  | { kind: "error"; message: string };

export function resolveCliMode(args: string[]): CliMode {
  if (args.includes("--server")) {
    return { kind: "server" };
  }
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length === 1) return { kind: "file", path: positional[0] };
  if (positional.length === 0) return { kind: "stdin" };
  return {
    kind: "error",
    message:
      "usage: deno run -A src/mdd.ts --server | deno run -A src/mdd.ts <markdown-path> | cat file.md | deno run -A src/mdd.ts",
  };
}

function detectPrintWidth(): number {
  try {
    const { columns } = Deno.consoleSize();
    return Math.max(MIN_COLS, columns);
  } catch {
    return 80;
  }
}

async function renderToStdout(input: string): Promise<void> {
  const out = await renderMarkdown(input, detectPrintWidth());
  const text = renderMarkdownToInkText(out.markdown);
  await Deno.stdout.write(new TextEncoder().encode(text));
}

async function runCli(args: string[]): Promise<void> {
  const mode = resolveCliMode(args);
  switch (mode.kind) {
    case "server":
      await main();
      return;
    case "file": {
      const text = await Deno.readTextFile(mode.path);
      await renderToStdout(text);
      return;
    }
    case "stdin":
      if (Deno.stdin.isTerminal()) {
        console.error(
          "stdin is a terminal; pass --server or a markdown file path",
        );
        Deno.exit(1);
      }
      await renderToStdout(await new Response(Deno.stdin.readable).text());
      return;
    case "error":
      console.error(mode.message);
      Deno.exit(1);
  }
}

runCli(Deno.args).catch((err) => {
  console.error(err);
  Deno.exit(1);
});
