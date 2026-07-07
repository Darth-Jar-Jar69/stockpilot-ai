import type { Time } from "lightweight-charts";

type TimeSeriesInput = {
  time: string;
  value?: number;
  equity?: number;
  close?: number;
};

/** Sort ascending and ensure strictly increasing unix times for lightweight-charts. */
export function toChartSeries(points: TimeSeriesInput[]): { time: Time; value: number }[] {
  const sorted = points
    .map((p) => ({
      ts: Math.floor(new Date(p.time).getTime() / 1000),
      value: p.value ?? p.equity ?? p.close ?? 0,
    }))
    .sort((a, b) => a.ts - b.ts);

  const result: { time: Time; value: number }[] = [];
  let lastTs = -1;

  for (const point of sorted) {
    let ts = point.ts;
    if (ts <= lastTs) ts = lastTs + 1;
    result.push({ time: ts as Time, value: point.value });
    lastTs = ts;
  }

  return result;
}

/** Ensure strictly ascending unix times for any chart series keyed by time. */
export function dedupeTimes<T extends { time: Time }>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => Number(a.time) - Number(b.time));
  const result: T[] = [];
  let lastTs = -1;
  for (const point of sorted) {
    let ts = Number(point.time);
    if (ts <= lastTs) ts = lastTs + 1;
    result.push({ ...point, time: ts as Time });
    lastTs = ts;
  }
  return result;
}
