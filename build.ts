#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

interface BuildTarget {
  target:
    | "bun-darwin-arm64"
    | "bun-darwin-x64"
    | "bun-linux-x64"
    | "bun-linux-arm64"
    | "bun-windows-x64";
  outfile: string;
}

const ROOT_DIR = import.meta.dir;
const OUT_DIR = join(ROOT_DIR, "dist");
const ENTRYPOINT = join(ROOT_DIR, "packages/cli/index.ts");

const TARGETS: BuildTarget[] = [
  { target: "bun-darwin-arm64", outfile: join(OUT_DIR, "rat-darwin-arm64") },
  { target: "bun-darwin-x64", outfile: join(OUT_DIR, "rat-darwin-x64") },
  { target: "bun-linux-x64", outfile: join(OUT_DIR, "rat-linux-x64") },
  { target: "bun-linux-arm64", outfile: join(OUT_DIR, "rat-linux-arm64") },
  { target: "bun-windows-x64", outfile: join(OUT_DIR, "rat-windows-x64.exe") },
];

async function buildTarget(target: BuildTarget): Promise<void> {
  await mkdir(dirname(target.outfile), { recursive: true });
  process.stdout.write(`[compile] ${target.target} -> ${target.outfile}\n`);

  const proc = Bun.spawn(
    [
      "bun",
      "build",
      ENTRYPOINT,
      "--compile",
      "--target",
      target.target,
      "--outfile",
      target.outfile,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`build failed for ${target.target}`);
  }
}

async function main(): Promise<void> {
  await Promise.all(TARGETS.map((target) => buildTarget(target)));
  process.stdout.write(`[done] binaries written to ${OUT_DIR}\n`);
}

await main();
