import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  LineChart,
  ScanSearch,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/branding";

/**
 * Hero section — primary value proposition and CTA.
 * Emphasizes probabilistic analysis, not guaranteed returns.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      <div className="relative mx-auto max-w-4xl text-center">
        <Badge variant="secondary" className="mb-6 animate-fade-in gap-1">
          <Sparkles className="h-3 w-3" />
          {SITE_TAGLINE}
        </Badge>

        <h1
          className="animate-fade-in text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          style={{ animationDelay: "0.1s" }}
        >
          Research smarter with{" "}
          <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
            {SITE_NAME}
          </span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl animate-fade-in text-lg text-muted-foreground"
          style={{ animationDelay: "0.2s" }}
        >
          Enter your capital, target, and timeframe — we scan live markets, analyze
          technicals and fundamentals, and estimate probabilities of reaching your goal.
          Never guarantees. Always transparent.
        </p>

        <div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <Button size="lg" asChild>
            <Link href="/sign-up">
              Start researching
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Example: £900 → £1,000 in 90 days — we estimate likelihood, not certainty.
        </p>
      </div>
    </section>
  );
}

const features = [
  {
    icon: ScanSearch,
    title: "Market Scanner",
    description:
      "Scan live markets across your preferred regions and rank opportunities by composite score.",
  },
  {
    icon: LineChart,
    title: "Technical Analysis",
    description: "RSI, MACD, EMA, Bollinger Bands, volume, and momentum indicators on real OHLCV data.",
  },
  {
    icon: BarChart3,
    title: "Fundamental Analysis",
    description: "PE, PEG, EPS growth, margins, debt, free cash flow, ROE, and more.",
  },
  {
    icon: Brain,
    title: "AI Research Reports",
    description:
      "Structured reports with scores, thesis, risks, and allocation suggestions — not blind buy calls.",
  },
  {
    icon: Target,
    title: "Portfolio Optimizer",
    description:
      "Suggested allocations with expected return ranges and probability of hitting your target.",
  },
  {
    icon: Shield,
    title: "Risk Analysis",
    description: "Volatility, beta, max drawdown, Sharpe ratio, and diversification scoring.",
  },
] as const;

/** Feature grid — highlights core platform capabilities. */
export function FeaturesSection() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything you need to research</h2>
          <p className="mt-3 text-muted-foreground">
            Built for serious investors who want data-driven insights with clear uncertainty.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }, index) => (
            <Card
              key={title}
              className="glass animate-fade-in border-border/50 transition-colors hover:border-primary/30"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    step: "01",
    title: "Set your goals",
    description: "Capital, target amount, timeframe, risk tolerance, and preferred markets.",
  },
  {
    step: "02",
    title: "We analyze live data",
    description: "Technicals, fundamentals, news sentiment, analyst ratings, and risk metrics.",
  },
  {
    step: "03",
    title: "Get probabilistic insights",
    description: "Scores, confidence bands, upside/downside ranges, and a clear investment thesis.",
  },
] as const;

/** How-it-works section — three-step user journey. */
export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-y border-border/40 bg-card/20 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              From goal to research report in minutes — powered by real APIs, not simulated data.
            </p>
          </div>
          <TrendingUp className="hidden h-12 w-12 text-primary/40 lg:block" />
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map(({ step, title, description }) => (
            <div key={step} className="relative glass rounded-xl p-6">
              <span className="font-mono text-3xl font-bold text-primary/30">{step}</span>
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Legal disclaimer — required on every public surface. */
export function DisclaimerSection() {
  return (
    <section id="disclaimer" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <Shield className="h-5 w-5" />
              Important disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              {SITE_NAME} provides AI-powered investment{" "}
              <strong className="text-foreground">research tools</strong>{" "}
              and <strong className="text-foreground">probabilistic estimates</strong>. It does not
              provide financial advice, and nothing on this platform constitutes a recommendation to
              buy or sell any security.
            </p>
            <p>
              All projections — including expected returns, downside risk, confidence scores, and
              probability of reaching a target — are <em>estimates based on historical and live data</em>.
              They are not guarantees of future performance.
            </p>
            <p>Always consult a qualified financial adviser before making investment decisions.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
