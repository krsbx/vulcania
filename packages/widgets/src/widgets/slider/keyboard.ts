/**
 * Slider keyboard contract — flying-pan's widget/slider/handler ported
 * to the KeyPayload the FocusDispatcher routes to focused widgets:
 * arrows step (Shift ×10), Home/End jump to min/max, clamped, no-op at
 * the bounds. Controlled-only like the pointer path — `value`
 * undefined reads `min`, same as sliderValue().
 */
import { KeyCode, KeyModifiers, type KeyPayload } from "@vulcania/core";
import { RangeHandle } from "./drag.ts";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export interface SliderKeyHandlerOptions {
  disabled?: boolean;
  /** Currently committed controlled value. */
  value: number | undefined;
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
    const current = options.value ?? options.min;

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

    options.onChange?.(next);
  };
}

export interface RangeSliderKeyHandlerOptions {
  disabled?: boolean;
  /** Currently committed controlled [low, high]. */
  value: [number, number] | undefined;
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
    const [low, high] = options.value ?? [options.min, options.max];

    // The same key drag.ts writes — pointer-then-keyboard share the
    // grabbed handle. Nothing grabbed (no pointer, no store) → high,
    // flying-pan's controlled default.
    const handle =
      payload.stateStore?.stateFor<RangeHandle | null>({
        stableId: payload.stableId,
        initial: null,
      }) ?? RangeHandle.High;

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

      options.onChange?.([next, high]);
    } else {
      const next = clamp(Math.max(moved, low), options.min, options.max);

      if (next === high) return;

      options.onChange?.([low, next]);
    }
  };
}
