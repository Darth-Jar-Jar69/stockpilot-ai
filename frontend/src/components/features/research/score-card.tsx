import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoreBlock } from "@/types/research";

function scoreColor(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 70) return "text-gain";
  if (score >= 50) return "text-amber-300";
  return "text-loss";
}

export function ScoreCard({ block }: { block: ScoreBlock }) {
  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm text-white">
          {block.label}
          <span className={`text-2xl font-bold ${scoreColor(block.score)}`}>
            {block.score != null ? `${block.score.toFixed(0)}/100` : "—"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {block.reasons.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-slate-300">Reasons</p>
            <ul className="space-y-0.5 text-slate-400">
              {block.reasons.map((r) => (
                <li key={r}>✓ {r}</li>
              ))}
            </ul>
          </div>
        )}
        {block.risks.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-amber-200/90">Risks</p>
            <ul className="space-y-0.5 text-amber-200/70">
              {block.risks.map((r) => (
                <li key={r}>⚠ {r}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
