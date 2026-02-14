import { styleText } from "node:util";
import { toString } from "mdast-util-to-string";
import type {
  Code,
  Nodes,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
} from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export type TableBorderStyle = "single" | "double" | "rounded";
type Align = "left" | "center" | "right";

type BorderSet = {
  topLeft: string;
  topMid: string;
  topRight: string;
  midLeft: string;
  midMid: string;
  midRight: string;
  bottomLeft: string;
  bottomMid: string;
  bottomRight: string;
  vertical: string;
  horizontal: string;
};

export type TableModel = {
  header: string[];
  align: Align[];
  rows: string[][];
};

export type TableRenderOptions = {
  style?: TableBorderStyle;
  maxWidth?: number;
  maxCellWidth?: number;
};

type ParentLike = { children: RootContent[] };

const BORDER_STYLES: Record<TableBorderStyle, BorderSet> = {
  single: {
    topLeft: "┌",
    topMid: "┬",
    topRight: "┐",
    midLeft: "├",
    midMid: "┼",
    midRight: "┤",
    bottomLeft: "└",
    bottomMid: "┴",
    bottomRight: "┘",
    vertical: "│",
    horizontal: "─",
  },
  double: {
    topLeft: "╔",
    topMid: "╦",
    topRight: "╗",
    midLeft: "╠",
    midMid: "╬",
    midRight: "╣",
    bottomLeft: "╚",
    bottomMid: "╩",
    bottomRight: "╝",
    vertical: "║",
    horizontal: "═",
  },
  rounded: {
    topLeft: "╭",
    topMid: "┬",
    topRight: "╮",
    midLeft: "├",
    midMid: "┼",
    midRight: "┤",
    bottomLeft: "╰",
    bottomMid: "┴",
    bottomRight: "╯",
    vertical: "│",
    horizontal: "─",
  },
};

const normalizeCellText = (text: string): string =>
  text.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim().replace(
    /\|/g,
    "¦",
  );

function wrapCell(text: string, width: number): string[] {
  const clean = normalizeCellText(text);
  if (clean.length <= width) return [clean];
  const words = clean.split(" ");
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const unit = line.length ? `${line} ${word}` : word;
    if (unit.length <= width) {
      line = unit;
      continue;
    }
    if (line.length) out.push(line);
    if (word.length <= width) {
      line = word;
      continue;
    }
    for (let i = 0; i < word.length; i += width) {
      const chunk = word.slice(i, i + width);
      if (chunk.length === width) out.push(chunk);
      else line = chunk;
    }
  }
  if (line.length) out.push(line);
  return out.length ? out : [""];
}

function pad(text: string, width: number, align: Align): string {
  if (text.length >= width) return text;
  const n = width - text.length;
  if (align === "right") return `${" ".repeat(n)}${text}`;
  if (align === "center") {
    const left = Math.floor(n / 2);
    return `${" ".repeat(left)}${text}${" ".repeat(n - left)}`;
  }
  return `${text}${" ".repeat(n)}`;
}

function buildBorder(
  widths: number[],
  b: BorderSet,
  l: keyof BorderSet,
  m: keyof BorderSet,
  r: keyof BorderSet,
): string {
  return `${b[l]}${widths.map((w) => b.horizontal.repeat(w + 2)).join(b[m])}${
    b[r]
  }`;
}

export function renderMarkdownTable(
  table: TableModel,
  options?: TableRenderOptions,
): string {
  const style = BORDER_STYLES[options?.style ?? "rounded"];
  const maxWidth = Math.max(40, options?.maxWidth ?? 100);
  const maxCell = Math.max(8, options?.maxCellWidth ?? 36);
  const cols = Math.max(
    table.header.length,
    ...table.rows.map((r) => r.length),
  );
  const aligns = Array.from(
    { length: cols },
    (_, i) => table.align[i] ?? "left",
  );

  const rawGrid = [table.header, ...table.rows].map((r) =>
    Array.from({ length: cols }, (_, i) => r[i] ?? "")
  );
  const natural = Array.from(
    { length: cols },
    (_, i) => Math.max(...rawGrid.map((r) => r[i].length), 1),
  ).map((w) => Math.min(w, maxCell));

  const borderTax = 3 * cols + 1;
  const targetInner = Math.max(cols * 6, maxWidth - borderTax);
  const widths = [...natural];
  const current = () => widths.reduce((a, b) => a + b, 0);
  while (current() > targetInner) {
    let k = 0;
    for (let i = 1; i < widths.length; i++) if (widths[i] > widths[k]) k = i;
    if (widths[k] <= 8) break;
    widths[k]--;
  }

  const wrapped = rawGrid.map((row) =>
    row.map((cell, i) => wrapCell(cell, widths[i]))
  );
  const rowHeights = wrapped.map((row) =>
    Math.max(...row.map((c) => c.length), 1)
  );

  const lines: string[] = [];
  lines.push(buildBorder(widths, style, "topLeft", "topMid", "topRight"));
  for (let r = 0; r < wrapped.length; r++) {
    for (let h = 0; h < rowHeights[r]; h++) {
      const cells = wrapped[r].map((chunks, i) => {
        const chunk = chunks[h] ?? "";
        const content = pad(chunk, widths[i], aligns[i]);
        return r === 0 ? styleText(["bold", "underline"], content) : content;
      });
      lines.push(
        `${style.vertical} ${
          cells.join(` ${style.vertical} `)
        } ${style.vertical}`,
      );
    }
    if (r === 0) {
      lines.push(buildBorder(widths, style, "midLeft", "midMid", "midRight"));
    }
  }
  lines.push(
    buildBorder(widths, style, "bottomLeft", "bottomMid", "bottomRight"),
  );
  return `${lines.join("\n")}\n`;
}

function tableCellText(cell: TableCell | undefined): string {
  if (!cell) return "";
  return normalizeCellText(toString(cell));
}

function normalizeAlign(value: Table["align"], cols: number): Align[] {
  return Array.from({ length: cols }, (_, i) => {
    const align = value?.[i];
    if (align === "center" || align === "right" || align === "left") {
      return align;
    }
    return "left";
  });
}

function tableNodeToModel(node: Table): TableModel | null {
  const rows = node.children as TableRow[];
  if (!rows.length) return null;
  const headerCells = rows[0]?.children ?? [];
  const cols = Math.max(
    headerCells.length,
    ...rows.map((r) => (r.children as TableCell[]).length),
  );
  if (cols <= 0) return null;
  const header = Array.from(
    { length: cols },
    (_, i) => tableCellText(headerCells[i] as TableCell | undefined),
  );
  const body = rows.slice(1).map((row) => {
    const cells = row.children as TableCell[];
    return Array.from(
      { length: cols },
      (_, i) => tableCellText(cells[i] as TableCell | undefined),
    );
  });
  return {
    header,
    align: normalizeAlign(node.align, cols),
    rows: body,
  };
}

export const remarkRenderTable: Plugin<[TableRenderOptions?], Root> = (
  options,
) => {
  return (tree: Root, file?: { data?: Record<string, unknown> }) => {
    const filePrintWidth = Number(file?.data?.printWidth);
    const maxWidth = Number.isFinite(filePrintWidth)
      ? filePrintWidth
      : options?.maxWidth;

    visit(tree as Nodes, "table", (node, index, parent) => {
      if (!parent || index === undefined) return;
      const model = tableNodeToModel(node as Table);
      if (!model) return;
      const rendered = renderMarkdownTable(model, { ...options, maxWidth })
        .trimEnd();
      (parent as ParentLike).children[index] = {
        type: "code",
        lang: null,
        meta: null,
        value: rendered,
      } as Code;
    });
  };
};
