"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface TradeMarker {
  time: string;
  side: "buy" | "sell";
  label?: string;
}

interface CandlestickChartProps {
  candles: Candle[];
  markers?: TradeMarker[];
  /** When set, only the first N candles are rendered (replay reveal mode). */
  visibleCount?: number;
  height?: number;
  className?: string;
}

const FALLBACK_UP = "#34d399";
const FALLBACK_DOWN = "#f87171";

function themeColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function toBar(candle: Candle) {
  return {
    time: candle.date as Time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export default function CandlestickChart({ candles, markers, visibleCount, height = 380, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const renderedCountRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const up = themeColor("--color-green-positive", FALLBACK_UP);
    const down = themeColor("--color-red-negative", FALLBACK_DOWN);
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: themeColor("--text-muted", "rgba(255,255,255,0.62)"),
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: themeColor("--theme-border", "rgba(255,255,255,0.06)") },
        horzLines: { color: themeColor("--theme-border", "rgba(255,255,255,0.06)") },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    renderedCountRef.current = 0;

    return () => {
      markersRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const count = visibleCount === undefined ? candles.length : Math.min(Math.max(visibleCount, 0), candles.length);
    if (count === renderedCountRef.current + 1 && renderedCountRef.current > 0) {
      series.update(toBar(candles[count - 1]));
      chart.timeScale().scrollToRealTime();
    } else {
      series.setData(candles.slice(0, count).map(toBar));
      if (visibleCount === undefined) chart.timeScale().fitContent();
      else chart.timeScale().scrollToRealTime();
    }
    renderedCountRef.current = count;

    const lastVisibleDate = count > 0 ? candles[count - 1].date : "";
    const visibleMarkers: SeriesMarker<Time>[] = (markers ?? [])
      .filter((marker) => marker.time <= lastVisibleDate)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((marker) => ({
        time: marker.time as Time,
        position: marker.side === "buy" ? "belowBar" : "aboveBar",
        color: marker.side === "buy" ? themeColor("--color-green-positive", FALLBACK_UP) : themeColor("--color-red-negative", FALLBACK_DOWN),
        shape: marker.side === "buy" ? "arrowUp" : "arrowDown",
        text: marker.label ?? marker.side.toUpperCase(),
      }));
    markersRef.current?.setMarkers(visibleMarkers);
  }, [candles, markers, visibleCount]);

  return <div ref={containerRef} style={{ height }} className={cn("w-full", className)} />;
}
