import { getLibtexprintfRenderer } from "@rat/bun-libtexprintf";
import unicodeit from "unicodeit";

type InlineStyle = "plain" | "italic" | "bold" | "boldItalic";
type ParsedSpan = { value: string; end: number };

type Segment =
  | { type: "text"; value: string }
  | { type: "inlineMath"; value: string }
  | { type: "displayMath"; value: string };

export type RenderLatexOptions = {
  displayRenderer?: (latex: string) => string | Promise<string>;
};

const INLINE_COMMANDS: ReadonlyArray<{ cmd: string; style: InlineStyle }> = [
  { cmd: "\\textbf", style: "bold" },
  { cmd: "\\textit", style: "italic" },
  { cmd: "\\emph", style: "italic" },
];

const DISPLAY_ENVS = ["aligned", "align*", "align"] as const;

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

function parseBraced(
  source: string,
  openBraceIndex: number,
): { content: string; end: number } | null {
  if (source[openBraceIndex] !== "{") return null;
  let depth = 1;
  let i = openBraceIndex + 1;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    if (depth === 0) {
      return {
        content: source.slice(openBraceIndex + 1, i),
        end: i + 1,
      };
    }
    i += 1;
  }

  return null;
}

function renderInlineCommands(input: string): string {
  let out = "";
  let i = 0;

  while (i < input.length) {
    let matched = false;
    for (const { cmd, style } of INLINE_COMMANDS) {
      if (!input.startsWith(cmd, i)) continue;
      const parsed = parseBraced(input, i + cmd.length);
      if (!parsed) break;
      const inner = renderInlineCommands(parsed.content);
      out += stylizeMath(inner, style);
      i = parsed.end;
      matched = true;
      break;
    }

    if (!matched) {
      out += input[i];
      i += 1;
    }
  }

  return out;
}

function isEscapedDollar(source: string, index: number): boolean {
  let backslashes = 0;
  let i = index - 1;
  while (i >= 0 && source[i] === "\\") {
    backslashes += 1;
    i -= 1;
  }
  return backslashes % 2 === 1;
}

function findUnescaped(source: string, needle: string, from: number): number {
  let i = from;
  while (i < source.length) {
    const at = source.indexOf(needle, i);
    if (at === -1) return -1;
    if (!isEscapedDollar(source, at)) return at;
    i = at + needle.length;
  }
  return -1;
}

function tryParseEnv(source: string, from: number): ParsedSpan | null {
  for (const env of DISPLAY_ENVS) {
    const begin = `\\begin{${env}}`;
    if (!source.startsWith(begin, from)) continue;
    const endToken = `\\end{${env}}`;
    const end = source.indexOf(endToken, from + begin.length);
    if (end === -1) return null;
    return { value: source.slice(from, end + endToken.length), end: end + endToken.length };
  }
  return null;
}

function tryParseDoubleDollar(input: string, from: number): { value: string; end: number } | null {
  if (!input.startsWith("$$", from) || isEscapedDollar(input, from)) return null;
  const end = findUnescaped(input, "$$", from + 2);
  if (end === -1) return null;
  return { value: input.slice(from + 2, end), end: end + 2 };
}

function tryParseBracketDisplay(input: string, from: number): ParsedSpan | null {
  if (!input.startsWith("\\[", from)) return null;
  const end = input.indexOf("\\]", from + 2);
  if (end === -1) return null;
  return { value: input.slice(from + 2, end), end: end + 2 };
}

function tryParseInlineDollar(input: string, from: number): ParsedSpan | null {
  if (input[from] !== "$" || isEscapedDollar(input, from) || input.startsWith("$$", from))
    return null;
  const end = findUnescaped(input, "$", from + 1);
  if (end === -1 || input.startsWith("$$", end)) return null;
  return { value: input.slice(from + 1, end), end: end + 1 };
}

function tryParseInlineParen(input: string, from: number): ParsedSpan | null {
  if (!input.startsWith("\\(", from)) return null;
  const end = input.indexOf("\\)", from + 2);
  if (end === -1) return null;
  return { value: input.slice(from + 2, end), end: end + 2 };
}

function tryParseDisplayAt(input: string, index: number): ParsedSpan | null {
  return (
    tryParseEnv(input, index) ??
    tryParseDoubleDollar(input, index) ??
    tryParseBracketDisplay(input, index)
  );
}

function tryParseInlineMathAt(input: string, index: number): ParsedSpan | null {
  return tryParseInlineDollar(input, index) ?? tryParseInlineParen(input, index);
}

function splitSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let textStart = 0;

  const pushText = (end: number): void => {
    if (end > textStart) {
      segments.push({ type: "text", value: input.slice(textStart, end) });
    }
  };

  while (i < input.length) {
    const display = tryParseDisplayAt(input, i);
    if (display) {
      pushText(i);
      segments.push({ type: "displayMath", value: display.value });
      i = display.end;
      textStart = i;
      continue;
    }

    const inline = tryParseInlineMathAt(input, i);
    if (inline) {
      pushText(i);
      segments.push({ type: "inlineMath", value: inline.value });
      i = inline.end;
      textStart = i;
      continue;
    }

    i += 1;
  }

  pushText(input.length);
  return segments;
}

function isLikelyFailedLibtexprintf(input: string, output: string): boolean {
  const inNorm = input.trim();
  const outNorm = output.trim();
  if (!outNorm) return true;
  if (inNorm === outNorm && /\\[A-Za-z]+/.test(inNorm)) return true;
  return false;
}

function normalizeDisplayLatex(value: string): string {
  return value.replaceAll("\r\n", "\n").trim();
}

async function displayToUnicode(
  value: string,
  displayRenderer?: (latex: string) => string | Promise<string>,
): Promise<string> {
  const input = normalizeDisplayLatex(value);
  const render = async (latex: string): Promise<string> =>
    displayRenderer ? await displayRenderer(latex) : (await getLibtexprintfRenderer())(latex);

  try {
    const output = await render(input);
    if (!isLikelyFailedLibtexprintf(input, output)) {
      return output;
    }

    const flattened = input.replaceAll("\n", " ");
    if (flattened !== input) {
      const retry = await render(flattened);
      if (!isLikelyFailedLibtexprintf(flattened, retry)) {
        return retry;
      }
    }

    return unicodeit.replace(input);
  } catch {
    return unicodeit.replace(input);
  }
}

export async function renderLatex(
  input: string,
  options: RenderLatexOptions = {},
): Promise<string> {
  const segments = splitSegments(input);
  const rendered = await Promise.all(
    segments.map((segment) => {
      if (segment.type === "text") {
        return renderInlineCommands(segment.value);
      }
      if (segment.type === "inlineMath") {
        return unicodeit.replace(segment.value);
      }
      return displayToUnicode(segment.value, options.displayRenderer);
    }),
  );
  return rendered.join("");
}
