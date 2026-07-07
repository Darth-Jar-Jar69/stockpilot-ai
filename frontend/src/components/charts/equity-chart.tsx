"use client";

import { useEffect, useRef } from "react";
import { ColorType, LineSeries, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

import { toChartSeries } from "@/lib/chart-data";

type EquityPoint = { time: string; equity: number };

type EquityChartProps = {
  points: EquityPoint[];
  height?: number;
};

/** Line chart for paper-trading equity curve. */
export function EquityChart({ points, height = 280 }: EquityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#cbd5e1",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.2)" },
      timeScale: { borderColor: "rgba(148, 163, 184, 0.2)" },
      height,
    });

    const series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: w });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || points.length === 0) return;

    const data = toChartSeries(points);

    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border/50 bg-card/30 text-sm text-slate-400"
        style={{ height }}
      >
        Fund your account to see your equity curve
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-border/50 bg-card/30"
      style={{ height }}
      aria-label="Portfolio equity chart"
    />
  );
}
