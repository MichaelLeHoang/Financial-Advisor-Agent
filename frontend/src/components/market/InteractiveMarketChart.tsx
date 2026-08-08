"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

export type InteractiveChartMode = "area" | "line" | "candle" | "bar";

export interface InteractiveChartPoint {
  label: string;
  price: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface InteractiveChartLine {
  key: string;
  color: string;
  priceScaleId?: "left" | "right";
  lineWidth?: 1 | 2 | 3 | 4;
}

interface InteractiveMarketChartProps<T extends InteractiveChartPoint> {
  data: T[];
  mode: InteractiveChartMode;
  color: string;
  positiveColor?: string;
  negativeColor?: string;
  compareMode?: boolean;
  compareLines?: InteractiveChartLine[];
  overlayLines?: InteractiveChartLine[];
  valueKey?: string;
  volume?: boolean;
  tooltip?: (point: T) => ReactNode;
  onHover?: (point: T | null) => void;
  axisFormatter?: (value: number) => string;
  timeFormatter?: (label: string) => string;
  rangeKey?: string;
  onRequestLongerRange?: () => void;
  className?: string;
  tooltipClassName?: string;
  fitKey?: number;
  measurementEnabled?: boolean;
}

const BASE_TIME = 946_684_800 as Time;
const FALLBACK_UP = "#34d399";
const FALLBACK_DOWN = "#f87171";
const FALLBACK_LINE = "#818cf8";
const ZOOM_OUT_RANGE_THRESHOLD = 1.12;

type MeasurementState = {
  startIndex: number;
  endIndex: number;
  startX: number;
  endX: number;
  average: number;
  change: number;
  percent: number;
  bars: number;
  startLabel: string;
  endLabel: string;
};

function pointTime(index: number): Time {
  return (Number(BASE_TIME) + index * 86_400) as Time;
}

function resolveChartColor(color: string | undefined, fallback: string) {
  if (!color) return fallback;
  const trimmed = color.trim();
  const varMatch = trimmed.match(/^var\((--[^),\s]+)(?:,\s*([^)]+))?\)$/);
  if (!varMatch) return trimmed;
  if (typeof window === "undefined") return varMatch[2]?.trim() || fallback;
  const resolved = (
    getComputedStyle(document.body).getPropertyValue(varMatch[1]).trim() ||
    getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim()
  );
  return resolved || varMatch[2]?.trim() || fallback;
}

function colorWithAlpha(color: string, alpha: number, fallback: string) {
  const resolved = resolveChartColor(color, fallback);
  const hex = resolved.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const normalized = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
    const value = Number.parseInt(normalized, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgb = resolved.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const [red, green, blue] = rgb[1].split(",").slice(0, 3).map((part) => part.trim());
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return alpha >= 1 ? resolved : fallback;
}

function valueAt(point: InteractiveChartPoint, key: string): number | null {
  const value = point[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toOhlc(point: InteractiveChartPoint, index: number) {
  const open = typeof point.open === "number" ? point.open : point.price;
  const high = typeof point.high === "number" ? point.high : Math.max(open, point.price);
  const low = typeof point.low === "number" ? point.low : Math.min(open, point.price);
  return {
    time: pointTime(index),
    open,
    high,
    low,
    close: point.price,
  };
}

function zoomChart(chart: IChartApi | null, factor: number) {
  if (!chart) return;
  const range = chart.timeScale().getVisibleLogicalRange();
  if (!range) return;

  const center = (range.from + range.to) / 2;
  const halfWidth = Math.max(((range.to - range.from) * factor) / 2, 3);
  chart.timeScale().setVisibleLogicalRange({
    from: center - halfWidth,
    to: center + halfWidth,
  });
}

function fitChart(chart: IChartApi | null) {
  chart?.timeScale().fitContent();
}

export default function InteractiveMarketChart<T extends InteractiveChartPoint>({
  data,
  mode,
  color,
  positiveColor = "#34d399",
  negativeColor = "#f87171",
  compareMode = false,
  compareLines = [],
  overlayLines = [],
  valueKey = "price",
  volume = true,
  tooltip,
  onHover,
  axisFormatter,
  timeFormatter,
  rangeKey,
  onRequestLongerRange,
  className,
  tooltipClassName,
  fitKey = 0,
  measurementEnabled = true,
}: InteractiveMarketChartProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area" | "Bar" | "Candlestick" | "Histogram" | "Line">[]>([]);
  const onHoverRef = useRef(onHover);
  const onRequestLongerRangeRef = useRef(onRequestLongerRange);
  const dataRef = useRef(data);
  const pointByTimeRef = useRef<Map<number, T>>(new Map());
  const timeFormatterRef = useRef(timeFormatter);
  const didFitRef = useRef(false);
  const rangeRequestLockedRef = useRef(false);
  const lastDataChangeAtRef = useRef(0);
  const measurementStartRef = useRef<number | null>(null);
  const measurementEnabledRef = useRef(measurementEnabled);
  const measurementDraftRef = useRef<{ startX: number; moved: boolean }>({ startX: 0, moved: false });
  const [hoverPoint, setHoverPoint] = useState<{ point: T; x: number; y: number } | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementState | null>(null);
  const [isRangeTransitioning, setIsRangeTransitioning] = useState(false);
  const [fitAppliedKey, setFitAppliedKey] = useState(0);
  const compareLinesSignature = JSON.stringify(compareLines);
  const overlayLinesSignature = JSON.stringify(overlayLines);
  const chartColors = useMemo(() => {
    const line = resolveChartColor(color, FALLBACK_LINE);
    const positive = resolveChartColor(positiveColor, FALLBACK_UP);
    const negative = resolveChartColor(negativeColor, FALLBACK_DOWN);
    return {
      line,
      positive,
      negative,
      volumePositive: colorWithAlpha(positiveColor, 0.34, "rgba(34, 199, 169, 0.34)"),
      volumeNegative: colorWithAlpha(negativeColor, 0.34, "rgba(240, 68, 100, 0.34)"),
      areaTop: colorWithAlpha(color, 0.34, "rgba(129, 140, 248, 0.34)"),
      areaBottom: colorWithAlpha(color, 0.04, "rgba(129, 140, 248, 0.04)"),
      compareLines: compareLines.map((lineConfig) => ({
        ...lineConfig,
        color: resolveChartColor(lineConfig.color, FALLBACK_LINE),
      })),
      overlayLines: overlayLines.map((lineConfig) => ({
        ...lineConfig,
        color: resolveChartColor(lineConfig.color, FALLBACK_LINE),
      })),
    };
  }, [color, compareLinesSignature, negativeColor, overlayLinesSignature, positiveColor]);
  const pointByTime = useMemo(() => {
    const map = new Map<number, T>();
    data.forEach((point, index) => map.set(Number(pointTime(index)), point));
    return map;
  }, [data]);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    onRequestLongerRangeRef.current = onRequestLongerRange;
  }, [onRequestLongerRange]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    pointByTimeRef.current = pointByTime;
  }, [pointByTime]);

  useEffect(() => {
    timeFormatterRef.current = timeFormatter;
  }, [timeFormatter]);

  useEffect(() => { measurementEnabledRef.current = measurementEnabled; if (!measurementEnabled) setMeasurement(null); }, [measurementEnabled]);

  useEffect(() => {
    didFitRef.current = false;
    rangeRequestLockedRef.current = false;
    setMeasurement(null);
    setIsRangeTransitioning(true);
    const timer = window.setTimeout(() => setIsRangeTransitioning(false), 220);
    return () => window.clearTimeout(timer);
  }, [rangeKey]);

  useEffect(() => {
    if (fitKey <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      fitChart(chartRef.current);
      didFitRef.current = true;
      setFitAppliedKey(fitKey);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitKey]);

  const measurementFromLogical = (startLogical: number, endLogical: number): MeasurementState | null => {
    const chart = chartRef.current;
    const points = dataRef.current;
    if (!chart || points.length === 0) return null;

    const startIndex = Math.max(0, Math.min(points.length - 1, Math.round(startLogical)));
    const endIndex = Math.max(0, Math.min(points.length - 1, Math.round(endLogical)));
    const startX = chart.timeScale().logicalToCoordinate(startIndex as Logical);
    const endX = chart.timeScale().logicalToCoordinate(endIndex as Logical);
    if (startX == null || endX == null) return null;

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    const slice = points.slice(from, to + 1);
    const average = slice.reduce((sum, point) => sum + point.price, 0) / Math.max(slice.length, 1);
    const startPrice = points[startIndex]?.price ?? 0;
    const endPrice = points[endIndex]?.price ?? startPrice;
    const change = endPrice - startPrice;
    const percent = startPrice ? (change / startPrice) * 100 : 0;

    return {
      startIndex,
      endIndex,
      startX,
      endX,
      average,
      change,
      percent,
      bars: slice.length,
      startLabel: points[startIndex]?.label ?? "",
      endLabel: points[endIndex]?.label ?? "",
    };
  };

  const updateMeasurement = (startLogical: number, endLogical: number) => {
    const next = measurementFromLogical(startLogical, endLogical);
    if (next) setMeasurement(next);
  };

  const requestLongerRangeIfNeeded = (range: LogicalRange | null) => {
    if (!range || !onRequestLongerRangeRef.current || rangeRequestLockedRef.current) return;
    if (Date.now() - lastDataChangeAtRef.current < 500) return;
    const pointCount = dataRef.current.length;
    if (pointCount < 4) return;
    const visibleWidth = Number(range.to) - Number(range.from);
    if (visibleWidth < pointCount * ZOOM_OUT_RANGE_THRESHOLD) return;
    rangeRequestLockedRef.current = true;
    onRequestLongerRangeRef.current();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: resolveChartColor("var(--text-muted)", "rgba(255,255,255,0.52)"),
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: resolveChartColor("var(--theme-border)", "rgba(255,255,255,0.045)") },
        horzLines: { color: resolveChartColor("var(--theme-border)", "rgba(255,255,255,0.07)") },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: false,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: false,
        pinch: true,
      },
      leftPriceScale: {
        borderVisible: false,
        visible: false,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: volume ? 0.24 : 0.08 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 2,
        fixLeftEdge: true,
        tickMarkFormatter: (time: Time) => {
          const point = pointByTimeRef.current.get(Number(time));
          const label = point?.label ?? "";
          return timeFormatterRef.current ? timeFormatterRef.current(label) : label;
        },
      },
      localization: {
        priceFormatter: axisFormatter,
      },
    });

    chartRef.current = chart;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      zoomChart(chart, event.deltaY < 0 ? 0.82 : 1.22);
    };

    const handleDoubleClick = () => fitChart(chart);

    const logicalFromPointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      return chart.timeScale().coordinateToLogical(x);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !measurementEnabledRef.current) return;
      const logical = logicalFromPointer(event);
      if (logical == null) return;
      measurementStartRef.current = Number(logical);
      measurementDraftRef.current = { startX: event.clientX, moved: false };
      updateMeasurement(Number(logical), Number(logical));
      container.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (measurementStartRef.current == null) return;
      const logical = logicalFromPointer(event);
      if (logical == null) return;
      if (Math.abs(event.clientX - measurementDraftRef.current.startX) > 3) {
        measurementDraftRef.current.moved = true;
      }
      updateMeasurement(measurementStartRef.current, Number(logical));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (measurementStartRef.current == null) return;
      if (!measurementDraftRef.current.moved) setMeasurement(null);
      measurementStartRef.current = null;
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    };

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!param.point || param.time === undefined) {
        setHoverPoint(null);
        onHoverRef.current?.(null);
        return;
      }

      const point = pointByTimeRef.current.get(Number(param.time));
      if (!point) {
        setHoverPoint(null);
        onHoverRef.current?.(null);
        return;
      }

      setHoverPoint({ point, x: param.point.x, y: param.point.y });
      onHoverRef.current?.(point);
    };

    const handleVisibleLogicalRangeChange = (range: LogicalRange | null) => {
      requestLongerRangeIfNeeded(range);
      setMeasurement((current) => {
        if (!current) return null;
        return measurementFromLogical(current.startIndex, current.endIndex) ?? current;
      });
    };

    container.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    container.addEventListener("dblclick", handleDoubleClick);
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    return () => {
      container.removeEventListener("wheel", handleWheel, true);
      container.removeEventListener("dblclick", handleDoubleClick);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      seriesRef.current = [];
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      localization: {
        priceFormatter: axisFormatter,
      },
      timeScale: {
        tickMarkFormatter: (time: Time) => {
          const point = pointByTimeRef.current.get(Number(time));
          const label = point?.label ?? "";
          return timeFormatterRef.current ? timeFormatterRef.current(label) : label;
        },
      },
    });
  }, [axisFormatter, timeFormatter]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    lastDataChangeAtRef.current = Date.now();

    for (const series of seriesRef.current) chart.removeSeries(series);
    seriesRef.current = [];

    if (volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
        color: chartColors.volumePositive,
      });
      volumeSeries.setData(data.map((point, index) => ({
        time: pointTime(index),
        value: typeof point.volume === "number" ? point.volume : 0,
        color: point.price >= (typeof point.open === "number" ? point.open : data[index - 1]?.price ?? point.price) ? chartColors.volumePositive : chartColors.volumeNegative,
      })));
      chart.priceScale("").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      seriesRef.current.push(volumeSeries);
    }

    if (compareMode || mode === "line") {
      const primaryLine = chart.addSeries(LineSeries, {
        color: chartColors.line,
        lineWidth: 2,
        priceScaleId: "right",
      });
      primaryLine.setData(data.map((point, index) => ({
        time: pointTime(index),
        value: valueAt(point, valueKey) ?? point.price,
      })));
      seriesRef.current.push(primaryLine);
    } else if (mode === "area") {
      const area = chart.addSeries(AreaSeries, {
        lineColor: chartColors.line,
        topColor: chartColors.areaTop,
        bottomColor: chartColors.areaBottom,
        lineWidth: 2,
        priceScaleId: "right",
      });
      area.setData(data.map((point, index) => ({
        time: pointTime(index),
        value: point.price,
      })));
      seriesRef.current.push(area);
    } else if (mode === "bar") {
      const bars = chart.addSeries(BarSeries, {
        upColor: chartColors.positive,
        downColor: chartColors.negative,
        priceScaleId: "right",
      });
      bars.setData(data.map(toOhlc));
      seriesRef.current.push(bars);
    } else {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: chartColors.positive,
        downColor: chartColors.negative,
        wickUpColor: chartColors.positive,
        wickDownColor: chartColors.negative,
        borderVisible: false,
        priceScaleId: "right",
      });
      candles.setData(data.map(toOhlc));
      seriesRef.current.push(candles);
    }

    for (const line of [...chartColors.compareLines, ...chartColors.overlayLines]) {
      const lineSeries = chart.addSeries(LineSeries, {
        color: line.color,
        lineWidth: line.lineWidth ?? 2,
        priceScaleId: line.priceScaleId ?? "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      lineSeries.setData(data.flatMap((point, index) => {
        const value = valueAt(point, line.key);
        return value == null ? [] : [{ time: pointTime(index), value }];
      }));
      seriesRef.current.push(lineSeries);
    }

    chart.applyOptions({
      leftPriceScale: {
        visible: overlayLines.some((line) => line.priceScaleId === "left"),
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: volume ? 0.24 : 0.08 },
      },
    });
    const visibleRange = chart.timeScale().getVisibleLogicalRange();
    if (didFitRef.current && visibleRange) {
      chart.timeScale().setVisibleLogicalRange(visibleRange);
    } else {
      chart.timeScale().fitContent();
      didFitRef.current = true;
    }
    setHoverPoint(null);
    onHoverRef.current?.(null);
  }, [chartColors, compareMode, data, mode, overlayLinesSignature, valueKey, volume]);

  const tooltipStyle = hoverPoint
    ? {
      left: Math.min(Math.max(hoverPoint.x + 14, 8), Math.max((containerRef.current?.clientWidth ?? 260) - 260, 8)),
      top: Math.min(Math.max(hoverPoint.y + 14, 8), Math.max((containerRef.current?.clientHeight ?? 180) - 140, 8)),
    }
    : undefined;

  return (
    <div className={cn("relative h-full w-full", className)} data-testid="interactive-market-chart" data-fit-applied={fitAppliedKey}>
      <div ref={containerRef} className={cn("h-full w-full transition-opacity duration-200", isRangeTransitioning && "opacity-70")} />
      {measurement && <MeasurementOverlay measurement={measurement} axisFormatter={axisFormatter} />}
      {hoverPoint && tooltip && (
        <div role="tooltip" className={cn("pointer-events-none absolute z-20", tooltipClassName)} style={tooltipStyle}>
          {tooltip(hoverPoint.point)}
        </div>
      )}
    </div>
  );
}

function MeasurementOverlay({
  measurement,
  axisFormatter,
}: {
  measurement: MeasurementState;
  axisFormatter?: (value: number) => string;
}) {
  const left = Math.min(measurement.startX, measurement.endX);
  const right = Math.max(measurement.startX, measurement.endX);
  const width = Math.max(right - left, 1);
  const formatter = axisFormatter ?? ((value: number) => value.toFixed(2));

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute bottom-0 top-0 w-px bg-indigo-200/80" style={{ left: measurement.startX }} />
      <div className="absolute bottom-0 top-0 w-px bg-indigo-200/80" style={{ left: measurement.endX }} />
      <div className="absolute bottom-0 top-0 border-x border-indigo-300/20 bg-indigo-300/[0.055]" style={{ left, width }} />
      <div
        className="absolute top-3 min-w-56 rounded-xl border border-[var(--theme-border-strong)] bg-[var(--surface-popover)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-[var(--shadow-popover)]"
        style={{ left: Math.min(Math.max(left + width / 2 - 112, 8), Math.max((typeof window !== "undefined" ? window.innerWidth : 320) - 260, 8)) }}
      >
        <div className="mb-1 flex items-center justify-between gap-4">
          <span className="text-[var(--text-muted)]">Average</span>
          <span className="font-mono font-semibold text-[var(--text-primary)]">{formatter(measurement.average)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--text-muted)]">{measurement.bars} bars</span>
          <span className={cn("font-mono font-semibold", measurement.change >= 0 ? "text-emerald-300" : "text-red-300")}>
            {measurement.change >= 0 ? "+" : ""}{formatter(measurement.change)} · {measurement.percent >= 0 ? "+" : ""}{measurement.percent.toFixed(2)}%
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] text-[var(--text-subtle)]">
          {measurement.startLabel} - {measurement.endLabel}
        </div>
      </div>
    </div>
  );
}
