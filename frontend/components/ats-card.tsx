import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ATSScore } from "@/lib/types";

export function ATSCard({ score }: { score: ATSScore }) {
  const bars: { label: string; value: number }[] = [
    { label: "overall", value: score.overall_score },
    { label: "keyword_coverage", value: score.keyword_coverage },
    { label: "cosine_similarity", value: score.cosine_similarity },
    { label: "section_completeness", value: score.section_completeness },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>ats_score</CardTitle>
          <Badge variant={score.passed ? "success" : "destructive"} className="text-[10px]">
            {score.passed ? "PASSED" : "BELOW THRESHOLD"} · {score.threshold.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-baseline justify-between font-mono text-xs">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="tabular-nums">{(b.value * 100).toFixed(1)}%</span>
              </div>
              <Progress
                value={b.value * 100}
                className={cn(b.label === "overall" && "h-3")}
              />
            </div>
          ))}
        </div>

        {score.matched_keywords.length > 0 ? (
          <KwList label="matched_keywords" items={score.matched_keywords} variant="success" />
        ) : null}
        {score.missing_keywords.length > 0 ? (
          <KwList label="missing_keywords" items={score.missing_keywords} variant="warning" />
        ) : null}

        {score.gap_summary ? (
          <Alert variant={score.passed ? "info" : "warning"}>
            <AlertDescription className="font-mono text-xs leading-relaxed">
              {score.gap_summary}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KwList({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: "success" | "warning";
}) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} <span className="opacity-60">({items.length})</span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <Badge key={s} variant={variant} className="font-mono text-[11px]">
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}
