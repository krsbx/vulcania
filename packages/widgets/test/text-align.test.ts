/**
 * textAlign — per-line alignment for wrapped labels, whole-run
 * alignment for unwrapped ones, and the alignment override on inline
 * value labels. The stub font is 12px/char so every expected x is
 * hand-computable; the default (no textAlign) must stay LEFT — the
 * web body-text default every existing app relies on.
 */
import { TextAlign } from "@vulcania/layout";
import type { Painter, TextPainter } from "@vulcania/paint";
import { describe, expect, test } from "bun:test";
import {
  Label,
  paintInlineValueLabel,
  type PaintOp,
  renderHeadless,
  View,
} from "../src/index.ts";

const NAMED_W = 12;
const namedFont: TextPainter = {
  draw: () => {},
  measure: (text) => ({ width: text.length * NAMED_W, height: 20 }),
};

/** Text ops with their x positions — the alignment surface. */
function textXs(frame: { ops: PaintOp[] }): Array<{ x: number; text: string }> {
  return frame.ops
    .filter((op) => op.op === "text")
    .map((op) => ({
      x: (op as { x: number }).x,
      text: (op as { text: string }).text,
    }));
}

describe("textAlign on labels (wrapped)", () => {
  const text = "x".repeat(30); // 30 chars × 12px = 360px

  function frame(textAlign?: TextAlign): Array<{ x: number; text: string }> {
    // The wrap constraint is the PARENT content width — a 100-wide
    // parent forces the 360px run to wrap (a root label in the 400px
    // harness would fit and never wrap at all).
    return textXs(
      renderHeadless(
        View({
          style: { width: 100 },
          children: [
            Label({
              text,
              font: "display",
              ...(textAlign !== undefined ? { style: { textAlign } } : {}),
            }),
          ],
        }),
        {
          width: 400,
          height: 300,
          fonts: (name) => (name === "display" ? namedFont : undefined),
        }
      )
    );
  }

  test("wraps into 8-char lines (96px) + a 72px tail", () => {
    const ops = frame(TextAlign.Center);
    expect(ops.map((op) => op.text)).toEqual([
      "x".repeat(8),
      "x".repeat(8),
      "x".repeat(8),
      "x".repeat(6),
    ]);
  });

  test("center — each line x = (100 − lineWidth) / 2", () => {
    const ops = frame(TextAlign.Center);
    expect(ops[0]!.x).toBe((100 - 8 * NAMED_W) / 2); // 2
    expect(ops[3]!.x).toBe((100 - 6 * NAMED_W) / 2); // 14
  });

  test("right — each line x = 100 − lineWidth", () => {
    const ops = frame(TextAlign.Right);
    expect(ops[0]!.x).toBe(100 - 8 * NAMED_W); // 4
    expect(ops[3]!.x).toBe(100 - 6 * NAMED_W); // 28
  });

  test("left + default — every line at the box edge", () => {
    for (const align of [TextAlign.Left, undefined]) {
      const ops = frame(align);
      for (const op of ops) expect(op.x).toBe(0);
    }
  });
});

describe("textAlign on labels (unwrapped, wider box)", () => {
  test("center — x = (200 − textWidth) / 2", () => {
    const frame = renderHeadless(
      Label({
        text: "hi",
        font: "display",
        style: { width: 200, textAlign: TextAlign.Center },
      }),
      {
        width: 400,
        height: 300,
        fonts: (name) => (name === "display" ? namedFont : undefined),
      }
    );
    const ops = textXs(frame);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.x).toBe((200 - 2 * NAMED_W) / 2); // 88
  });

  test("right — x = 200 − textWidth", () => {
    const frame = renderHeadless(
      Label({
        text: "hi",
        font: "display",
        style: { width: 200, textAlign: TextAlign.Right },
      }),
      {
        width: 400,
        height: 300,
        fonts: (name) => (name === "display" ? namedFont : undefined),
      }
    );
    expect(textXs(frame)[0]!.x).toBe(200 - 2 * NAMED_W); // 176
  });

  test("8px/char fallback when no named font — center math on the estimate", () => {
    const frame = renderHeadless(
      Label({ text: "hi", style: { width: 200, textAlign: TextAlign.Center } }),
      { width: 400, height: 300 }
    );
    // 2 chars × 8px = 16 → x = (200 − 16) / 2 = 92.
    expect(textXs(frame)[0]!.x).toBe(92);
  });
});

describe("paintInlineValueLabel alignment", () => {
  // paintInlineValueLabel hands the GPU to font.draw — the recorder
  // lives on the font, not the gpu.
  const box = { x: 100, y: 50, w: 200, h: 30 };
  const drawn: Array<{ x: number }> = [];
  const font: TextPainter = {
    draw: (_gpu, opts) => {
      drawn.push({ x: opts.x });
    },
    measure: (text) => ({ width: text.length * 10, height: 18 }),
  };
  const gpu = {} as Painter;

  test("default center — x = box.x + (w − textWidth) / 2", () => {
    drawn.length = 0;
    paintInlineValueLabel(gpu, font, { ...box, label: "1234" });
    expect(drawn[0]!.x).toBe(100 + (200 - 40) / 2); // 180
  });

  test("labelStyle textAlign Left / Right override", () => {
    drawn.length = 0;
    paintInlineValueLabel(gpu, font, {
      ...box,
      label: "1234",
      labelStyle: { textAlign: TextAlign.Left },
    });
    expect(drawn[0]!.x).toBe(100);

    drawn.length = 0;
    paintInlineValueLabel(gpu, font, {
      ...box,
      label: "1234",
      labelStyle: { textAlign: TextAlign.Right },
    });
    expect(drawn[0]!.x).toBe(100 + 200 - 40); // 260
  });
});
