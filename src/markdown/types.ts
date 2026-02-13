export type PositionPoint = { line?: number; column?: number; offset?: number };
export type PositionRange = { start?: PositionPoint; end?: PositionPoint };

export const REMARK_STRINGIFY_OPTIONS = {
  fences: false,
  bullet: "-",
  incrementListMarker: true,
} as const;

export const MARKDOWN_MAP_GAP = 0.35;
export const MARKDOWN_MAP_THRESHOLD = 0.58;

export type PositionMapEntry = {
  type: string;
  text: string;
  original: PositionRange;
  formatted: PositionRange;
};

export type RenderMarkdownResult = {
  markdown: string;
  positionMap: PositionMapEntry[];
};
