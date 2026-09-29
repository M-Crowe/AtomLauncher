import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

// Cache for prepared segments to avoid repeated text tokenization
const segmentsCache = new Map<string, ReturnType<typeof prepareWithSegments>>();

export interface PathLayoutResult {
  lines: Array<{ text: string; width: number }>;
  lineCount: number;
  measuredHeight: number;
}

/**
 * Uses @chenglou/pretext to measure path layout in pure JavaScript memory,
 * avoiding DOM reflow and layout thrashing for thousands of files.
 */
export function estimatePathLayout(
  path: string,
  maxWidth: number = 480,
  lineHeight: number = 18,
  font: string = '11px "FusionPixelFont", monospace'
): PathLayoutResult {
  if (!path) {
    return { lines: [], lineCount: 1, measuredHeight: lineHeight };
  }

  const cacheKey = `${font}::${path}`;
  try {
    let prepared = segmentsCache.get(cacheKey);
    if (!prepared) {
      prepared = prepareWithSegments(path, font);
      segmentsCache.set(cacheKey, prepared);
    }

    const layout = layoutWithLines(prepared, maxWidth, lineHeight);
    const lineCount = Math.max(1, layout.lines.length);
    const measuredHeight = Math.max(lineHeight, lineCount * lineHeight);

    return {
      lines: layout.lines,
      lineCount,
      measuredHeight,
    };
  } catch {
    // Robust fallback if OffscreenCanvas or DOM context is unavailable in tests/headless
    const estCharWidth = 7.5;
    const charsPerLine = Math.max(10, Math.floor(maxWidth / estCharWidth));
    const lineCount = Math.max(1, Math.ceil(path.length / charsPerLine));
    return {
      lines: [{ text: path, width: Math.min(maxWidth, path.length * estCharWidth) }],
      lineCount,
      measuredHeight: lineCount * lineHeight,
    };
  }
}

export function clearPathLayoutCache(): void {
  segmentsCache.clear();
}
