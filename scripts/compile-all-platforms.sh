#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist"
ENTRYPOINT="$ROOT_DIR/packages/cli/index.ts"

mkdir -p "$OUT_DIR"

build_target() {
  local target="$1"
  local outfile="$2"
  echo "[compile] $target -> $outfile"
  bun build --compile --target="$target" --outfile="$outfile" "$ENTRYPOINT"
}

build_target "bun-darwin-arm64" "$OUT_DIR/mdd-darwin-arm64"
build_target "bun-darwin-x64" "$OUT_DIR/mdd-darwin-x64"
build_target "bun-linux-x64" "$OUT_DIR/mdd-linux-x64"
build_target "bun-linux-arm64" "$OUT_DIR/mdd-linux-arm64"
build_target "bun-windows-x64" "$OUT_DIR/mdd-windows-x64.exe"

echo "[done] binaries written to $OUT_DIR"
