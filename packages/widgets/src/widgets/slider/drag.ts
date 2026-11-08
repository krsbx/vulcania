/**
 * Slider drag contract — shared by SliderBar and CircularSlider. Ported
 * from flying-pan's widget/slider/pointer: press on the track jumps to
 * the value, press on the handle drags from the current value, captured
 * moves apply, hover moves never mutate.
 *
 * Value source is `resolveSliderValue`: controlled `value` wins;
 * otherwise the value is store-backed (defaultValue seeds it, drag
 * writes it) — uncontrolled sliders move and stick with no parent
 * state. `lastApplied` dedupes event-fed moves that recompute the same
 * position several times before the store/paint catches up. One
 * instance per descriptor — the closure state dies with the rebuild.
 */
import type { PointerPayload } from "@vulcania/core";
import { valueToRatio } from "@vulcania/layout";
import { HANDLE_SIZE, isOnBarHandle, pointerToValue } from "./geometry.ts";
import { resolveSliderValue } from "./value.ts";

export interface DragValueHandlerOptions {
  disabled?: boolean;
  /** Controlled value — wins over defaultValue. */
  value: number | undefined;
  /** Uncontrolled seed — store-backed. */
  defaultValue?: number;
  onChange?(value: number): void;
  /** Map a pointer position to the next (unclamped-by-caller) value. */
  positionToValue(x: number, y: number, node: PointerPayload["node"]): number;
  /** Is the pointer on the handle (live value at event time)? False =
   *  track press → jump. */
  onHandle(payload: PointerPayload): boolean;
}

export interface DragValueHandler {
  onClick(payload: PointerPayload): void;
  onPointerDown(payload: PointerPayload): void;
  onPointerMove(payload: PointerPayload): void;
}

export function createDragValueHandler(
  options: DragValueHandlerOptions
): DragValueHandler {
  let lastApplied: number | null = null;

  const apply = (payload: PointerPayload): void => {
    if (options.disabled) return;

    const next = options.positionToValue(payload.x, payload.y, payload.node);

    // Controlled: dedupe against the descriptor's value; the parent
    // re-render commits. Uncontrolled: dedupe against the store-backed
    // value and write it — no parent state involved.
    const current = resolveSliderValue(
      payload.stateStore,
      payload.stableId,
      options
    );
    if (next === (lastApplied ?? current)) return;
    lastApplied = next;

    if (options.value === undefined) {
      payload.stateStore?.setState({
        stableId: payload.stableId,
        value: next,
      });
    }
    options.onChange?.(next);
  };

  return {
    /** Track click (not on the handle) jumps straight to the value. */
    onClick: (payload) => {
      if (options.disabled) return;
      if (!options.onHandle(payload)) {
        apply(payload);
      }
    },
    /** Track press jumps; handle press drags from current; capture on. */
    onPointerDown: (payload) => {
      if (options.disabled) return;
      if (!options.onHandle(payload)) {
        apply(payload);
      }
      payload.capturePointer?.();
    },
    /** Drag applies only while captured — hover moves don't mutate. */
    onPointerMove: (payload) => {
      if (!payload.captured) return;
      apply(payload);
    },
  };
}

export const RangeHandle = {
  Low: "low",
  High: "high",
} as const;

export type RangeHandle = (typeof RangeHandle)[keyof typeof RangeHandle];

export interface RangeDragValueHandlerOptions {
  disabled?: boolean;
  /** Controlled [low, high] — wins over defaultValue. */
  value: [number, number] | undefined;
  /** Uncontrolled seed — store-backed. */
  defaultValue?: [number, number];
  min: number;
  max: number;
  step?: number;
  isVertical: boolean;
  onChange?(value: [number, number]): void;
}

/**
 * RangeSlider drag contract — flying-pan's createRangeSliderBarPointer
 * handler over the shared geometry. Two-tier grab on press: a handle
 * rect hit wins (low checked first, so coincident handles pick low),
 * otherwise the nearest handle by pixel distance — and the picked
 * handle jumps to the pointer. Drags clamp so handles can meet but
 * never cross.
 *
 * The whole state rides ONE combined store object under the stableId —
 * {low, high, activeHandle} (flying-pan's RangeSliderState) — via
 * resolveRangeSliderState. A controlled app rebuilds the descriptor on
 * every change and the closure would forget the grabbed handle
 * mid-drag; the store survives. The closure values are the fallback
 * for stateless callers (tests).
 */
export function createRangeDragValueHandler(
  options: RangeDragValueHandlerOptions
): DragValueHandler {
  let activeHandle: RangeHandle | null = null;
  let lastApplied: [number, number] | null = null;

  const isVertical = options.isVertical;

  /** Live [low, high] — controlled props or the store-backed state. */
  const committed = (payload: PointerPayload): [number, number] => {
    const state = resolveRangeSliderStateInternal(payload);
    return [state.low, state.high];
  };

  const resolveRangeSliderStateInternal = (
    payload: PointerPayload
  ): { low: number; high: number; activeHandle: RangeHandle } => {
    const state = payload.stateStore?.stateFor<{
      low: number;
      high: number;
      activeHandle: RangeHandle;
    } | null>({ stableId: payload.stableId, initial: null });

    if (options.value !== undefined) {
      // Controlled: values from props; keep the grabbed handle.
      return {
        low: options.value[0],
        high: options.value[1],
        activeHandle: state?.activeHandle ?? activeHandle ?? RangeHandle.High,
      };
    }

    const [seedLow, seedHigh] = options.defaultValue ?? [
      options.min,
      options.max,
    ];
    return (
      state ?? {
        low: seedLow,
        high: seedHigh,
        activeHandle: activeHandle ?? RangeHandle.High,
      }
    );
  };

  const rememberedHandle = (payload: PointerPayload): RangeHandle | null =>
    resolveRangeSliderStateInternal(payload).activeHandle ?? null;

  /** Handle rect hit first; else nearest handle by pixel (tie → low). */
  const pick = (
    payload: PointerPayload
  ): { handle: RangeHandle; onHandle: boolean } => {
    const [low, high] = committed(payload);
    const ratio = (v: number): number =>
      valueToRatio({ value: v, min: options.min, max: options.max });

    if (
      isOnBarHandle({
        x: payload.x,
        y: payload.y,
        node: payload.node,
        ratio: ratio(low),
        isVertical,
      })
    ) {
      return { handle: RangeHandle.Low, onHandle: true };
    }

    if (
      isOnBarHandle({
        x: payload.x,
        y: payload.y,
        node: payload.node,
        ratio: ratio(high),
        isVertical,
      })
    ) {
      return { handle: RangeHandle.High, onHandle: true };
    }

    const pointer = isVertical ? payload.y : payload.x;
    // Vertical mirrors: top = max, so the position uses (1 - ratio).
    const center = (v: number): number => {
      const r = ratio(v);
      return isVertical
        ? payload.node.screenY +
            (1 - r) * (payload.node.height - HANDLE_SIZE) +
            HANDLE_SIZE / 2
        : payload.node.screenX +
            r * (payload.node.width - HANDLE_SIZE) +
            HANDLE_SIZE / 2;
    };

    return {
      handle:
        Math.abs(pointer - center(low)) <= Math.abs(pointer - center(high))
          ? RangeHandle.Low
          : RangeHandle.High,
      onHandle: false,
    };
  };

  const apply = (payload: PointerPayload, handle: RangeHandle): void => {
    if (options.disabled) return;

    const raw = pointerToValue({
      coord: isVertical ? payload.y : payload.x,
      start: isVertical ? payload.node.screenY : payload.node.screenX,
      length: isVertical ? payload.node.height : payload.node.width,
      flip: isVertical,
      min: options.min,
      max: options.max,
      step: options.step,
    });

    const [low, high] = committed(payload);
    // Handles can meet but never cross.
    const next: [number, number] =
      handle === RangeHandle.Low
        ? [Math.min(raw, high), high]
        : [low, Math.max(raw, low)];
    const prev = lastApplied ?? committed(payload);
    if (next[0] === prev[0] && next[1] === prev[1]) return;
    lastApplied = next;

    if (options.value === undefined) {
      // Uncontrolled: persist the combined state object.
      const state = resolveRangeSliderStateInternal(payload);
      payload.stateStore?.setState({
        stableId: payload.stableId,
        value: { ...state, low: next[0], high: next[1] },
      });
    }
    options.onChange?.(next);
  };

  return {
    onClick: (payload) => {
      if (options.disabled) return;
      const picked = pick(payload);
      if (!picked.onHandle) apply(payload, picked.handle);
    },
    onPointerDown: (payload) => {
      if (options.disabled) return;
      const picked = pick(payload);
      activeHandle = picked.handle;
      // The grabbed handle survives the rebuild every controlled
      // change triggers — persisted as part of the combined object.
      const state = resolveRangeSliderStateInternal(payload);
      payload.stateStore?.setState({
        stableId: payload.stableId,
        value: { ...state, activeHandle: picked.handle },
      });
      // Handle press drags from the current value; track press jumps.
      if (!picked.onHandle) apply(payload, picked.handle);
      payload.capturePointer?.();
    },
    onPointerMove: (payload) => {
      if (!payload.captured) return;
      const handle = rememberedHandle(payload);
      if (handle === null) return;
      apply(payload, handle);
    },
  };
}
