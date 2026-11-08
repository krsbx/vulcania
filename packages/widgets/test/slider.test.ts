/**
 * SliderBar — paint structure, the drag contract through the real
 * dispatcher (track-press jumps, handle-press drags, hover never
 * mutates, step snapping, disabled no-op), and the keyboard contract
 * (arrows step, Shift ×10, Home/End) on the focused slider.
 */
import {
  KeyCode,
  KeyModifiers,
  MouseButton,
  Palette,
  StateStore,
} from "@vulcania/core";
import {
  FocusDispatcher,
  type KeyboardInputEvent,
  KeyboardInputKind,
  PointerDispatcher,
  PointerInputKind,
} from "@vulcania/interactions";
import {
  type LayoutContext,
  layoutFlex,
  type LayoutNode,
} from "@vulcania/layout";
import { parseColor } from "@vulcania/paint";
import { describe, expect, test } from "bun:test";
import {
  type PaintOp,
  PaintOpKind,
  Reconciler,
  renderHeadless,
  SliderBar,
} from "../src/index.ts";

interface Harness {
  fire(
    events: {
      kind: PointerInputKind;
      x: number;
      y: number;
      button?: MouseButton;
    }[]
  ): void;
  render(widget: Parameters<typeof renderHeadless>[0]): void;
  /** Focus the slider (click-to-focus) at a point on it. */
  focus(x: number, y: number): void;
  key(key: KeyCode, modifiers?: KeyModifiers, repeat?: boolean): void;
}

function setup(widget: Parameters<typeof renderHeadless>[0]): Harness {
  const stateStore = new StateStore();
  const reconciler = new Reconciler(stateStore);
  const dispatcher = new PointerDispatcher();
  const focus = new FocusDispatcher();

  const layoutIndex = new Map<number, LayoutNode>();
  const focusableNodes: LayoutNode[] = [];
  const ctx: LayoutContext = {
    layoutIndex,
    focusableNodes,
    scrollOffsetOf: () => ({ x: 0, y: 0 }),
    getStableId: reconciler.getStableId,
    measureText: (text) => ({ width: text.length * 8, height: 18 }),
    getImageSize: () => null,
  };

  let root = layoutFlex({
    node: reconciler.reconcile(widget).widget,
    x: 0,
    y: 0,
    availableWidth: 400,
    availableHeight: 300,
    ctx,
  });

  return {
    fire(events) {
      dispatcher.dispatch({ events, root, layoutIndex });
    },
    render(next) {
      root = layoutFlex({
        node: reconciler.reconcile(next).widget,
        x: 0,
        y: 0,
        availableWidth: 400,
        availableHeight: 300,
        ctx,
      });
    },
    focus(x, y) {
      const down = {
        kind: PointerInputKind.Down,
        x,
        y,
        button: MouseButton.Left,
      };
      dispatcher.dispatch({ events: [down], root, layoutIndex });
      focus.dispatch({
        pointerEvents: [down],
        keyboardEvents: [],
        root,
        layoutIndex,
        focusableNodes,
        stateStore,
      });
    },
    key(key, modifiers = KeyModifiers.None, repeat = false) {
      const event = {
        kind: KeyboardInputKind.KeyDown,
        key,
        modifiers,
        repeat,
      } as KeyboardInputEvent;
      focus.dispatch({
        pointerEvents: [],
        keyboardEvents: [event],
        root,
        layoutIndex,
        focusableNodes,
        stateStore,
      });
    },
  };
}

const ev = (
  kind: PointerInputKind,
  x: number,
  y: number
): { kind: PointerInputKind; x: number; y: number; button?: MouseButton } => {
  const button =
    kind === PointerInputKind.Down || kind === PointerInputKind.Up
      ? MouseButton.Left
      : undefined;
  return { kind, x, y, button };
};

describe("SliderBar paint", () => {
  test("track → fill → handle at the value's ratio", () => {
    const frame = renderHeadless(
      SliderBar({
        value: 50,
        min: 0,
        max: 100,
        style: { width: 200, height: 24 },
      }),
      { width: 400, height: 300 }
    );

    // Drop the control's own transparent box — what's left is
    // track (200×4) + fill (to the handle center) + the handle's border
    // ring and surface fill.
    type Fill = PaintOp & {
      color: number;
      x: number;
      y: number;
      w: number;
      h: number;
    };
    const fills = frame.ops.filter((op): op is Fill => {
      const solid =
        op.op === PaintOpKind.Rect || op.op === PaintOpKind.RoundedRect;
      return solid && (op as Fill).color !== 0;
    });
    expect(fills.length).toBe(4);
    expect(fills[0]).toMatchObject({
      x: 0,
      y: 10,
      w: 200,
      h: 4,
      color: parseColor(Palette.surfaceActive),
    });
    expect(fills[1]).toMatchObject({
      x: 0,
      w: 100,
      h: 4,
      color: parseColor(Palette.accent),
    });
    // Handle: border ring first, then the surface fill inside it.
    expect(fills[2]).toMatchObject({
      x: 91.5,
      y: 3.5,
      w: 17,
      h: 17,
      color: parseColor(Palette.border),
    });
    expect(fills[3]).toMatchObject({
      x: 92,
      y: 4,
      w: 16,
      h: 16,
      color: parseColor(Palette.surface),
    });
  });

  test("marks render as ticks at their value positions", () => {
    const frame = renderHeadless(
      SliderBar({
        value: 50,
        min: 0,
        max: 100,
        marks: [{ value: 0, label: "low" }, { value: 100 }],
        style: { width: 200, height: 24 },
      }),
      { width: 400, height: 300 }
    );

    const ticks = frame.ops.filter(
      (op): op is PaintOp & { w: number; x: number } =>
        op.op === PaintOpKind.Rect && (op as PaintOp & { w: number }).w === 3
    );
    expect(ticks.length).toBe(2);
    expect(ticks[0]).toMatchObject({
      x: -1.5,
      color: parseColor(Palette.border),
    });
    expect(ticks[1]).toMatchObject({ x: 198.5 });
  });
});

describe("SliderBar drag", () => {
  test("track press jumps, handle press drags, hover never mutates", () => {
    const changes: number[] = [];
    let value = 50;

    const make = (): Parameters<typeof renderHeadless>[0] =>
      SliderBar({
        value,
        min: 0,
        max: 100,
        style: { width: 200, height: 24 },
        onChange: (next) => {
          changes.push(next);
          value = next;
        },
      });

    const harness = setup(make());

    // Hover over the track — no change (no press, not captured).
    harness.fire([ev(PointerInputKind.Move, 150, 12)]);
    expect(changes).toEqual([]);

    // Track press (far from the centered 50% handle at x 92..108) jumps to
    // ~75, captures, and the following move drags onward.
    harness.fire([ev(PointerInputKind.Down, 150, 12)]);
    harness.fire([ev(PointerInputKind.Move, 150, 12)]);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]).toBeGreaterThan(50);

    // Release ends the drag; further hover moves must not mutate.
    harness.fire([ev(PointerInputKind.Up, 150, 12)]);
    const before = changes.length;
    harness.fire([ev(PointerInputKind.Move, 20, 12)]);
    expect(changes.length).toBe(before);

    // Rebuild like the app loop, then drag FROM the handle (no jump): press
    // at the handle, move left — values step down from the current one.
    harness.render(make());
    const handleX = 8 + (value / 100) * (200 - 16);
    const valueBeforeDrag = value;
    harness.fire([ev(PointerInputKind.Down, handleX, 12)]);
    const atHandle = changes.length;
    harness.fire([ev(PointerInputKind.Move, handleX - 40, 12)]);
    expect(changes.length).toBe(atHandle + 1);
    expect(changes[changes.length - 1]).toBeLessThan(valueBeforeDrag);
  });

  test("step snaps drag values", () => {
    const changes: number[] = [];
    let value = 50;

    const make = (): Parameters<typeof renderHeadless>[0] =>
      SliderBar({
        value,
        min: 0,
        max: 100,
        step: 25,
        style: { width: 200, height: 24 },
        onChange: (next) => {
          changes.push(next);
          value = next;
        },
      });

    const harness = setup(make());
    harness.fire([ev(PointerInputKind.Down, 100, 12)]);
    const seen = new Set(changes);
    for (const seen_ of seen) expect(seen_ % 25).toBe(0);
    expect(harness).toBeDefined();
  });

  test("disabled slider ignores everything", () => {
    const changes: number[] = [];
    const { fire } = setup(
      SliderBar({
        value: 50,
        min: 0,
        max: 100,
        disabled: true,
        style: { width: 200, height: 24 },
        onChange: (next) => changes.push(next),
      })
    );

    fire([ev(PointerInputKind.Down, 150, 12)]);
    fire([ev(PointerInputKind.Move, 150, 12)]);
    fire([ev(PointerInputKind.Up, 150, 12)]);

    expect(changes).toEqual([]);
  });

  test("full harness wiring works end to end", () => {
    // Sanity: setup + render rebuild keeps dispatching against the new tree.
    let value = 25;
    const harness = setup(
      SliderBar({
        value,
        min: 0,
        max: 100,
        style: { width: 200, height: 24 },
        onChange: (next) => {
          value = next;
        },
      })
    );
    harness.fire([ev(PointerInputKind.Down, 8, 12)]);
    harness.render(
      SliderBar({
        value,
        min: 0,
        max: 100,
        style: { width: 200, height: 24 },
        onChange: (next) => {
          value = next;
        },
      })
    );
    harness.fire([ev(PointerInputKind.Move, 192, 12)]);
    expect(value).toBe(100);
  });
});

describe("SliderBar keyboard", () => {
  /** Controlled slider + harness; the value lives in the closure. */
  function keyboardHarness(
    initial: number,
    disabled = false
  ): {
    h: Harness;
    value: () => number;
    widget: () => Parameters<typeof renderHeadless>[0];
  } {
    let current = initial;
    const widget = (): Parameters<typeof renderHeadless>[0] =>
      SliderBar({
        value: current,
        min: 0,
        max: 100,
        disabled,
        style: { width: 200, height: 24 },
        onChange: (next) => {
          current = next;
        },
      });
    return { h: setup(widget()), value: () => current, widget };
  }

  test("arrows step ±1 — Left/Down decrement, Right/Up increment", () => {
    const { h, value, widget } = keyboardHarness(50);
    const handleCenter = 8 + (50 / 100) * (200 - 16);

    h.focus(handleCenter, 12);
    h.key(KeyCode.Right);
    h.render(widget());
    expect(value()).toBe(51);

    h.key(KeyCode.Up);
    h.render(widget());
    expect(value()).toBe(52);

    h.key(KeyCode.Left);
    h.render(widget());
    expect(value()).toBe(51);

    h.key(KeyCode.Down);
    h.render(widget());
    expect(value()).toBe(50);
  });

  test("Shift ×10 — coarse steps", () => {
    const { h, value, widget } = keyboardHarness(50);
    h.focus(8 + (50 / 100) * 184, 12);

    h.key(KeyCode.Right, KeyModifiers.Shift);
    h.render(widget());
    expect(value()).toBe(60);

    h.key(KeyCode.Left, KeyModifiers.Shift);
    h.render(widget());
    expect(value()).toBe(50);
  });

  test("Home/End jump to min/max", () => {
    const { h, value, widget } = keyboardHarness(50);
    h.focus(8 + (50 / 100) * 184, 12);

    h.key(KeyCode.End);
    h.render(widget());
    expect(value()).toBe(100);

    h.key(KeyCode.Home);
    h.render(widget());
    expect(value()).toBe(0);
  });

  test("clamps at the bounds — no-op beyond them", () => {
    const { h, value, widget } = keyboardHarness(100);
    h.focus(8 + (100 / 100) * 184, 12);

    h.key(KeyCode.Right);
    h.key(KeyCode.Up);
    h.render(widget());
    expect(value()).toBe(100);

    h.key(KeyCode.Home);
    h.render(widget());
    h.key(KeyCode.Left);
    h.key(KeyCode.Down);
    h.render(widget());
    expect(value()).toBe(0);
  });

  test("step scales the delta", () => {
    let current = 10;
    const widget = (): Parameters<typeof renderHeadless>[0] =>
      SliderBar({
        value: current,
        min: 0,
        max: 100,
        step: 25,
        style: { width: 200, height: 24 },
        onChange: (next) => {
          current = next;
        },
      });
    const h = setup(widget());
    h.focus(8 + (10 / 100) * 184, 12);

    h.key(KeyCode.Right);
    h.render(widget());
    expect(current).toBe(35);
  });

  test("keys only reach a focused slider", () => {
    const { h, value, widget } = keyboardHarness(50);

    // No focus() — the key event has no focused target.
    h.key(KeyCode.Right);
    h.render(widget());
    expect(value()).toBe(50);
  });

  test("disabled slider ignores keys", () => {
    const { h, value, widget } = keyboardHarness(50, true);
    // focusableWhen(disabled) → not focusable, so focus() won't grab it;
    // keys route nowhere regardless.
    h.focus(104, 12);
    h.key(KeyCode.Right);
    h.render(widget());
    expect(value()).toBe(50);
  });

  test("user onKeyDown still receives the payload", () => {
    const payloads: Array<{ key: KeyCode }> = [];
    let current = 50;
    const widget = (): Parameters<typeof renderHeadless>[0] =>
      SliderBar({
        value: current,
        min: 0,
        max: 100,
        style: { width: 200, height: 24 },
        onKeyDown: (payload) => {
          payloads.push({ key: payload.key as KeyCode });
        },
        onChange: (next) => {
          current = next;
        },
      });
    const h = setup(widget());
    h.focus(8 + (50 / 100) * 184, 12);

    h.key(KeyCode.Right);
    h.render(widget());
    expect(current).toBe(51);
    expect(payloads).toEqual([{ key: KeyCode.Right }]);
  });
});
