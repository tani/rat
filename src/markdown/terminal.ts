import { styleText } from "node:util";

function decorateInline(text: string): string {
  const parts = text.split(/(`[^`]*`)/g);
  return parts.map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) return part;
    return part
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_, label, dest) =>
          `${styleText("underline", String(label))} ${
            styleText("underline", String(dest))
          }`,
      )
      .replace(
        /\[([^\]]+)\]\[([^\]]+)\]/g,
        (_, label, ref) =>
          `${styleText("underline", String(label))} [${String(ref)}]`,
      )
      .replace(
        /(\*\*\*|___)(.+?)\1/g,
        (_, __, inner) => styleText(["bold", "italic"], String(inner)),
      )
      .replace(
        /(\*\*|__)(.+?)\1/g,
        (_, __, inner) => styleText("bold", String(inner)),
      )
      .replace(
        /\*([^*\n]+)\*/g,
        (_, inner) => styleText("italic", String(inner)),
      )
      .replace(
        /~~(.+?)~~/g,
        (_, inner) => styleText("strikethrough", String(inner)),
      );
  }).join("");
}

function decorateHeading(line: string): string {
  const m = line.match(/^\s*(#{1,6})\s+(.+)$/);
  if (!m) return line;
  const level = m[1].length;
  const raw = decorateInline(m[2].trim());
  const text = level <= 2 ? styleText("bold", raw) : raw;
  const units = Math.max(1, level * 2 - 1);
  const mark = `${"█".repeat(Math.floor(units / 2))}${units % 2 ? "▌" : ""}`;
  return `${mark} ${text}`;
}

function decorateLine(line: string): string {
  const heading = decorateHeading(line);
  if (heading !== line) return heading;
  if (/^\s*>\s?/.test(line)) {
    return decorateInline(line.replace(/^\s*>\s?/, "▌ "));
  }
  if (/^\s*([-*])\s+\[(x|X| )\]\s+/.test(line)) {
    return line.replace(
      /^\s*([-*])\s+\[(x|X| )\]\s+(.+)$/,
      (_, __, checked, rest) =>
        `${checked.toLowerCase() === "x" ? "☑" : "☐"} ${
          decorateInline(String(rest))
        }`,
    );
  }
  if (/^\s*[-*+]\s+/.test(line)) {
    return line.replace(
      /^(\s*)[-*+]\s+(.+)$/,
      (_, indent, rest) => `${String(indent)}• ${decorateInline(String(rest))}`,
    );
  }
  if (/^\s*\d+\.\s+/.test(line)) {
    return line.replace(
      /^(\s*)(\d+)\.\s+(.+)$/,
      (_, indent, n, rest) =>
        `${String(indent)}${n}. ${decorateInline(String(rest))}`,
    );
  }
  if (/^\s*([*-]\s*){3,}$/.test(line)) return "─".repeat(40);
  return decorateInline(line);
}

export function renderMarkdownToTerminalText(
  markdown: string,
  options?: {
    trailingNewline?: boolean;
  },
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^( {4}|\t)/.test(lines[i])) {
      out.push(lines[i]);
      continue;
    }
    out.push(decorateLine(lines[i]));
  }
  const text = out.join("\n");
  const trailingNewline = options?.trailingNewline ?? true;
  if (!trailingNewline) return text;
  return text.endsWith("\n") ? text : `${text}\n`;
}
