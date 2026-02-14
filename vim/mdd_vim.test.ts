import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function hasNvim(): boolean {
  const probe = Bun.spawnSync(["nvim", "--version"], { stdout: "ignore", stderr: "ignore" });
  return probe.exitCode === 0;
}

function writeMockMdd(tempDir: string): void {
  const script = [
    "#!/usr/bin/env bash",
    'log_file="$(dirname "$0")/requests.log"',
    "while IFS= read -r line; do",
    '  printf \'%s\\n\' "$line" >> "$log_file"',
    "  id=$(printf '%s' \"$line\" | sed -n 's/.*\"id\":[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p')",
    '  if [ -z "$id" ]; then',
    "    id=1",
    "  fi",
    '  printf \'{"jsonrpc":"2.0","id":%s,"result":{"markdown":"Rendered Preview\\\\n\\\\nline x\\\\n","sourcemap":{"version":2,"segments":[{"nodeType":"paragraph","input":{"start":{"line":1,"column":1},"end":{"line":200,"column":1}},"output":{"start":{"line":10,"column":1},"end":{"line":10,"column":1}}}]},"previewLine":10}}\\\\n\' "$id"',
    "done",
    "",
  ].join("\n");
  const path = join(tempDir, "mdd");
  writeFileSync(path, script);
  chmodSync(path, 0o755);
}

function writeNvimScript(tempDir: string, repoRoot: string): string {
  const script = [
    "set nomore",
    `execute 'set rtp^=' . fnameescape('${repoRoot}/vim')`,
    "runtime plugin/mdd.vim",
    `execute 'cd ' . fnameescape('${tempDir}')`,
    "edit test.md",
    "call setline(1, ['# Title', '', '*abc*'])",
    "MddPreviewOpen",
    "sleep 300m",
    "call setline(4, 'edited-unsaved')",
    "doautocmd TextChanged",
    "sleep 300m",
    "MddPreviewClose",
    "qa!",
    "",
  ].join("\n");

  const scriptPath = join(tempDir, "test.vim");
  writeFileSync(scriptPath, script);
  return scriptPath;
}

describe("vim preview plugin", () => {
  test("sends live unsaved buffer updates over json-rpc", () => {
    if (!hasNvim()) {
      expect(true).toBe(true);
      return;
    }

    const repoRoot = resolve(process.cwd());
    const tempDir = mkdtempSync(join(tmpdir(), "mdd-vim-test-"));

    try {
      writeMockMdd(tempDir);
      const scriptPath = writeNvimScript(tempDir, repoRoot);

      const proc = Bun.spawnSync(
        ["nvim", "-u", "NONE", "-i", "NONE", "-n", "--headless", "-S", scriptPath],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            PATH: `${tempDir}:${process.env.PATH ?? ""}`,
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );

      const stderr = proc.stderr.toString();
      const stdout = proc.stdout.toString();
      const requestsPath = join(tempDir, "requests.log");
      const requests = existsSync(requestsPath) ? readFileSync(requestsPath, "utf8") : "";

      expect(stderr).toBe("");
      expect(stdout).toBe("");
      expect(proc.exitCode).toBe(0);
      expect(requests).toContain('"method": "render"');
      expect(requests).toContain("edited-unsaved");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
