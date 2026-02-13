import { styleText } from "node:util";

const inlineFlat = (text: string): string =>
  text.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();
const cellText = (text: string): string => inlineFlat(text).replace(/\|/g, "¦");

function parseTableRow(line: string): string[] | null {
  if (!line.includes("|")) return null;
  let text = line.trim();
  if (!text.length) return null;
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((part) => cellText(part.trim()));
}

function isTableSeparator(line: string): boolean {
  const row = parseTableRow(line);
  return !!row?.length && row.every((part) => /^:?-{3,}:?$/.test(part));
}

function renderTableGrid(rows: string[][]): string {
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  const widths = Array.from(
    { length: cols },
    (_, i) => Math.max(...grid.map((r) => r[i].length), 1),
  );
  const border = (l: string, m: string, r: string): string =>
    `${l}${widths.map((w) => "─".repeat(w + 2)).join(m)}${r}`;
  const rowLine = (cells: string[]): string =>
    `│ ${cells.map((c, i) => c.padEnd(widths[i])).join(" │ ")} │`;
  const lines = [border("┌", "┬", "┐"), rowLine(grid[0])];
  if (grid.length > 1) lines.push(border("├", "┼", "┤"));
  for (let i = 1; i < grid.length; i++) lines.push(rowLine(grid[i]));
  lines.push(border("└", "┴", "┘"));
  return `${lines.join("\n")}\n`;
}

function decorateInline(text: string): string {
  const parts = text.split(/(`[^`]*`)/g);
  return parts.map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) return part;
    return part
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, dest) =>
        `${styleText("underline", String(label))} ${
          styleText("underline", String(dest))
        }`
      )
      .replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (_, label, ref) =>
        `${styleText("underline", String(label))} [${String(ref)}]`
      )
      .replace(/(\*\*\*|___)(.+?)\1/g, (_, __, inner) =>
        styleText(["bold", "italic"], String(inner))
      )
      .replace(/(\*\*|__)(.+?)\1/g, (_, __, inner) =>
        styleText("bold", String(inner))
      )
      .replace(/\*([^*\n]+)\*/g, (_, inner) => styleText("italic", String(inner)))
      .replace(/~~(.+?)~~/g, (_, inner) => styleText("strikethrough", String(inner)));
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
  if (/^\s*>\s?/.test(line)) return decorateInline(line.replace(/^\s*>\s?/, "▌ "));
  if (/^\s*([-*])\s+\[(x|X| )\]\s+/.test(line)) {
    return line.replace(/^\s*([-*])\s+\[(x|X| )\]\s+(.+)$/, (_, __, checked, rest) =>
      `${checked.toLowerCase() === "x" ? "☑" : "☐"} ${decorateInline(String(rest))}`
    );
  }
  if (/^\s*[-*+]\s+/.test(line)) {
    return line.replace(/^(\s*)[-*+]\s+(.+)$/, (_, indent, rest) =>
      `${String(indent)}• ${decorateInline(String(rest))}`
    );
  }
  if (/^\s*\d+\.\s+/.test(line)) {
    return line.replace(/^(\s*)(\d+)\.\s+(.+)$/, (_, indent, n, rest) =>
      `${String(indent)}${n}. ${decorateInline(String(rest))}`
    );
  }
  if (/^\s*([*-]\s*){3,}$/.test(line)) return "─".repeat(40);
  return decorateInline(line);
}

export function renderMarkdownToInkText(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^( {4}|\t)/.test(lines[i])) {
      out.push(lines[i]);
      continue;
    }
    const header = parseTableRow(lines[i]);
    if (header && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const rows = [header];
      i += 2;
      while (i < lines.length) {
        const row = parseTableRow(lines[i]);
        if (!row) break;
        rows.push(row);
        i++;
      }
      out.push(renderTableGrid(rows).trimEnd());
      i -= 1;
      continue;
    }
    out.push(decorateLine(lines[i]));
  }
  const text = out.join("\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}
