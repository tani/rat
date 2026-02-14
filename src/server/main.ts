import { createServer } from "node:http";
import process from "node:process";
import { renderMarkdownToTerminalText } from "../markdown/terminal.ts";
import { parseRenderRequest } from "./request.ts";
import { DEFAULT_PORT } from "../core/shared.ts";
import { createRefresh } from "./refresh.ts";

export function parseArgs(args: string[]) {
  const portArg = args.find((a) => a.startsWith("--port="));
  const port = portArg
    ? Number.parseInt(portArg.slice("--port=".length), 10)
    : DEFAULT_PORT;
  return { port: Number.isFinite(port) ? port : DEFAULT_PORT };
}

export function main() {
  const { port } = parseArgs(Deno.args);
  const clear = "\x1bc\x1b[3J\x1b[H\x1b[2J";
  const render = (text: string) => {
    process.stdout.write(clear);
    if (text.length) process.stdout.write(text);
  };
  render("");
  const refresh = createRefresh();

  const server = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const host = req.headers.host ?? `127.0.0.1:${port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (method !== "GET") {
      res.statusCode = 405;
      res.end();
      return;
    }
    if (url.pathname !== "/render") {
      res.statusCode = 404;
      res.end();
      return;
    }

    const parsed = parseRenderRequest(url);
    if (!parsed.ok) {
      res.statusCode = 400;
      res.end();
      return;
    }

    try {
      await refresh(parsed.source, parsed.cursor.line, (text) => {
        const rendered = renderMarkdownToTerminalText(text, {
          trailingNewline: false,
        });
        render(/\S/.test(rendered) ? rendered : "");
      });
      res.statusCode = 204;
      res.end();
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end();
    }
  });
  server.listen(port, "127.0.0.1");
}
