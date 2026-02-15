import memoizeOne from "memoize-one";

const COMBINING_STRIKE = 0x0336;
const COMBINING_UNDERLINE = 0x0332;

function getNormalizedChar(code: number): string | null {
  // Combining characters to remove
  if (code === COMBINING_STRIKE || code === COMBINING_UNDERLINE) {
    return null;
  }

  // Bold A-Z
  if (code >= 0x1d5d4 && code <= 0x1d5ed) return String.fromCharCode(code - 120275);
  // Bold a-z
  if (code >= 0x1d5ee && code <= 0x1d607) return String.fromCharCode(code - 120269);
  // Bold 0-9
  if (code >= 0x1d7ec && code <= 0x1d7f5) return String.fromCharCode(code - 120764);

  // Italic A-Z
  if (code >= 0x1d608 && code <= 0x1d621) return String.fromCharCode(code - 120263);
  // Italic a-z
  if (code >= 0x1d622 && code <= 0x1d63b) return String.fromCharCode(code - 120257);

  // BoldItalic A-Z
  if (code >= 0x1d63c && code <= 0x1d655) return String.fromCharCode(code - 120251);
  // BoldItalic a-z
  if (code >= 0x1d656 && code <= 0x1d66f) return String.fromCharCode(code - 120245);

  // Monospace A-Z
  if (code >= 0x1d670 && code <= 0x1d689) return String.fromCharCode(code - 120239);
  // Monospace a-z
  if (code >= 0x1d68a && code <= 0x1d6a3) return String.fromCharCode(code - 120233);
  // Monospace 0-9
  if (code >= 0x1d7f6 && code <= 0x1d7ff) return String.fromCharCode(code - 120774);

  return String.fromCodePoint(code);
}

interface NormalizedString {
  text: string;
  mapToOriginal: number[];
  mapToNormalized: number[];
}

function at(matrix: Int32Array[], row: number, col: number): number {
  return matrix[row]?.[col] ?? 0;
}

function buildEditDistanceTable(a: string, b: string): Int32Array[] {
  const m = a.length;
  const n = b.length;
  const dp: Int32Array[] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  if (dp[0]) {
    const firstRow = dp[0];
    for (let j = 0; j <= n; j++) firstRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = dp[i];
      if (!row) continue;
      row[j] = Math.min(
        at(dp, i - 1, j) + 1, // deletion
        at(dp, i, j - 1) + 1, // insertion
        at(dp, i - 1, j - 1) + cost, // substitution
      );
    }
  }

  return dp;
}

const getEditDistanceTable = memoizeOne(buildEditDistanceTable);

function normalize(s: string): NormalizedString {
  let text = "";
  const mapToOriginal: number[] = [];
  const mapToNormalized: number[] = Array<number>(s.length).fill(-1);

  let originalIndex = 0;
  for (const char of s) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      originalIndex += char.length;
      continue;
    }

    const normChar = getNormalizedChar(code);

    if (normChar === null) {
      // Removed (combining char)
      // Map to the last valid index in normalized text
      const targetIndex = Math.max(0, text.length - 1);
      for (let k = 0; k < char.length; k++) {
        mapToNormalized[originalIndex + k] = targetIndex;
      }
    } else {
      // Appended
      const currentIndex = text.length;
      mapToOriginal.push(...Array<number>(normChar.length).fill(originalIndex));

      text += normChar;

      for (let k = 0; k < char.length; k++) {
        mapToNormalized[originalIndex + k] = currentIndex;
      }
    }

    originalIndex += char.length;
  }

  return { text, mapToOriginal, mapToNormalized };
}

function coreTextSourcemap(a: string, b: string, apos: number): number {
  if (apos < 0 || apos >= a.length) {
    if (apos < 0) return 0;
    return b.length;
  }

  const dp = getEditDistanceTable(a, b);

  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (at(dp, i, j) === at(dp, i - 1, j - 1) + cost) {
        if (i - 1 === apos) {
          return j - 1;
        }
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && at(dp, i, j) === at(dp, i - 1, j) + 1) {
      if (i - 1 === apos) {
        return j;
      }
      i--;
      continue;
    }

    if (j > 0 && at(dp, i, j) === at(dp, i, j - 1) + 1) {
      j--;
      continue;
    }

    break;
  }

  return 0;
}

export function unicodeSourcemap(a: string, b: string, apos: number): number {
  const normA = normalize(a);
  const normB = normalize(b);

  // Map apos (original index in a) to norm_apos (index in normA.text)
  let normAPos = 0;
  if (apos >= 0 && apos < normA.mapToNormalized.length) {
    normAPos = normA.mapToNormalized[apos] ?? 0;
  } else if (apos >= normA.mapToNormalized.length) {
    normAPos = normA.text.length; // End of string
  }

  // Calculate mapping in normalized space
  const normBPos = coreTextSourcemap(normA.text, normB.text, normAPos);

  // Map normBPos (index in normB.text) back to bpos (original index in b)
  if (normBPos >= normB.text.length) {
    return b.length;
  }
  if (normBPos < 0) {
    return 0;
  }

  return normB.mapToOriginal[normBPos] ?? 0;
}
