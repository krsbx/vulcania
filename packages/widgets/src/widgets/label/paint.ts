/** Inline value labels — flying-pan's renderer/paint/text value branch. */
import { Palette } from "@vulcania/core";
import {
  ProgressValueType,
  TextAlign,
  type TextStyle,
} from "@vulcania/layout";
import {
  type Painter,
  parseColor,
  type TextPainter,
  type WidgetPainter,
} from "@vulcania/paint";
import { resolveFont } from "@vulcania/paint";

/** Auto label from a value; `null` when there's nothing to show. */
export function formatValueLabel(options: {
  value?: number;
  min?: number;
  max?: number;
  format?: ProgressValueType;
}): string | null {
  const { value, min, max, format } = options;

  if (format === undefined || value === undefined) return null;

  const lo = min ?? 0;
  const hi = max ?? 1;
  const span = hi - lo;
  const ratio = span === 0 ? 0 : (value - lo) / span;

  if (format === ProgressValueType.Percent) {
    return `${Math.round(ratio * 100)}%`;
  }

  return `${value}/${hi}`;
}

export interface InlineValueLabelOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Explicit text — wins over `showValue`. */
  label?: string;
  labelStyle?: TextStyle;
  value?: number;
  min?: number;
  max?: number;
  showValue?: ProgressValueType;
}

/** Text on a widget's box (progress fills, meters) — centered unless
 *  `labelStyle.textAlign` says otherwise. */
export function paintInlineValueLabel(
  gpu: Painter,
  font: TextPainter,
  options: InlineValueLabelOptions
): void {
  const text = options.label ?? formatValueLabel(options);
  if (!text) return;

  const measured = font.measure?.(text) ?? {
    width: text.length * 8,
    height: 18,
  };

  const align = options.labelStyle?.textAlign ?? TextAlign.Center;
  let x = options.x + (options.w - measured.width) / 2;
  if (align === TextAlign.Left) x = options.x;
  if (align === TextAlign.Right) x = options.x + options.w - measured.width;

  font.draw(gpu, {
    x,
    y: options.y + (options.h - measured.height) / 2,
    text,
    tint: parseColor(options.labelStyle?.color ?? Palette.text),
  });
}

/**
 * Label painter — the walk's text case, registered per widget type.
 * Wrapped labels (layout recorded node.textLayout) draw one run per
 * line at the line advance; unwrapped labels draw a single run. A
 * `font` prop resolves through the context lookup — absent lookup
 * falls back to the default font (headless compat); a present lookup
 * with an unknown name fails loud (flying-pan semantics).
 *
 * `textAlign` aligns within the node's box — per line for wrapped
 * labels, whole-run for unwrapped ones. Default LEFT (web body-text
 * semantics), a deliberate divergence from flying-pan's Center default:
 * tsgui's wrapped labels would visibly shift every existing app.
 */
export const paintLabel: WidgetPainter = (ctx, node, style) => {
  const text = node.widget.props["text"];
  if (typeof text !== "string") return;

  const font = resolveFont(ctx, node);

  const tint = parseColor((style as { color?: string }).color ?? Palette.text);
  const align = (style as { textAlign?: TextAlign }).textAlign ?? TextAlign.Left;

  // flying-pan's paintInlineLabel math, applied per line for wraps.
  const alignX = (lineWidth: number): number => {
    switch (align) {
      case TextAlign.Center:
        return node.screenX + (node.width - lineWidth) / 2;
      case TextAlign.Right:
        return node.screenX + node.width - lineWidth;
      default:
        return node.screenX;
    }
  };
  const lineWidth = (line: string): number =>
    font.measure?.(line)?.width ?? line.length * 8;

  if (node.textLayout) {
    const { lines, lineAdvance } = node.textLayout;
    for (const [i, line] of lines.entries()) {
      font.draw(ctx.gpu, {
        x: alignX(lineWidth(line)),
        y: node.screenY + i * lineAdvance,
        text: line,
        tint,
      });
    }
    return;
  }

  font.draw(ctx.gpu, {
    x: alignX(lineWidth(text)),
    y: node.screenY,
    text,
    tint,
  });
};
