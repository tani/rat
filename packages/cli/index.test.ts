import { describe, expect, test } from "bun:test";

describe("@mdd/cli", () => {
  test("reads from stdin and writes rendered markdown to stdout", async () => {
    const proc = Bun.spawn(["bun", "packages/cli/index.ts"], {
      stdin: new Response("# Title\n\n*abc*\n").body,
      stdout: "pipe",
      stderr: "pipe",
    });

    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(err).toBe("");
    expect(out).toContain("Title\n=====");
    expect(out).toContain("𝘢𝘣𝘤");
  });
});
