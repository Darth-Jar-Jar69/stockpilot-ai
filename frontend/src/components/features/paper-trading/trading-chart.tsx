"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dedupeTimes } from "@/lib/chart-data";
import { formatCurrency } from "@/lib/utils";
import type { OHLCVBar } from "@/types/market";
import type { ChartTimeframe } from "@/types/paper-trading";
import { CHART_TIMEFRAMES } from "@/types/paper-trading";
import { cn } from "@/lib/utils";

const TIMEFRAMES: ChartTimeframe[] = ["1D", "5D", "1M", "6M", "1Y", "5Y"];

type TradingChartProps = {
  symbol: string;
};

type IndicatorToggles = {
  ma: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
};

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

/** Professional candlestick chart with volume, MA, and indicator readouts. */
export function TradingChart({ symbol }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [timeframe, setTimeframe] = useState<ChartTimeframe>("6M");
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorToggles>({
    ma: true,
    volume: true,
    rsi: true,
    macd: true,
  });
  const [tech, setTech] = useState<{
    rsi_14: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_histogram: number | null;
    sma_20: number | null;
  } | null>(null);
  const [hover, setHover] = useState<OHLCVBar | null>(null);

  const lastBar = bars[bars.length - 1];
  const display = hover ?? lastBar;

  useEffect(() => {
    setLoading(true);
    const { period, interval } = CHART_TIMEFRAMES[timeframe];
    fetch(`/api/market/ohlcv/${symbol}?period=${period}&interval=${interval}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBars(d?.bars ?? []))
      .catch(() => setBars([]))
      .finally(() => setLoading(false));
  }, [symbol, timeframe]);

  useEffect(() => {
    fetch(`/api/market/analysis/${symbol}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setTech(
          d?.technical
            ? {
                rsi_14: d.technical.rsi_14,
                macd: d.technical.macd,
                macd_signal: d.technical.macd_signal,
                macd_histogram: d.technical.macd_histogram,
                sma_20: d.technical.sma_20,
              }
            : null,
        ),
      )
      .catch(() => setTech(null));
  }, [symbol]);

  const chartData = useMemo(() => {
    const candles: CandlestickData<Time>[] = bars.map((bar) => ({
      time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    const safeCandles = dedupeTimes(candles);
    const closes = bars.map((b) => b.close);
    const ma20 = sma(closes, 20);

    const maLine = safeCandles
      .map((c, i) => {
        const val = ma20[i];
        return val != null ? { time: c.time, value: val } : null;
      })
      .filter(Boolean) as { time: Time; value: number }[];

    const volumes = safeCandles.map((c, i) => {
      const bar = bars[i];
      return {
        time: c.time,
        value: bar?.volume ?? 0,
        color: (bar?.close ?? 0) >= (bar?.open ?? 0) ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
      };
    });

    return { candles: safeCandles, volumes, maLine: dedupeTimes(maLine) };
  }, [bars]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.06)" },
        horzLines: { color: "rgba(148, 163, 184, 0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.15)" },
      timeScale: { borderColor: "rgba(148, 163, 184, 0.15)" },
      crosshair: { mode: 1 },
      height: 380,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const ma = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, title: "MA20" });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    maRef.current = ma;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHover(null);
        return;
      }
      const idx = bars.findIndex(
        (b) => Math.floor(new Date(b.timestamp).getTime() / 1000) === Number(param.time),
      );
      if (idx >= 0) setHover(bars[idx]);
    });

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: w });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [bars]);

  useEffect(() => {
    if (!candleRef.current || chartData.candles.length === 0) return;
    candleRef.current.setData(chartData.candles);
    volumeRef.current?.setData(indicators.volume ? chartData.volumes : []);
    maRef.current?.setData(indicators.ma ? chartData.maLine : []);
    chartRef.current?.timeScale().fitContent();
  }, [chartData, indicators.ma, indicators.volume]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              size="sm"
              variant={timeframe === tf ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["ma", "volume", "rsi", "macd"] as const).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={indicators[key] ? "secondary" : "outline"}
              className="h-7 px-2.5 text-xs uppercase"
              onClick={() => setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))}
            >
              {key === "ma" ? "MA" : key}
            </Button>
          ))}
        </div>
      </div>

      {display && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <span>O <b className="text-slate-200">{display.open.toFixed(2)}</b></span>
          <span>H <b className="text-gain">{display.high.toFixed(2)}</b></span>
          <span>L <b className="text-loss">{display.low.toFixed(2)}</b></span>
          <span>C <b className="text-slate-200">{display.close.toFixed(2)}</b></span>
          <span>Vol <b className="text-slate-200">{(display.volume / 1e6).toFixed(2)}M</b></span>
        </div>
      )}

      <div className="relative rounded-lg border border-border/50 bg-card/20">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 text-sm text-slate-400">
            Loading chart…
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ height: 380 }} />
      </div>

      {indicators.rsi && tech?.rsi_14 != null && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="font-mono">
            RSI(14): {tech.rsi_14.toFixed(1)}
          </Badge>
          {indicators.macd && tech.macd != null && (
            <>
              <Badge variant="secondary" className="font-mono">
                MACD: {tech.macd.toFixed(2)}
              </Badge>
              <Badge variant="secondary" className="font-mono">
                Signal: {tech.macd_signal?.toFixed(2) ?? "—"}
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "font-mono",
                  (tech.macd_histogram ?? 0) >= 0 ? "text-gain" : "text-loss",
                )}
              >
                Hist: {tech.macd_histogram?.toFixed(2) ?? "—"}
              </Badge>
            </>
          )}
          {tech.sma_20 != null && (
            <Badge variant="outline" className="font-mono">
              SMA20: {formatCurrency(tech.sma_20, "USD")}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
