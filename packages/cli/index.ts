#!/usr/bin/env bun
import { renderMarkdown } from "@mdd/core";

async function readStdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text();
}

async function main(): Promise<void> {
  const input = await readStdin();
  const { markdown } = await renderMarkdown(input);
  process.stdout.write(markdown);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
