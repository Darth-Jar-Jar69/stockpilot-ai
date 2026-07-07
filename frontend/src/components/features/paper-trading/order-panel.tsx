"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calcCommission,
  resolveExecutionPrice,
  searchSymbols,
  simulateBidAsk,
} from "@/lib/paper-trading-market";
import { formatCurrency } from "@/lib/utils";
import type { LiveQuote, OrderType } from "@/types/paper-trading";
import { cn } from "@/lib/utils";

type OrderPanelProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  buyingPower: number;
  heldShares: number;
  presetShares?: number;
  disabled: boolean;
  onTrade: (order: {
    symbol: string;
    side: "buy" | "sell";
    shares: number;
    orderType: OrderType;
    limitPrice?: number;
    stopPrice?: number;
  }) => Promise<void>;
};

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop_loss", label: "Stop Loss" },
  { value: "take_profit", label: "Take Profit" },
];

export function OrderPanel({
  symbol,
  onSymbolChange,
  buyingPower,
  heldShares,
  presetShares,
  disabled,
  onTrade,
}: OrderPanelProps) {
  const [query, setQuery] = useState(symbol);
  const [showSearch, setShowSearch] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(() => searchSymbols(query), [query]);

  useEffect(() => {
    setQuery(symbol);
  }, [symbol]);

  useEffect(() => {
    if (presetShares != null && presetShares > 0) {
      setShares(presetShares);
      setSide("sell");
    }
  }, [presetShares, symbol]);

  useEffect(() => {
    let prev = 0;
    const load = () => {
      fetch(`/api/market/quote/${symbol}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.price) return;
          const spread = simulateBidAsk(d.price);
          const next: LiveQuote = {
            symbol: d.symbol,
            price: d.price,
            change: d.change,
            change_percent: d.change_percent,
            bid: spread.bid,
            ask: spread.ask,
            spread: spread.spread,
            previous_close: d.previous_close,
            volume: d.volume,
            as_of: d.as_of,
          };
          if (prev && next.price > prev) setPriceFlash("up");
          else if (prev && next.price < prev) setPriceFlash("down");
          prev = next.price;
          setQuote(next);
          setTimeout(() => setPriceFlash(null), 600);
        })
        .catch(() => setQuote(null));
    };
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [symbol]);

  const execution = quote
    ? resolveExecutionPrice({
        orderType,
        side,
        livePrice: quote.price,
        limitPrice: limitPrice ? Number(limitPrice) : undefined,
        stopPrice: stopPrice ? Number(stopPrice) : undefined,
      })
    : null;

  const estPrice = execution && "price" in execution ? execution.price : quote?.price ?? 0;
  const commission = calcCommission(shares, estPrice);
  const gross = shares * estPrice;
  const estimatedTotal = side === "buy" ? gross + commission : gross - commission;

  const handleSubmit = async () => {
    if (!quote) return;
    const summary = [
      `${side.toUpperCase()} ${shares} ${symbol}`,
      `Price: $${estPrice.toFixed(2)}`,
      `Order: ${orderType}`,
      `Est. total: $${estimatedTotal.toFixed(2)} (fee $${commission.toFixed(2)})`,
      "Confirm execution?",
    ].join("\n");
    if (!confirm(summary)) return;

    setSubmitting(true);
    await onTrade({
      symbol,
      side,
      shares,
      orderType,
      limitPrice: limitPrice ? Number(limitPrice) : undefined,
      stopPrice: stopPrice ? Number(stopPrice) : undefined,
    });
    setSubmitting(false);
  };

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-white">Order Entry</CardTitle>
        <CardDescription className="text-slate-400">Market · Limit · Stop · Take-profit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative space-y-1">
          <Label className="text-slate-400">Symbol</Label>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value.toUpperCase());
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 150)}
            className="bg-secondary/50 font-mono uppercase"
          />
          {showSearch && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-border/60 bg-card shadow-xl">
              {suggestions.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/60"
                  onMouseDown={() => {
                    onSymbolChange(s.symbol);
                    setQuery(s.symbol);
                    setShowSearch(false);
                  }}
                >
                  <span className="font-mono font-semibold text-white">{s.symbol}</span>
                  <span className="truncate pl-2 text-xs text-slate-400">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {quote && (
          <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-baseline justify-between">
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums transition-colors duration-300",
                  priceFlash === "up" && "text-gain",
                  priceFlash === "down" && "text-loss",
                  !priceFlash && "text-white",
                )}
              >
                {formatCurrency(quote.price, "USD")}
              </span>
              {quote.change_percent != null && (
                <Badge variant={quote.change_percent >= 0 ? "default" : "destructive"}>
                  {quote.change_percent >= 0 ? "+" : ""}
                  {quote.change_percent.toFixed(2)}%
                </Badge>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>Bid {formatCurrency(quote.bid, "USD")}</span>
              <span>Ask {formatCurrency(quote.ask, "USD")}</span>
              <span>Spread ${quote.spread.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={side === "buy" ? "default" : "outline"}
            onClick={() => setSide("buy")}
            className={side === "buy" ? "bg-gain hover:bg-gain/90" : ""}
          >
            Buy
          </Button>
          <Button
            variant={side === "sell" ? "default" : "outline"}
            onClick={() => setSide("sell")}
            className={side === "sell" ? "bg-loss hover:bg-loss/90" : ""}
          >
            Sell
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-slate-400">Order type</Label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            className="w-full rounded-md border border-border/60 bg-secondary/50 px-3 py-2 text-sm text-white"
          >
            {ORDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {(orderType === "limit") && (
          <div className="space-y-1">
            <Label className="text-slate-400">Limit price</Label>
            <Input
              type="number"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="bg-secondary/50"
            />
          </div>
        )}

        {(orderType === "stop_loss" || orderType === "take_profit") && (
          <div className="space-y-1">
            <Label className="text-slate-400">
              {orderType === "stop_loss" ? "Stop price" : "Target price"}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              className="bg-secondary/50"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-slate-400">Quantity (shares)</Label>
          <Input
            type="number"
            min={0.0001}
            step={1}
            value={shares}
            onChange={(e) => setShares(Number(e.target.value))}
            className="bg-secondary/50"
          />
          {side === "sell" && (
            <p className="text-xs text-slate-500">Held: {heldShares.toFixed(4)} shares</p>
          )}
        </div>

        <div className="space-y-1 rounded-lg border border-border/40 bg-card/40 p-3 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Estimated {side === "buy" ? "cost" : "proceeds"}</span>
            <span className="text-white">{formatCurrency(estimatedTotal, "USD")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Commission (sim.)</span>
            <span>{formatCurrency(commission, "USD")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Buying power</span>
            <span>{formatCurrency(buyingPower, "USD")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Execution</span>
            <span>{orderType === "market" ? "Instant (sim.)" : "Conditional"}</span>
          </div>
          {execution && "error" in execution && (
            <p className="text-xs text-amber-300">{execution.error}</p>
          )}
        </div>

        <Button
          className="w-full"
          disabled={disabled || submitting || !quote || (execution != null && "error" in execution)}
          onClick={handleSubmit}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </Button>
      </CardContent>
    </Card>
  );
}
