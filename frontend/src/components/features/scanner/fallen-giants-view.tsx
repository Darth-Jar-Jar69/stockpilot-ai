"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mountain,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { FallenGiantCandidate, FallenGiantsResponse } from "@/types/scanner";

type SortBy =
  | "fallen_giants_score"
  | "decline_percent"
  | "recovery_score"
  | "fundamental_health_score";

const DECLINES = [
  { value: 10, label: "≥10%" },
  { value: 15, label: "≥15%" },
  { value: 20, label: "≥20%" },
  { value: 30, label: "≥30%" },
];

const MARKET_CAPS = [
  { value: 5_000_000_000, label: "≥ $5B" },
  { value: 10_000_000_000, label: "≥ $10B" },
  { value: 50_000_000_000, label: "≥ $50B" },
  { value: 100_000_000_000, label: "≥ $100B" },
];

const RISKS = [
  { value: "", label: "Any risk" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const CATALYSTS = [
  { value: "", label: "Any catalyst" },
  { value: "earnings_miss", label: "Earnings miss" },
  { value: "guidance_cut", label: "Guidance cut" },
  { value: "regulatory", label: "Regulatory" },
  { value: "lawsuit", label: "Lawsuit" },
  { value: "product_failure", label: "Product failure" },
  { value: "management_change", label: "Management" },
  { value: "government_action", label: "Government" },
  { value: "contract_loss", label: "Contract loss" },
  { value: "financial_warning", label: "Financial warning" },
];

const TIME_WINDOWS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
];

const SORTS: { value: SortBy; label: string }[] = [
  { value: "fallen_giants_score", label: "Fallen Giants Score" },
  { value: "decline_percent", label: "% Decline" },
  { value: "recovery_score", label: "Recovery Potential" },
  { value: "fundamental_health_score", label: "Fundamental Strength" },
];

function formatMarketCap(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return formatCurrency(n);
}

function scoreBarClass(score: number): string {
  if (score >= 65) return "bg-emerald-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-rose-400";
}

function catalystLabel(type: string): string {
  return CATALYSTS.find((c) => c.value === type)?.label ?? type.replaceAll("_", " ");
}

export function FallenGiantsView() {
  const [data, setData] = useState<FallenGiantsResponse | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [minDecline, setMinDecline] = useState(10);
  const [minMarketCap, setMinMarketCap] = useState(10_000_000_000);
  const [risk, setRisk] = useState("");
  const [catalystType, setCatalystType] = useState("");
  const [maxDays, setMaxDays] = useState(90);
  const [minFundamental, setMinFundamental] = useState(0);
  const [minRecovery, setMinRecovery] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("fallen_giants_score");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({
        min_decline: String(minDecline),
        min_market_cap: String(minMarketCap),
        max_days_since_crash: String(maxDays),
        sort_by: sortBy,
        limit: "20",
      });
      if (risk) params.set("risk", risk);
      if (catalystType) params.set("catalyst_type", catalystType);
      if (minFundamental > 0) params.set("min_fundamental_score", String(minFundamental));
      if (minRecovery > 0) params.set("min_recovery_score", String(minRecovery));

      const res = await fetch(`/api/market/scanner/fallen-giants?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Fallen Giants scanner unavailable.");
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load Fallen Giants. Check that the market API is online.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [minDecline, minMarketCap, risk, catalystType, maxDays, minFundamental, minRecovery, sortBy]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Mountain className="h-5 w-5 text-primary" />
            Fallen Giants
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Large companies with a sudden 10–30%+ event-driven decline that may still have strong
            fundamentals and incomplete price recovery. Research only — a crash is not a buy signal.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
        <FilterRow label="Min decline">
          {DECLINES.map((d) => (
            <Chip key={d.value} active={minDecline === d.value} onClick={() => setMinDecline(d.value)}>
              {d.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Market cap">
          {MARKET_CAPS.map((m) => (
            <Chip
              key={m.value}
              active={minMarketCap === m.value}
              onClick={() => setMinMarketCap(m.value)}
            >
              {m.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Risk">
          {RISKS.map((r) => (
            <Chip key={r.value || "any"} active={risk === r.value} onClick={() => setRisk(r.value)}>
              {r.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Recovery score">
          {[0, 40, 55, 70].map((v) => (
            <Chip key={v} active={minRecovery === v} onClick={() => setMinRecovery(v)}>
              {v === 0 ? "Any" : `≥ ${v}`}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Fundamentals">
          {[0, 45, 55, 65].map((v) => (
            <Chip key={v} active={minFundamental === v} onClick={() => setMinFundamental(v)}>
              {v === 0 ? "Any" : `≥ ${v}`}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Catalyst">
          {CATALYSTS.map((c) => (
            <Chip
              key={c.value || "any-c"}
              active={catalystType === c.value}
              onClick={() => setCatalystType(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Time since crash">
          {TIME_WINDOWS.map((t) => (
            <Chip key={t.value} active={maxDays === t.value} onClick={() => setMaxDays(t.value)}>
              {t.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Sort by">
          {SORTS.map((s) => (
            <Chip key={s.value} active={sortBy === s.value} onClick={() => setSortBy(s.value)}>
              {s.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {loading && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Scanning large-cap drawdowns, news catalysts, and fundamentals… first run can take 1–2
            minutes.
          </p>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
            <p className="text-sm text-amber-100">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          <p className="text-xs text-slate-500">
            Scanned {data.universe_size} liquid names · {data.results.length} candidates ·{" "}
            {data.disclaimer}
          </p>
          {data.results.length === 0 ? (
            <Card className="glass border-border/50">
              <CardContent className="py-10 text-center text-sm text-slate-400">
                No Fallen Giants matched these filters. Try a lower decline threshold or broader
                market-cap / time window.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.results.map((row) => (
                <FallenGiantCard
                  key={row.symbol}
                  row={row}
                  expanded={expanded === row.symbol}
                  onToggle={() =>
                    setExpanded((cur) => (cur === row.symbol ? null : row.symbol))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick} className="h-8">
      {children}
    </Button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("text-sm font-medium text-slate-100", tone)}>{value}</p>
    </div>
  );
}

function ScorePill({ label, score }: { label: string; score: number | null }) {
  const v = score ?? 0;
  return (
    <div className="min-w-[110px]">
      <div className="mb-1 flex justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-slate-300">{score != null ? score.toFixed(0) : "—"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", scoreBarClass(v))}
          style={{ width: `${Math.min(100, v)}%` }}
        />
      </div>
    </div>
  );
}

function FallenGiantCard({
  row,
  expanded,
  onToggle,
}: {
  row: FallenGiantCandidate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const score = row.fallen_giants_score ?? 0;
  const dateLabel = row.catalyst_date
    ? new Date(row.catalyst_date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <Card className="glass border-border/50">
      <CardHeader className="space-y-4 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-white">
              <Link href={`/analysis/${row.symbol}`} className="font-mono hover:text-primary">
                {row.symbol}
              </Link>
              <span className="text-base font-normal text-slate-300">
                {row.company_name ?? "—"}
              </span>
              <Badge variant="outline" className="border-primary/30 text-primary">
                FG {score.toFixed(0)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {catalystLabel(row.catalyst_type)}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1 text-slate-400">
              {row.catalyst ?? "Catalyst under review"} · {dateLabel}
              {row.days_since_catalyst != null ? ` · ${row.days_since_catalyst}d since trough` : ""}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle} className="self-start">
            {expanded ? (
              <>
                Hide detail <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Why it fell <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Metric label="Market cap" value={formatMarketCap(row.market_cap)} />
          <Metric
            label="Current"
            value={row.current_price != null ? formatCurrency(row.current_price) : "—"}
          />
          <Metric
            label="Pre-catalyst"
            value={row.pre_catalyst_price != null ? formatCurrency(row.pre_catalyst_price) : "—"}
          />
          <Metric
            label="Trough"
            value={
              row.lowest_price_after_catalyst != null
                ? formatCurrency(row.lowest_price_after_catalyst)
                : "—"
            }
          />
          <Metric
            label="% Decline"
            value={row.decline_percent != null ? formatPercent(-Math.abs(row.decline_percent)) : "—"}
            tone="text-loss"
          />
          <Metric
            label="% Recovered"
            value={row.recovered_percent != null ? `${row.recovered_percent.toFixed(0)}%` : "—"}
          />
          <Metric
            label="vs SPY"
            value={
              row.relative_to_spy_decline != null
                ? `${row.relative_to_spy_decline.toFixed(1)}% SPY`
                : "—"
            }
          />
          <Metric label="Sector" value={row.sector ?? "—"} />
        </div>

        <div className="flex flex-wrap gap-4">
          <ScorePill label="Fallen Giants" score={row.fallen_giants_score} />
          <ScorePill label="Fundamentals" score={row.fundamental_health_score} />
          <ScorePill label="Valuation" score={row.valuation_score} />
          <ScorePill label="Recovery" score={row.recovery_score} />
          <ScorePill label="Risk (higher=worse)" score={row.risk_score} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 border-t border-border/40 pt-4">
          <DetailBlock title="Why it fell" body={row.why_it_fell} />
          <DetailBlock title="Why it could recover" body={row.why_it_could_recover} />
          <DetailBlock title="Why it might NOT recover" body={row.why_it_might_not_recover} />

          {row.recovery_confirmations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                What would confirm the recovery
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                {row.recovery_confirmations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {row.sources.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sources
              </p>
              <ul className="space-y-1.5 text-sm">
                {row.sources.map((s, i) => (
                  <li key={`${s.title}-${i}`} className="text-slate-300">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {s.title}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      s.title
                    )}
                    {s.source ? <span className="text-slate-500"> — {s.source}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {row.data_warnings.length > 0 && (
            <p className="text-xs text-amber-200/80">{row.data_warnings.join(" ")}</p>
          )}

          <p className="text-[11px] text-slate-500">
            Scores are research aids derived from live prices, fundamentals, and news — not
            guarantees of future returns.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function DetailBlock({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-sm leading-relaxed text-slate-200">{body}</p>
    </div>
  );
}
