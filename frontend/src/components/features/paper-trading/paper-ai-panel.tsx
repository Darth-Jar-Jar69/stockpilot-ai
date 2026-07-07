"use client";

import { Bot } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generatePaperInsights } from "@/lib/paper-insights";
import type { PaperAccountState } from "@/types/paper-trading";

type PaperAiPanelProps = {
  account: PaperAccountState;
};

export function PaperAiPanel({ account }: PaperAiPanelProps) {
  const insights = generatePaperInsights(account);

  return (
    <Card className="glass border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-white">
          <Bot className="h-5 w-5 text-primary" />
          AI Portfolio Insights
        </CardTitle>
        <CardDescription className="text-slate-400">
          StockPilot analysis · research only, not financial advice
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((line, i) => (
          <p key={i} className="rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-sm text-slate-200">
            {line}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
