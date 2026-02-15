import * as arktype from "arktype";
import { toString } from "mdast-util-to-string";
import type { Code, Root, Table, TableCell, TableRow } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

type Align = "left" | "right" | "center" | null;

const ParentWithChildrenSchema = arktype.type({
  children: "unknown[]",
});

function pad(text: string, width: number, align: Align): string {
  const raw = text.trim();
  const extra = Math.max(0, width - raw.length);
  if (align === "right") return `${" ".repeat(extra)}${raw}`;
  if (align === "center") {
    const left = Math.floor(extra / 2);
    const right = extra - left;
    return `${" ".repeat(left)}${raw}${" ".repeat(right)}`;
  }
  return `${raw}${" ".repeat(extra)}`;
}

function rowCells(row: TableRow): TableCell[] {
  return row.children;
}

function renderTable(table: Table): string {
  const rows = table.children;
  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((row) => row.children.length));
  const align: Align[] = Array.from({ length: colCount }, (_, i) => table.align?.[i] ?? null);

  const emptyCell: TableCell = { type: "tableCell", children: [{ type: "text", value: "" }] };
  const matrix: string[][] = rows.map((row) => {
    const cells = rowCells(row);
    return Array.from({ length: colCount }, (_, i) => toString(cells[i] ?? emptyCell));
  });

  const widths = Array.from({ length: colCount }, (_, col) => {
    const maxCell = Math.max(...matrix.map((row) => row[col]?.trim().length ?? 0));
    return Math.max(1, maxCell);
  });

  const horiz = (left: string, mid: string, right: string) => {
    const segs = widths.map((w) => "─".repeat(w + 2));
    return `${left}${segs.join(mid)}${right}`;
  };

  const renderRow = (cells: string[]) => {
    const rendered = cells.map(
      (cell, col) => ` ${pad(cell, widths[col] ?? 1, align[col] ?? null)} `,
    );
    return `│${rendered.join("│")}│`;
  };

  const out: string[] = [];
  out.push(horiz("┌", "┬", "┐"));
  out.push(renderRow(matrix[0] ?? []));
  out.push(horiz("├", "┼", "┤"));
  for (let i = 1; i < matrix.length; i += 1) {
    out.push(renderRow(matrix[i] ?? []));
  }
  out.push(horiz("└", "┴", "┘"));

  return out.join("\n");
}

const remarkUnicodeTable: Plugin<[], Root> = function remarkUnicodeTable() {
  return function transform(tree) {
    visit(tree, "table", (node: Table, index, parent) => {
      if (index === undefined || !parent) return;
      const parentWithChildren = ParentWithChildrenSchema(parent);
      if (parentWithChildren instanceof arktype.type.errors) return;
      const rendered = renderTable(node);
      const code: Code = { type: "code", lang: "raw", meta: null, value: rendered };
      parentWithChildren.children[index] = code;
    });
  };
};

export default remarkUnicodeTable;
