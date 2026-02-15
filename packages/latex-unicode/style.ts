export type InlineStyle = "plain" | "italic" | "bold" | "boldItalic";

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

export function stylizeMath(value: string, style: InlineStyle): string {
  if (style === "plain") return value;
  let out = "";
  for (const ch of value) out += mapMathAlpha(ch, style);
  return out;
}
