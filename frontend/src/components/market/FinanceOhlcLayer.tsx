"use client";

import type { ReactElement } from "react";

export interface FinanceOhlcPoint {
  label: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
}

interface AxisLike {
  scale?: ((value: string | number) => number) & { bandwidth?: () => number };
}

interface PlotOffset {
  left?: number;
  width?: number;
}

interface FinanceOhlcLayerProps {
  data: FinanceOhlcPoint[];
  mode: "bar" | "candle";
  xAxisMap?: Record<string | number, AxisLike>;
  yAxisMap?: Record<string | number, AxisLike>;
  xAxisId?: string | number;
  yAxisId?: string | number;
  offset?: PlotOffset;
  positiveColor?: string;
  negativeColor?: string;
}

function getAxis(map: FinanceOhlcLayerProps["xAxisMap"], axisId: string | number) {
  if (!map) return null;
  return map[axisId] ?? map[String(axisId)] ?? map[0] ?? Object.values(map)[0] ?? null;
}

function fallbackCenter(index: number, count: number, offset?: PlotOffset) {
  const left = offset?.left ?? 0;
  const width = offset?.width ?? 0;
  const slot = count > 0 ? width / count : 0;
  return left + slot * (index + 0.5);
}

function pointY(axis: AxisLike | null, value: number) {
  const y = axis?.scale?.(value);
  return Number.isFinite(y) ? Number(y) : 0;
}

export default function FinanceOhlcLayer({
  data,
  mode,
  xAxisMap,
  yAxisMap,
  xAxisId = 0,
  yAxisId = 0,
  offset,
  positiveColor = "var(--color-green-positive)",
  negativeColor = "var(--color-red-negative)",
}: FinanceOhlcLayerProps): ReactElement | null {
  if (data.length === 0) return null;

  const xAxis = getAxis(xAxisMap, xAxisId);
  const yAxis = getAxis(yAxisMap, yAxisId);
  const slotWidth = Math.max((offset?.width ?? 0) / data.length, 1);
  const candleWidth = Math.max(3, Math.min(slotWidth * 0.54, 13));
  const tickWidth = Math.max(3, Math.min(slotWidth * 0.36, 8));

  return (
    <g aria-hidden="true">
      {data.map((point, index) => {
        const open = typeof point.open === "number" ? point.open : point.price;
        const high = typeof point.high === "number" ? point.high : Math.max(open, point.price);
        const low = typeof point.low === "number" ? point.low : Math.min(open, point.price);
        const close = point.price;
        const positive = close >= open;
        const color = positive ? positiveColor : negativeColor;

        const scaledX = xAxis?.scale?.(point.label);
        const cx = Number.isFinite(scaledX) ? Number(scaledX) : fallbackCenter(index, data.length, offset);
        const openY = pointY(yAxis, open);
        const closeY = pointY(yAxis, close);
        const highY = pointY(yAxis, high);
        const lowY = pointY(yAxis, low);

        if (mode === "bar") {
          return (
            <g key={`${point.label}-${index}`} opacity={0.9}>
              <line x1={cx} x2={cx} y1={highY} y2={lowY} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
              <line x1={cx - tickWidth} x2={cx} y1={openY} y2={openY} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
              <line x1={cx} x2={cx + tickWidth} y1={closeY} y2={closeY} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
            </g>
          );
        }

        const top = Math.min(openY, closeY);
        const height = Math.max(Math.abs(closeY - openY), 2);

        return (
          <g key={`${point.label}-${index}`} opacity={0.92}>
            <line x1={cx} x2={cx} y1={highY} y2={lowY} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
            <rect
              x={cx - candleWidth / 2}
              y={top}
              width={candleWidth}
              height={height}
              rx={1.5}
              fill={positive ? "transparent" : color}
              stroke={color}
              strokeWidth={1.4}
            />
          </g>
        );
      })}
    </g>
  );
}
