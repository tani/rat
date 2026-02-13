import { Buffer } from "node:buffer";
import { resolve } from "node:path";

import { type Cursor, type Source, toPosInt } from "../core/shared.ts";

export type RenderRequest =
  | { ok: true; source: Source; cursor: Cursor }
  | { ok: false; error: "bad_request" };

export function parseRenderRequest(url: URL): RenderRequest {
  const source = parseSource(url);
  if (!source) return { ok: false, error: "bad_request" };
  return {
    ok: true,
    source,
    cursor: {
      line: toPosInt(url.searchParams.get("l"), 1),
    },
  };
}

function parseSource(url: URL): Source | null {
  const b = url.searchParams.get("b");
  if (b !== null) {
    try {
      return {
        kind: "text",
        content: Buffer.from(b, "base64").toString("utf8"),
      };
    } catch {
      return null;
    }
  }
  const p = url.searchParams.get("p");
  if (p !== null) return { kind: "path", path: resolve(p) };
  return null;
}
