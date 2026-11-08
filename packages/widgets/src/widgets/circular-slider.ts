/**
 * CircularSlider — drag on a ring (or arc). Ported from flying-pan's
 * widget/slider/circular: press on the track jumps to the angle's value,
 * press on the handle dot drags, captured moves apply. Controlled-only
 * (uncontrolled lands with the state milestone).
 */
import type { ReconcilableWidget } from "@vulcania/core";
import {
  disabledStyle,
  focusableWhen,
  focusStyle,
  Metrics,
  Palette,
} from "@vulcania/core";
import { clamp, PointerEvents, WidgetType } from "@vulcania/layout";
import { createWidget } from "../create-widget.ts";
import { createDragValueHandler } from "./slider/drag.ts";
import {
  DEFAULT_CIRCULAR_SIZE,
  DEFAULT_CIRCULAR_THICKNESS,
  HANDLE_SIZE,
  isOnCircularHandle,
  pointerToAngleValue,
  resolveGeometry,
} from "./slider/geometry.ts";
import { createSliderKeyHandler } from "./slider/keyboard.ts";
import type { CircularSliderProps } from "./slider/types.ts";
import { resolveSliderValue } from "./slider/value.ts";

export type { CircularSliderProps };

export function CircularSlider(props: CircularSliderProps): ReconcilableWidget {
  const {
    style,
    trackStyle,
    filledStyle,
    handleStyle,
    key,
    onClick,
    onPointerDown,
    onPointerMove,
    onKeyDown,
    ...handlers
  } = props;

  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const size = props.size ?? DEFAULT_CIRCULAR_SIZE;
  const thickness = props.thickness ?? DEFAULT_CIRCULAR_THICKNESS;

  const drag = createDragValueHandler({
    disabled: props.disabled,
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    positionToValue: (x, y, node) =>
      clamp({
        value: pointerToAngleValue({
          ...resolveGeometry(props, node),
          pointerX: x,
          pointerY: y,
          step: props.step,
        }),
        min,
        max,
      }),
    onHandle: (payload) =>
      isOnCircularHandle({
        x: payload.x,
        y: payload.y,
        geo: resolveGeometry(props, payload.node),
        value: resolveSliderValue(payload.stateStore, payload.stableId, props),
        size,
        thickness,
      }),
  });

  // flying-pan parity: the circular slider reuses the single slider's
  // keyboard handler — arrows step the value, geometry irrelevant.
  const keyHandler = createSliderKeyHandler({
    disabled: props.disabled,
    value: props.value,
    defaultValue: props.defaultValue,
    min,
    max,
    step: props.step,
    onChange: props.onChange,
  });

  return createWidget({
    type: WidgetType.CircularSlider,
    props: {
      value: props.value,
      defaultValue: props.defaultValue,
      min,
      max,
      step: props.step,
      disabled: props.disabled,
      colorStops: props.colorStops,
      label: props.label,
      labelStyle: props.labelStyle,
      showValue: props.showValue,
      size,
      thickness,
      startAngle: props.startAngle,
      sweep: props.sweep,
      direction: props.direction,
      trackStyle: {
        backgroundColor: Palette.surfaceActive,
        ...trackStyle,
        _disabled: disabledStyle(trackStyle),
      },
      filledStyle: {
        backgroundColor: Palette.accent,
        ...filledStyle,
        _disabled: disabledStyle(filledStyle),
      },
      handleStyle: {
        backgroundColor: Palette.surface,
        borderWidth: Metrics.borderWidth,
        borderColor: Palette.border,
        borderRadius: HANDLE_SIZE / 2,
        ...handleStyle,
        _disabled: disabledStyle(handleStyle),
      },
    },
    style: {
      width: size,
      height: size,
      // The control paints its own ring — the box is hit space only.
      backgroundColor: "transparent",
      focusable: focusableWhen(!props.disabled),
      pointerEvents: PointerEvents.Auto,
      ...style,
      _focus: focusStyle(style),
      _disabled: disabledStyle(style),
    },
    key,
    handlers: {
      ...handlers,
      onClick: (payload) => {
        onClick?.(payload);
        drag.onClick(payload);
      },
      onPointerDown: (payload) => {
        onPointerDown?.(payload);
        drag.onPointerDown(payload);
      },
      onPointerMove: (payload) => {
        onPointerMove?.(payload);
        drag.onPointerMove(payload);
      },
      onKeyDown: (payload) => {
        onKeyDown?.(payload);
        keyHandler(payload);
      },
    },
  });
}
