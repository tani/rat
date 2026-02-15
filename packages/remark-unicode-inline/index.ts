import * as arktype from "arktype";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Table } from "mdast";
import type { Node } from "unist";
import type { Plugin } from "unified";

const COMBINING_STRIKE = "\u0336";
const COMBINING_UNDERLINE = "\u0332";

type InlineStyle = "plain" | "italic" | "bold" | "boldItalic";

const TextNodeSchema = arktype.type({ type: "'text'", value: "string" });
const InlineCodeNodeSchema = arktype.type({ type: "'inlineCode'", value: "string" });
const NodeWithChildrenSchema = arktype.type({ children: "unknown[]" });
const ImageNodeSchema = arktype.type({ type: "'image'", "alt?": "string" });
const ImageRefNodeSchema = arktype.type({ type: "'imageReference'", "alt?": "string" });
const GenericNodeSchema = arktype.type({ type: "string" });

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

function asNode(value: unknown): Node | undefined {
  const parsed = GenericNodeSchema(value);
  if (parsed instanceof arktype.type.errors) return undefined;
  return parsed;
}

function asNodeWithChildren(node: Node): { children: unknown[] } | undefined {
  const parsed = NodeWithChildrenSchema(node);
  if (parsed instanceof arktype.type.errors) return undefined;
  return parsed;
}

function isRootContentNode(node: Node): node is RootContent {
  return (
    node.type === "paragraph" ||
    node.type === "heading" ||
    node.type === "blockquote" ||
    node.type === "list" ||
    node.type === "table" ||
    node.type === "html" ||
    node.type === "code" ||
    node.type === "thematicBreak"
  );
}

function renderInline(node: Node, style: InlineStyle = "plain"): string {
  const textNode = TextNodeSchema(node);
  if (!(textNode instanceof arktype.type.errors)) {
    return stylizeMath(textNode.value, style);
  }

  const inlineCodeNode = InlineCodeNodeSchema(node);
  if (!(inlineCodeNode instanceof arktype.type.errors)) {
    return stylizeMath(inlineCodeNode.value, style);
  }

  if (node.type === "break") {
    return "\n";
  }

  if (node.type === "delete") {
    const value = renderChildren(node, style);
    return applyCombining(value, COMBINING_STRIKE);
  }

  if (node.type === "link") {
    const value = renderChildren(node, "plain");
    return applyCombining(value, COMBINING_UNDERLINE);
  }

  if (node.type === "emphasis" || node.type === "strong") {
    return renderChildren(node, nextStyle(style, node));
  }

  const container = asNodeWithChildren(node);
  if (container) {
    return renderChildren(node, style);
  }

  const image = ImageNodeSchema(node);
  if (!(image instanceof arktype.type.errors)) return stylizeMath(image.alt ?? "", style);
  const imageRef = ImageRefNodeSchema(node);
  if (!(imageRef instanceof arktype.type.errors)) return stylizeMath(imageRef.alt ?? "", style);

  return stylizeMath(toString(node), style);
}

function renderChildren(parent: Node, style: InlineStyle): string {
  const parsed = asNodeWithChildren(parent);
  if (!parsed) return "";
  return parsed.children
    .map((child) => {
      const childNode = asNode(child);
      if (!childNode) return "";
      return renderInline(childNode, style);
    })
    .join("");
}

function textNode(value: string): { type: "text"; value: string } {
  return { type: "text", value };
}

function flattenInlineChildren(parent: Node): void {
  const parsed = asNodeWithChildren(parent);
  if (!parsed) return;
  const rendered = renderChildren(parent, "plain");
  parsed.children = [textNode(rendered)];
}

function transformContainerChildren<T extends RootContent>(node: T): T {
  const parsed = asNodeWithChildren(node);
  if (!parsed) return node;
  parsed.children = parsed.children.map((child) => {
    const childNode = asNode(child);
    if (!childNode || !isRootContentNode(childNode)) return child;
    return transformNode(childNode);
  });
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
