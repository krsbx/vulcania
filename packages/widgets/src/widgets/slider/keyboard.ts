/**
 * Slider keyboard contract — flying-pan's widget/slider/handler ported
 * to the KeyPayload the FocusDispatcher routes to focused widgets:
 * arrows step (Shift ×10), Home/End jump to min/max, clamped, no-op at
 * the bounds.
 *
 * Value source is `resolveSliderValue` / `resolveRangeSliderState`:
 * controlled `value` wins (onChange-only); otherwise the value is
 * store-backed (defaultValue seeds, keys write) — uncontrolled sliders
 * move and stick with no parent state.
 */
import { KeyCode, KeyModifiers, type KeyPayload } from "@vulcania/core";
import { RangeHandle } from "./drag.ts";
import { resolveRangeSliderState, resolveSliderValue } from "./value.ts";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export interface SliderKeyHandlerOptions {
  disabled?: boolean;
  /** Controlled value — wins over defaultValue. */
  value: number | undefined;
  /** Uncontrolled seed — store-backed. */
  defaultValue?: number;
  min: number;
  max: number;
  step?: number;
  onChange?(value: number): void;
}

export function createSliderKeyHandler(
  options: SliderKeyHandlerOptions
): (payload: KeyPayload) => void {
  return (payload) => {
    if (options.disabled) return;

    const step = options.step ?? 1;
    const delta =
      step * ((payload.modifiers & KeyModifiers.Shift) !== 0 ? 10 : 1);
    const current = resolveSliderValue(
      payload.stateStore,
      payload.stableId,
      options
    );

    let next: number;
    switch (payload.key) {
      case KeyCode.Left:
      case KeyCode.Down:
        next = current - delta;
        break;
      case KeyCode.Right:
      case KeyCode.Up:
        next = current + delta;
        break;
      case KeyCode.Home:
        next = options.min;
        break;
      case KeyCode.End:
        next = options.max;
        break;
      default:
        return;
    }

    next = clamp(next, options.min, options.max);
    if (next === current) return;

    if (options.value === undefined) {
      payload.stateStore?.setState({
        stableId: payload.stableId,
        value: next,
      });
    }
    options.onChange?.(next);
  };
}

export interface RangeSliderKeyHandlerOptions {
  disabled?: boolean;
  /** Controlled [low, high] — wins over defaultValue. */
  value: [number, number] | undefined;
  /** Uncontrolled seed — store-backed. */
  defaultValue?: [number, number];
  min: number;
  max: number;
  step?: number;
  onChange?(value: [number, number]): void;
}

export function createRangeSliderKeyHandler(
  options: RangeSliderKeyHandlerOptions
): (payload: KeyPayload) => void {
  return (payload) => {
    if (options.disabled) return;

    const step = options.step ?? 1;
    const delta =
      step * ((payload.modifiers & KeyModifiers.Shift) !== 0 ? 10 : 1);

    const state = resolveRangeSliderState(
      payload.stateStore,
      payload.stableId,
      options
    );
    const { low, high } = state;
    // The grabbed handle — pointer and keyboard share it via the store.
    const handle = state.activeHandle ?? RangeHandle.High;

    let moved: number;
    switch (payload.key) {
      case KeyCode.Left:
      case KeyCode.Down:
        moved = (handle === RangeHandle.Low ? low : high) - delta;
        break;
      case KeyCode.Right:
      case KeyCode.Up:
        moved = (handle === RangeHandle.Low ? low : high) + delta;
        break;
      case KeyCode.Home:
        moved = options.min;
        break;
      case KeyCode.End:
        moved = options.max;
        break;
      default:
        return;
    }

    // Handles can meet but never cross.
    if (handle === RangeHandle.Low) {
      const next = clamp(Math.min(moved, high), options.min, options.max);
      if (next === low) return;
      if (options.value === undefined) {
        payload.stateStore?.setState({
          stableId: payload.stableId,
          value: { ...state, low: next },
        });
      }
      options.onChange?.([next, high]);
    } else {
      const next = clamp(Math.max(moved, low), options.min, options.max);
      if (next === high) return;
      if (options.value === undefined) {
        payload.stateStore?.setState({
          stableId: payload.stableId,
          value: { ...state, high: next },
        });
      }
      options.onChange?.([low, next]);
    }
  };
}
