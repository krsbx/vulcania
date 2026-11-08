/**
 * Controlled-first slider value resolution — the resolveChecked pattern
 * for sliders. `value` (controlled) wins; otherwise the value is
 * store-backed: `defaultValue` seeds it on first read (stateFor creates
 * without bumping — no repaint loop), pointer/keyboard writes update it
 * via setState, and the app loop's unconditional per-frame paint makes
 * the write visible. Without a store (headless fail-soft), the seed is
 * the value.
 */
import type { StateStore } from "@vulcania/core";
import { RangeHandle } from "./drag.ts";

/** RangeSlider store state — flying-pan's RangeSliderState shape. One
 *  combined object under the stableId so values and the grabbed handle
 *  stay coherent through a single key. */
export interface RangeSliderState {
  low: number;
  high: number;
  activeHandle: RangeHandle;
}

export interface SliderValueProps {
  value?: number;
  defaultValue?: number;
  min?: number;
}

export function resolveSliderValue(
  store: StateStore | undefined,
  stableId: number,
  props: SliderValueProps
): number {
  if (props.value !== undefined) return props.value;

  const seed = props.defaultValue ?? props.min ?? 0;
  return store?.stateFor<number>({ stableId, initial: seed }) ?? seed;
}

export interface RangeSliderValueProps {
  value?: [number, number];
  defaultValue?: [number, number];
  min?: number;
  max?: number;
}

export function resolveRangeSliderState(
  store: StateStore | undefined,
  stableId: number,
  props: RangeSliderValueProps
): RangeSliderState {
  const min = props.min ?? 0;
  const max = props.max ?? 100;

  // Controlled: values from props — but the grabbed handle still rides
  // the store (a pointer down persists it even in controlled mode).
  if (props.value !== undefined) {
    const handle =
      store?.stateFor<RangeSliderState | null>({
        stableId,
        initial: null,
      })?.activeHandle ?? RangeHandle.High;
    return {
      low: props.value[0],
      high: props.value[1],
      activeHandle: handle ?? RangeHandle.High,
    };
  }

  const [seedLow, seedHigh] = props.defaultValue ?? [min, max];
  return (
    store?.stateFor<RangeSliderState>({
      stableId,
      initial: { low: seedLow, high: seedHigh, activeHandle: RangeHandle.High },
    }) ?? { low: seedLow, high: seedHigh, activeHandle: RangeHandle.High }
  );
}
