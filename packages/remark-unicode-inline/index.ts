import { toString } from "mdast-util-to-string";
import type {
  Delete,
  Emphasis,
  Image,
  ImageReference,
  InlineCode,
  Link,
  Parent,
  Root,
  RootContent,
  Strong,
  Table,
  Text,
} from "mdast";
import type { Node } from "unist";
import type { Plugin } from "unified";

const COMBINING_STRIKE = "\u0336";
const COMBINING_UNDERLINE = "\u0332";

type InlineStyle = "plain" | "italic" | "bold" | "boldItalic";

function applyCombining(value: string, combining: string): string {
  let out = "";
  for (const ch of value) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    out += ch === " " ? ch : `${ch}${combining}`;
  }
  return out;
}

function mapMathAlpha(ch: string, style: InlineStyle): string {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return ch;

  if (style === "bold") {
    if (cp >= 0x41 && cp <= 0x5a) return String.fromCodePoint(0x1d5d4 + (cp - 0x41));
    if (cp >= 0x61 && cp <= 0x7a) return String.fromCodePoint(0x1d5ee + (cp - 0x61));
    if (cp >= 0x30 && cp <= 0x39) return String.fromCodePoint(0x1d7ec + (cp - 0x30));
  }

  if (style === "italic") {
    if (cp >= 0x41 && cp <= 0x5a) return String.fromCodePoint(0x1d608 + (cp - 0x41));
    if (cp >= 0x61 && cp <= 0x7a) return String.fromCodePoint(0x1d622 + (cp - 0x61));
  }

  if (style === "boldItalic") {
    if (cp >= 0x41 && cp <= 0x5a) return String.fromCodePoint(0x1d63c + (cp - 0x41));
    if (cp >= 0x61 && cp <= 0x7a) return String.fromCodePoint(0x1d656 + (cp - 0x61));
  }

  return ch;
}

function stylizeMath(value: string, style: InlineStyle): string {
  if (style === "plain") return value;
  let out = "";
  for (const ch of value) out += mapMathAlpha(ch, style);
  return out;
}

function nextStyle(current: InlineStyle, node: Node): InlineStyle {
  if (node.type === "strong") {
    if (current === "italic") return "boldItalic";
    return "bold";
  }
  if (node.type === "emphasis") {
    if (current === "bold") return "boldItalic";
    return "italic";
  }
  return current;
}

function renderInline(node: Node, style: InlineStyle = "plain"): string {
  if (node.type === "text") {
    return stylizeMath((node as Text).value, style);
  }

  if (node.type === "inlineCode") {
    return stylizeMath((node as InlineCode).value, style);
  }

  if (node.type === "break") {
    return "\n";
  }

  if (node.type === "delete") {
    const value = renderChildren(node as Delete, style);
    return applyCombining(value, COMBINING_STRIKE);
  }

  if (node.type === "link") {
    const value = renderChildren(node as Link, "plain");
    return applyCombining(value, COMBINING_UNDERLINE);
  }

  if (node.type === "emphasis" || node.type === "strong") {
    return renderChildren(node as Emphasis | Strong, nextStyle(style, node));
  }

  if ("children" in (node as Parent)) {
    return renderChildren(node as Parent, style);
  }

  if (node.type === "image") return stylizeMath((node as Image).alt ?? "", style);
  if (node.type === "imageReference") return stylizeMath((node as ImageReference).alt ?? "", style);

  return stylizeMath(toString(node as never), style);
}

function renderChildren(parent: Parent, style: InlineStyle): string {
  return parent.children.map((child) => renderInline(child as Node, style)).join("");
}

function textNode(value: string): Text {
  return { type: "text", value };
}

function flattenInlineChildren(parent: Parent): void {
  const rendered = renderChildren(parent, "plain");
  parent.children = [textNode(rendered)] as Parent["children"];
}

function transformContainerChildren<T extends { children: unknown[] }>(node: T): T {
  node.children = node.children.map(
    (child) => transformNode(child as RootContent) as (typeof node.children)[number],
  );
  return node;
}

function transformTableNode(table: Table): Table {
  table.children = table.children.map((row) => {
    const r = row;
    r.children = r.children.map((cell) => {
      const c = cell;
      flattenInlineChildren(c);
      return c;
    });
    return r;
  });
  return table;
}

function transformNode(node: RootContent): RootContent {
  switch (node.type) {
    case "paragraph": {
      const n = node;
      flattenInlineChildren(n);
      return n;
    }
    case "heading": {
      const n = node;
      flattenInlineChildren(n);
      return n;
    }
    case "blockquote": {
      return transformContainerChildren(node);
    }
    case "list": {
      const n = node;
      n.children = n.children.map((item) => {
        const li = item;
        transformContainerChildren(li);
        return li;
      });
      return n;
    }
    case "table": {
      return transformTableNode(node);
    }
    case "html":
    case "code":
    case "thematicBreak":
      return node;
    default:
      return node;
  }
}

const remarkUnicodeInline: Plugin<[], Root> = function remarkUnicodeInline() {
  return function transform(tree) {
    tree.children = tree.children.map((child) => transformNode(child));
  };
};

export default remarkUnicodeInline;
