"use client";

import type { ReactElement } from "react";
import { usePlotArea, useXAxisScale, useYAxisScale } from "recharts";

export interface FinanceOhlcPoint {
  label: string;
  chartIndex?: number;
  price: number;
  open?: number;
  high?: number;
  low?: number;
}

interface FinanceOhlcLayerProps {
  data: FinanceOhlcPoint[];
  mode: "bar" | "candle";
  xAxisId?: string | number;
  yAxisId?: string | number;
  positiveColor?: string;
  negativeColor?: string;
}

function fallbackCenter(index: number, count: number, plotArea?: { x: number; width: number }) {
  const left = plotArea?.x ?? 0;
  const width = plotArea?.width ?? 0;
  const slot = count > 0 ? width / count : 0;
  return left + slot * (index + 0.5);
}

function pointY(scale: ((value: unknown) => number | undefined) | undefined, value: number) {
  const y = scale?.(value);
  return Number.isFinite(y) ? Number(y) : 0;
}

export default function FinanceOhlcLayer({
  data,
  mode,
  xAxisId = 0,
  yAxisId = 0,
  positiveColor = "var(--color-green-positive)",
  negativeColor = "var(--color-red-negative)",
}: FinanceOhlcLayerProps): ReactElement | null {
  const xScale = useXAxisScale(xAxisId);
  const yScale = useYAxisScale(yAxisId);
  const plotArea = usePlotArea();

  if (data.length === 0) return null;

  const slotWidth = Math.max((plotArea?.width ?? 0) / data.length, 1);
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

        const scaledX = xScale?.(point.chartIndex ?? point.label, { position: "middle" });
        const cx = Number.isFinite(scaledX) ? Number(scaledX) : fallbackCenter(index, data.length, plotArea);
        const openY = pointY(yScale, open);
        const closeY = pointY(yScale, close);
        const highY = pointY(yScale, high);
        const lowY = pointY(yScale, low);

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
